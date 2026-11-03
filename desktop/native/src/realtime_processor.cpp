#include "realtime_processor.hpp"

#include <algorithm>
#include <cmath>
#include <limits>

RealtimeProcessor::RealtimeProcessor() : controlGraph_(std::make_unique<ModelChain>()) {
  controlGraph_->Prepare(48000.0, 128);
  auto initial = controlGraph_->Clone();
  activeGraph_.store(initial.release(), std::memory_order_release);
  inputGain_.setCurrentAndTargetValue(1.0f);
  masterGain_.setCurrentAndTargetValue(1.0f);
}

RealtimeProcessor::~RealtimeProcessor() {
  ModelChain* active = activeGraph_.exchange(nullptr, std::memory_order_acq_rel);
  delete active;
  for (auto* graph = PopPending(); graph != nullptr; graph = PopPending())
    delete graph;
  CollectRetired();
}

bool RealtimeProcessor::Prepare(double deviceSampleRate, int maxDeviceFrames) {
  if (!std::isfinite(deviceSampleRate) || deviceSampleRate < 1.0 || maxDeviceFrames < 1)
    return false;
  deviceSampleRate_ = deviceSampleRate;
  maxDeviceFrames_ = maxDeviceFrames;
  const double converted = std::ceil(maxDeviceFrames * 48000.0 / deviceSampleRate);
  if (converted > static_cast<double>(std::numeric_limits<int>::max() - 32))
    return false;
  maxChainFrames_ = std::max(1, static_cast<int>(converted) + 32);
  inputScratch_.resize(static_cast<size_t>(maxDeviceFrames_));
  chainScratch_.resize(static_cast<size_t>(maxChainFrames_));
  outputScratch_.resize(static_cast<size_t>(maxDeviceFrames_));
  inputPointers_[0] = inputScratch_.data();
  chainPointers_[0] = chainScratch_.data();
  outputPointers_[0] = outputScratch_.data();
  inputResampler_ = std::make_unique<Resampler>(static_cast<float>(deviceSampleRate_), 48000.0f);
  outputResampler_ = std::make_unique<Resampler>(48000.0f, static_cast<float>(deviceSampleRate_));
  controlGraph_->Prepare(48000.0, maxChainFrames_);

  // Device preparation runs with callbacks detached, so replace the active copy
  // here to give every block the new derived 48 kHz capacity.
  for (auto* graph = PopPending(); graph != nullptr; graph = PopPending())
    delete graph;
  ParameterChange discarded;
  while (PopParameterChange(discarded)) {
  }
  auto preparedGraph = controlGraph_->Clone();
  if (!preparedGraph)
    return false;
  auto* previous = activeGraph_.exchange(preparedGraph.release(), std::memory_order_acq_rel);
  delete previous;
  CollectRetired();

  inputGain_.reset(deviceSampleRate_, 0.02);
  masterGain_.reset(deviceSampleRate_, 0.02);
  inputGain_.setCurrentAndTargetValue(requestedInputGain_.load(std::memory_order_relaxed));
  masterGain_.setCurrentAndTargetValue(requestedMasterGain_.load(std::memory_order_relaxed));
  lastInputGain_ = requestedInputGain_.load(std::memory_order_relaxed);
  lastMasterGain_ = requestedMasterGain_.load(std::memory_order_relaxed);
  return true;
}

void RealtimeProcessor::Process(const float* monoInput, float* leftOutput,
                                float* rightOutput, int deviceFrames) noexcept {
  if (deviceFrames > 0) {
    if (leftOutput != nullptr)
      std::fill_n(leftOutput, deviceFrames, 0.0f);
    if (rightOutput != nullptr)
      std::fill_n(rightOutput, deviceFrames, 0.0f);
  }

  if (deviceFrames <= 0 || monoInput == nullptr || leftOutput == nullptr ||
      rightOutput == nullptr || inputResampler_ == nullptr || outputResampler_ == nullptr) {
    underruns_.fetch_add(1, std::memory_order_relaxed);
    return;
  }
  if (deviceFrames > maxDeviceFrames_) {
    underruns_.fetch_add(1, std::memory_order_relaxed);
    return;
  }
  const int chainFrames = static_cast<int>(std::ceil(deviceFrames * 48000.0 / deviceSampleRate_));
  if (chainFrames > maxChainFrames_) {
    underruns_.fetch_add(1, std::memory_order_relaxed);
    return;
  }

  if (CanPushRetired()) {
    if (auto* next = PopPending()) {
      auto* previous = activeGraph_.exchange(next, std::memory_order_acq_rel);
      if (previous != nullptr)
        PushRetired(previous);
    }
  }

  auto* graph = activeGraph_.load(std::memory_order_acquire);
  // Read the parameter queue first, then check structural updates. Their
  // producer order guarantees any earlier graph publication is visible here.
  if (graph != nullptr) {
    const auto pendingParameters = PendingParameterCount();
    if (!HasPendingGraphUpdates()) {
      ParameterChange change;
      for (uint32_t i = 0; i < pendingParameters && PopParameterChange(change); ++i)
        graph->ApplyParam(change.blockId.data(), change.name.data(), change.value,
                          change.smoothingTarget);
    }
  }

  const float inputTarget = requestedInputGain_.load(std::memory_order_relaxed);
  if (inputTarget != lastInputGain_) {
    inputGain_.setTargetValue(inputTarget);
    lastInputGain_ = inputTarget;
  }
  const float masterTarget = requestedMasterGain_.load(std::memory_order_relaxed);
  if (masterTarget != lastMasterGain_) {
    masterGain_.setTargetValue(masterTarget);
    lastMasterGain_ = masterTarget;
  }

  float inputPeak = 0.0f;
  for (int i = 0; i < deviceFrames; ++i) {
    const float sample = monoInput[i] * inputGain_.getNextValue();
    inputScratch_[static_cast<size_t>(i)] = sample;
    inputPeak = std::max(inputPeak, std::abs(sample));
  }
  inputMeter_.store(inputPeak, std::memory_order_relaxed);

  inputResampler_->PushBlock(inputPointers_.data(), static_cast<size_t>(deviceFrames));
  const auto produced = inputResampler_->PopBlock(chainPointers_.data(),
                                                   static_cast<size_t>(maxChainFrames_));
  if (produced > static_cast<size_t>(maxChainFrames_)) {
    underruns_.fetch_add(1, std::memory_order_relaxed);
    return;
  }
  float* processData[] = {chainScratch_.data()};
  juce::AudioBuffer<float> processBuffer(processData, 1, static_cast<int>(produced));
  if (graph != nullptr)
    graph->Process(processBuffer);

  outputResampler_->PushBlock(chainPointers_.data(), produced);
  const auto rendered = outputResampler_->PopBlock(outputPointers_.data(),
                                                    static_cast<size_t>(deviceFrames));
  const auto count = std::min(rendered, static_cast<size_t>(deviceFrames));
  float outputPeak = 0.0f;
  for (size_t i = 0; i < count; ++i) {
    const float sample = outputScratch_[i] * masterGain_.getNextValue();
    leftOutput[i] = sample;
    rightOutput[i] = sample;
    outputPeak = std::max(outputPeak, std::abs(sample));
  }
  outputMeter_.store(outputPeak, std::memory_order_relaxed);
}

void RealtimeProcessor::SetInputGainDb(double gainDb) noexcept {
  requestedInputGain_.store(static_cast<float>(std::pow(10.0, gainDb / 20.0)),
                            std::memory_order_relaxed);
}

void RealtimeProcessor::SetMasterGainDb(double gainDb) noexcept {
  requestedMasterGain_.store(static_cast<float>(std::pow(10.0, gainDb / 20.0)),
                             std::memory_order_relaxed);
}

GraphResult RealtimeProcessor::PublishControlGraph() {
  // Without a running audio thread nobody drains the pending queue, so the
  // mutation is only recorded in the control graph. Prepare() copies that
  // graph into the active one when the device starts.
  if (!publishing_.load(std::memory_order_acquire))
    return GraphResult::Ok;
  auto graph = controlGraph_->Clone();
  if (!graph)
    return GraphResult::Internal;
  if (!PushPending(graph.get()))
    return GraphResult::Busy;
  graph.release();
  return GraphResult::Ok;
}

bool RealtimeProcessor::PushPending(ModelChain* graph) noexcept {
  const auto write = pendingWrite_.load(std::memory_order_relaxed);
  const auto next = (write + 1) % kQueueSize;
  if (next == pendingRead_.load(std::memory_order_acquire))
    return false;
  pending_[write] = graph;
  pendingWrite_.store(next, std::memory_order_release);
  return true;
}

ModelChain* RealtimeProcessor::PopPending() noexcept {
  const auto read = pendingRead_.load(std::memory_order_relaxed);
  if (read == pendingWrite_.load(std::memory_order_acquire))
    return nullptr;
  auto* graph = pending_[read];
  pendingRead_.store((read + 1) % kQueueSize, std::memory_order_release);
  return graph;
}

bool RealtimeProcessor::HasPendingGraphUpdates() const noexcept {
  return pendingRead_.load(std::memory_order_acquire) !=
         pendingWrite_.load(std::memory_order_acquire);
}

uint32_t RealtimeProcessor::PendingParameterCount() const noexcept {
  const auto read = parameterRead_.load(std::memory_order_relaxed);
  const auto write = parameterWrite_.load(std::memory_order_acquire);
  return (write + kQueueSize - read) % kQueueSize;
}

bool RealtimeProcessor::PushParameterChange(const ParameterChange& change) noexcept {
  const auto write = parameterWrite_.load(std::memory_order_relaxed);
  const auto next = (write + 1) % kQueueSize;
  if (next == parameterRead_.load(std::memory_order_acquire))
    return false;
  parameterPending_[write] = change;
  parameterWrite_.store(next, std::memory_order_release);
  return true;
}

bool RealtimeProcessor::PopParameterChange(ParameterChange& change) noexcept {
  const auto read = parameterRead_.load(std::memory_order_relaxed);
  if (read == parameterWrite_.load(std::memory_order_acquire))
    return false;
  change = parameterPending_[read];
  parameterRead_.store((read + 1) % kQueueSize, std::memory_order_release);
  return true;
}

bool RealtimeProcessor::PushRetired(ModelChain* graph) noexcept {
  const auto write = retiredWrite_.load(std::memory_order_relaxed);
  const auto next = (write + 1) % kQueueSize;
  if (next == retiredRead_.load(std::memory_order_acquire))
    return false;
  retired_[write] = graph;
  retiredWrite_.store(next, std::memory_order_release);
  return true;
}

ModelChain* RealtimeProcessor::PopRetired() noexcept {
  const auto read = retiredRead_.load(std::memory_order_relaxed);
  if (read == retiredWrite_.load(std::memory_order_acquire))
    return nullptr;
  auto* graph = retired_[read];
  retiredRead_.store((read + 1) % kQueueSize, std::memory_order_release);
  return graph;
}

bool RealtimeProcessor::CanPushRetired() const noexcept {
  const auto write = retiredWrite_.load(std::memory_order_relaxed);
  return (write + 1) % kQueueSize != retiredRead_.load(std::memory_order_acquire);
}

void RealtimeProcessor::CollectRetired() noexcept {
  for (auto* graph = PopRetired(); graph != nullptr; graph = PopRetired())
    delete graph;
}

GraphResult RealtimeProcessor::AddFile(const std::filesystem::path& path, std::string& error,
                                       BlockInfo& info) {
  auto previous = controlGraph_->Clone();
  if (!previous)
    return GraphResult::Internal;
  auto added = controlGraph_->AddFile(path, error);
  if (!added)
    return GraphResult::LoadFailed;
  info = *added;
  const auto published = PublishControlGraph();
  if (published != GraphResult::Ok) {
    // The mutation is rolled back so the control chain stays consistent with
    // what the audio thread is playing.
    controlGraph_ = std::move(previous);
    if (published == GraphResult::Busy)
      error = kUpdateQueueFullMessage;
    return published;
  }
  CollectRetired();
  return GraphResult::Ok;
}

GraphResult RealtimeProcessor::RemoveBlock(std::string_view id) {
  auto previous = controlGraph_->Clone();
  if (!previous)
    return GraphResult::Internal;
  if (!controlGraph_->RemoveBlock(id))
    return GraphResult::NotFound;
  const auto published = PublishControlGraph();
  if (published != GraphResult::Ok) {
    controlGraph_ = std::move(previous);
    return published;
  }
  CollectRetired();
  return GraphResult::Ok;
}

GraphResult RealtimeProcessor::Reorder(const std::vector<std::string>& ids) {
  auto previous = controlGraph_->Clone();
  if (!previous)
    return GraphResult::Internal;
  if (!controlGraph_->Reorder(ids))
    return GraphResult::Invalid;
  const auto published = PublishControlGraph();
  if (published != GraphResult::Ok) {
    controlGraph_ = std::move(previous);
    return published;
  }
  CollectRetired();
  return GraphResult::Ok;
}

GraphResult RealtimeProcessor::SetParam(std::string_view id, std::string_view name,
                                        float value) {
  if (id.empty() || id.size() > 256 || name.empty() || name.size() > 64)
    return GraphResult::Invalid;

  ParameterChange change;
  std::copy(id.begin(), id.end(), change.blockId.begin());
  change.blockId[id.size()] = '\0';
  std::copy(name.begin(), name.end(), change.name.begin());
  change.name[name.size()] = '\0';
  change.value = value;

  const auto blocks = controlGraph_->Snapshot();
  const auto found = std::find_if(blocks.begin(), blocks.end(),
                                  [id](const auto& block) { return block.id == id; });
  if (found == blocks.end())
    return GraphResult::NotFound;

  float previousValue = 0.0f;
  if (name == "bypassed")
    previousValue = found->bypassed ? 1.0f : 0.0f;
  else if (name == "inputGainDb")
    previousValue = found->inputGainDb;
  else if (name == "outputGainDb")
    previousValue = found->outputGainDb;
  else if (name == "mix")
    previousValue = found->mix;
  else
    return GraphResult::Invalid;

  if (!controlGraph_->SetParam(id, name, value))
    return GraphResult::Invalid;

  if (name == "bypassed")
    change.value = value >= 0.5f ? 1.0f : 0.0f;
  if (name == "bypassed" || name == "mix") {
    if (name == "mix")
      change.value = std::clamp(value, 0.0f, 1.0f);
    change.smoothingTarget = change.value;
  } else {
    change.smoothingTarget = std::pow(10.0f, value / 20.0f);
  }

  if (publishing_.load(std::memory_order_acquire) && !PushParameterChange(change)) {
    controlGraph_->SetParam(id, name, previousValue);
    return GraphResult::Busy;
  }
  return GraphResult::Ok;
}

std::vector<BlockInfo> RealtimeProcessor::Snapshot() const {
  return controlGraph_->Snapshot();
}

std::string RealtimeProcessor::NextBlockIdFor(const std::filesystem::path& path) const {
  return controlGraph_->NextBlockIdFor(path);
}
