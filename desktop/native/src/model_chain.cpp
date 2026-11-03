#include "model_chain.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <utility>

#include <juce_audio_formats/juce_audio_formats.h>
#include <get_dsp.h>

namespace {

constexpr double kChainSampleRate = 48000.0;
constexpr int kDefaultBlockSize = 128;

struct ImpulseData {
  juce::AudioBuffer<float> samples;
  double sampleRate = kChainSampleRate;
};

ImpulseData ReadImpulse(const std::filesystem::path& path) {
  juce::AudioFormatManager formats;
  formats.registerBasicFormats();
  std::unique_ptr<juce::AudioFormatReader> reader(
      formats.createReaderFor(juce::File(path.string())));
  if (!reader)
    throw std::runtime_error("Unable to decode WAV impulse response");
  if (reader->numChannels != 1)
    throw std::runtime_error("WAV impulse response must be mono");
  if (reader->lengthInSamples <= 0 ||
      reader->lengthInSamples > std::numeric_limits<int>::max())
    throw std::runtime_error("WAV impulse response has an invalid length");

  ImpulseData data;
  data.sampleRate = reader->sampleRate;
  data.samples.setSize(1, static_cast<int>(reader->lengthInSamples));
  data.samples.clear();
  if (!reader->read(&data.samples, 0, data.samples.getNumSamples(), 0, true, false))
    throw std::runtime_error("Unable to read WAV impulse response samples");
  return data;
}

class NamAudioBlock final : public AudioBlock {
 public:
  NamAudioBlock(std::string id, std::filesystem::path path,
                std::unique_ptr<nam::DSP> dsp)
      : AudioBlock(std::move(id), "nam", std::move(path)), dsp_(std::move(dsp)) {}

  void Prepare(double, int maxBlockSize) override { PrepareBlock(maxBlockSize, true); }

  void PrepareForClone(double, int maxBlockSize) override { PrepareBlock(maxBlockSize, false); }

  std::unique_ptr<AudioBlock> Clone() const override {
    auto block = std::make_unique<NamAudioBlock>(
        Info().id, SourcePath(), nam::get_dsp(SourcePath()));
    CopySettingsTo(*block);
    return block;
  }

 private:
  void PrepareBlock(int maxBlockSize, bool resetRuntime) {
    PrepareBase(kChainSampleRate, maxBlockSize, resetRuntime);
    maxBlockSize_ = std::max(1, maxBlockSize);
    input_.resize(static_cast<std::size_t>(maxBlockSize_));
    output_.resize(static_cast<std::size_t>(maxBlockSize_));
    dsp_->Reset(kChainSampleRate, maxBlockSize_);
  }
  void ProcessWet(juce::AudioBuffer<float>& buffer) override {
    if (buffer.getNumChannels() != 1)
      return;

    int offset = 0;
    while (offset < buffer.getNumSamples()) {
      const int count = std::min(maxBlockSize_, buffer.getNumSamples() - offset);
      const float* source = buffer.getReadPointer(0, offset);
      for (int i = 0; i < count; ++i)
        input_[static_cast<std::size_t>(i)] = source[i];

      NAM_SAMPLE* inputPointer = input_.data();
      NAM_SAMPLE* outputPointer = output_.data();
      dsp_->process(&inputPointer, &outputPointer, count);
      float* destination = buffer.getWritePointer(0, offset);
      for (int i = 0; i < count; ++i)
        destination[i] = output_[static_cast<std::size_t>(i)];
      offset += count;
    }
  }

  std::unique_ptr<nam::DSP> dsp_;
  std::vector<NAM_SAMPLE> input_;
  std::vector<NAM_SAMPLE> output_;
  int maxBlockSize_ = kDefaultBlockSize;
};

class IrAudioBlock final : public AudioBlock {
 public:
  IrAudioBlock(std::string id, std::filesystem::path path)
      : AudioBlock(std::move(id), "ir", std::move(path)) {}

  void Prepare(double, int maxBlockSize) override { PrepareBlock(maxBlockSize, true); }

  void PrepareForClone(double, int maxBlockSize) override { PrepareBlock(maxBlockSize, false); }

  std::unique_ptr<AudioBlock> Clone() const override {
    auto block = std::make_unique<IrAudioBlock>(Info().id, SourcePath());
    CopySettingsTo(*block);
    return block;
  }

 private:
  void PrepareBlock(int maxBlockSize, bool resetRuntime) {
    PrepareBase(kChainSampleRate, maxBlockSize, resetRuntime);
    convolution_.prepare({kChainSampleRate,
                          static_cast<juce::uint32>(std::max(1, maxBlockSize)), 1});
    auto impulse = ReadImpulse(SourcePath());
    convolution_.loadImpulseResponse(std::move(impulse.samples), impulse.sampleRate,
                                     juce::dsp::Convolution::Stereo::no,
                                     juce::dsp::Convolution::Trim::no,
                                     juce::dsp::Convolution::Normalise::no);
  }
  void ProcessWet(juce::AudioBuffer<float>& buffer) override {
    if (buffer.getNumChannels() != 1)
      return;
    juce::dsp::AudioBlock<float> audioBlock(buffer);
    juce::dsp::ProcessContextReplacing<float> context(audioBlock);
    convolution_.process(context);
  }

  juce::dsp::Convolution convolution_;
};

std::string ExtensionOf(const std::filesystem::path& path) {
  auto extension = path.extension().string();
  std::transform(extension.begin(), extension.end(), extension.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return extension;
}

}  // namespace

AudioBlock::AudioBlock(std::string id, std::string kind, std::filesystem::path path)
    : id_(std::move(id)), kind_(std::move(kind)), path_(std::move(path)),
      runtime_(std::make_shared<RuntimeState>()) {
  runtime_->inputGain.setCurrentAndTargetValue(1.0f);
  runtime_->outputGain.setCurrentAndTargetValue(1.0f);
  runtime_->mix.setCurrentAndTargetValue(1.0f);
}

void AudioBlock::Prepare(double sampleRate, int maxBlockSize) {
  PrepareBase(sampleRate, maxBlockSize, true);
}

void AudioBlock::PrepareBase(double sampleRate, int maxBlockSize, bool resetRuntime) {
  const double safeSampleRate = sampleRate > 0.0 ? sampleRate : kChainSampleRate;
  dryBuffer_.setSize(1, std::max(1, maxBlockSize), false, false, true);
  if (!resetRuntime)
    return;

  const float inputTarget = std::pow(10.0f, inputGainDb_ / 20.0f);
  const float outputTarget = std::pow(10.0f, outputGainDb_ / 20.0f);
  runtime_->inputGain.reset(safeSampleRate, 0.02);
  runtime_->outputGain.reset(safeSampleRate, 0.02);
  runtime_->mix.reset(safeSampleRate, 0.02);
  runtime_->inputGain.setCurrentAndTargetValue(inputTarget);
  runtime_->outputGain.setCurrentAndTargetValue(outputTarget);
  runtime_->mix.setCurrentAndTargetValue(mix_);
  runtime_->inputGainTarget.store(inputTarget, std::memory_order_relaxed);
  runtime_->outputGainTarget.store(outputTarget, std::memory_order_relaxed);
  runtime_->mixTarget.store(mix_, std::memory_order_relaxed);
  runtime_->bypassed.store(bypassed_, std::memory_order_relaxed);
  runtime_->lastInputGainTarget = inputTarget;
  runtime_->lastOutputGainTarget = outputTarget;
  runtime_->lastMixTarget = mix_;
}

void AudioBlock::CopySettingsTo(AudioBlock& target) const {
  target.runtime_ = runtime_;
  target.bypassed_ = bypassed_;
  target.inputGainDb_ = inputGainDb_;
  target.outputGainDb_ = outputGainDb_;
  target.mix_ = mix_;
}

void AudioBlock::Process(juce::AudioBuffer<float>& buffer) {
  if (runtime_->bypassed.load(std::memory_order_relaxed) || buffer.getNumSamples() == 0)
    return;

  const float inputTarget = runtime_->inputGainTarget.load(std::memory_order_relaxed);
  if (inputTarget != runtime_->lastInputGainTarget) {
    runtime_->inputGain.setTargetValue(inputTarget);
    runtime_->lastInputGainTarget = inputTarget;
  }
  const float outputTarget = runtime_->outputGainTarget.load(std::memory_order_relaxed);
  if (outputTarget != runtime_->lastOutputGainTarget) {
    runtime_->outputGain.setTargetValue(outputTarget);
    runtime_->lastOutputGainTarget = outputTarget;
  }
  const float mixTarget = runtime_->mixTarget.load(std::memory_order_relaxed);
  if (mixTarget != runtime_->lastMixTarget) {
    runtime_->mix.setTargetValue(mixTarget);
    runtime_->lastMixTarget = mixTarget;
  }

  const int channels = buffer.getNumChannels();
  const int samples = buffer.getNumSamples();
  if (channels > dryBuffer_.getNumChannels() || samples > dryBuffer_.getNumSamples())
    return;

  for (int sample = 0; sample < samples; ++sample) {
    const float inputGain = runtime_->inputGain.getNextValue();
    for (int channel = 0; channel < channels; ++channel)
      buffer.setSample(channel, sample, buffer.getSample(channel, sample) * inputGain);
  }

  for (int channel = 0; channel < channels; ++channel)
    dryBuffer_.copyFrom(channel, 0, buffer, channel, 0, samples);

  ProcessWet(buffer);

  for (int sample = 0; sample < samples; ++sample) {
    const float mix = runtime_->mix.getNextValue();
    const float outputGain = runtime_->outputGain.getNextValue();
    for (int channel = 0; channel < channels; ++channel) {
      const float dry = dryBuffer_.getSample(channel, sample);
      const float wet = buffer.getSample(channel, sample);
      buffer.setSample(channel, sample, (dry + mix * (wet - dry)) * outputGain);
    }
  }
}

bool AudioBlock::SetParam(std::string_view name, float value) {
  if (!std::isfinite(value))
    return false;
  if (name == "bypassed") {
    bypassed_ = value >= 0.5f;
  } else if (name == "inputGainDb") {
    const float linear = std::pow(10.0f, value / 20.0f);
    if (!std::isfinite(linear))
      return false;
    inputGainDb_ = value;
  } else if (name == "outputGainDb") {
    const float linear = std::pow(10.0f, value / 20.0f);
    if (!std::isfinite(linear))
      return false;
    outputGainDb_ = value;
  } else if (name == "mix") {
    mix_ = std::clamp(value, 0.0f, 1.0f);
  } else {
    return false;
  }
  return true;
}

bool AudioBlock::ApplyParam(std::string_view name, float value,
                            float smoothingTarget) noexcept {
  if (!std::isfinite(value) || !std::isfinite(smoothingTarget))
    return false;
  if (name == "bypassed") {
    runtime_->bypassed.store(value >= 0.5f, std::memory_order_relaxed);
  } else if (name == "inputGainDb") {
    runtime_->inputGainTarget.store(smoothingTarget, std::memory_order_relaxed);
  } else if (name == "outputGainDb") {
    runtime_->outputGainTarget.store(smoothingTarget, std::memory_order_relaxed);
  } else if (name == "mix") {
    runtime_->mixTarget.store(smoothingTarget, std::memory_order_relaxed);
  } else {
    return false;
  }
  return true;
}

BlockInfo AudioBlock::Info() const {
  return {id_, kind_, path_, bypassed_, inputGainDb_, outputGainDb_, mix_};
}

void ModelChain::Prepare(double, int maxBlockSize) {
  sampleRate_ = kChainSampleRate;
  maxBlockSize_ = std::max(1, maxBlockSize);
  for (auto& block : blocks_)
    block->Prepare(sampleRate_, maxBlockSize_);
}

std::optional<BlockInfo> ModelChain::AddFile(const std::filesystem::path& path,
                                              std::string& error) {
  error.clear();
  std::ifstream readable(path, std::ios::binary);
  if (!readable) {
    error = "File is not readable: " + path.string();
    return std::nullopt;
  }

  const auto extension = ExtensionOf(path);
  const std::string id = (extension == ".nam" ? "nam-" : "ir-") +
                         std::to_string(nextId_++);
  try {
    std::unique_ptr<AudioBlock> block;
    if (extension == ".nam") {
      auto dsp = nam::get_dsp(path);
      if (dsp->NumInputChannels() != 1 || dsp->NumOutputChannels() != 1) {
        error = "NAM model must use one input and one output channel";
        return std::nullopt;
      }
      block = std::make_unique<NamAudioBlock>(id, path, std::move(dsp));
    } else if (extension == ".wav") {
      block = std::make_unique<IrAudioBlock>(id, path);
    } else {
      error = "Unsupported file extension: " + extension;
      return std::nullopt;
    }

    block->Prepare(sampleRate_, maxBlockSize_);
    const auto info = block->Info();
    blocks_.push_back(std::move(block));
    return info;
  } catch (const std::exception& exception) {
    error = exception.what();
    return std::nullopt;
  }
}

std::string ModelChain::NextBlockIdFor(const std::filesystem::path& path) const {
  const auto extension = ExtensionOf(path);
  return (extension == ".nam" ? "nam-" : "ir-") + std::to_string(nextId_);
}

void ModelChain::Append(std::unique_ptr<AudioBlock> block) {
  if (!block || Find(block->Info().id) != nullptr)
    return;
  block->Prepare(sampleRate_, maxBlockSize_);
  blocks_.push_back(std::move(block));
}

bool ModelChain::RemoveBlock(std::string_view id) {
  const auto found = std::find_if(blocks_.begin(), blocks_.end(),
                                  [id](const auto& block) { return block->Info().id == id; });
  if (found == blocks_.end())
    return false;
  blocks_.erase(found);
  return true;
}

bool ModelChain::Reorder(const std::vector<std::string>& ids) {
  if (ids.size() != blocks_.size())
    return false;

  std::vector<AudioBlock*> orderedBlocks;
  orderedBlocks.reserve(ids.size());
  for (const auto& id : ids) {
    auto* block = Find(id);
    if (block == nullptr || std::find(orderedBlocks.begin(), orderedBlocks.end(), block) != orderedBlocks.end())
      return false;
    orderedBlocks.push_back(block);
  }

  std::vector<std::unique_ptr<AudioBlock>> reordered;
  reordered.reserve(orderedBlocks.size());
  for (const auto* ordered : orderedBlocks) {
    auto found = std::find_if(blocks_.begin(), blocks_.end(),
                              [ordered](const auto& block) { return block.get() == ordered; });
    reordered.push_back(std::move(*found));
  }
  blocks_ = std::move(reordered);
  return true;
}

bool ModelChain::SetParam(std::string_view id, std::string_view name, float value) {
  auto* block = Find(id);
  return block != nullptr && block->SetParam(name, value);
}

bool ModelChain::ApplyParam(std::string_view id, std::string_view name, float value,
                            float smoothingTarget) noexcept {
  auto* block = Find(id);
  return block != nullptr && block->ApplyParam(name, value, smoothingTarget);
}

bool ModelChain::SetBypassed(std::string_view id, bool bypassed) {
  return SetParam(id, "bypassed", bypassed ? 1.0f : 0.0f);
}

bool ModelChain::HasBlock(std::string_view id) const {
  return Find(id) != nullptr;
}

void ModelChain::Process(juce::AudioBuffer<float>& buffer) {
  for (auto& block : blocks_)
    block->Process(buffer);
}

std::vector<BlockInfo> ModelChain::Snapshot() const {
  std::vector<BlockInfo> result;
  result.reserve(blocks_.size());
  for (const auto& block : blocks_)
    result.push_back(block->Info());
  return result;
}

std::unique_ptr<ModelChain> ModelChain::Clone() const {
  auto result = std::make_unique<ModelChain>();
  result->sampleRate_ = sampleRate_;
  result->maxBlockSize_ = maxBlockSize_;
  result->nextId_ = nextId_;
  result->blocks_.reserve(blocks_.size());
  for (const auto& block : blocks_) {
    auto copy = block->Clone();
    if (!copy)
      return nullptr;
    copy->PrepareForClone(sampleRate_, maxBlockSize_);
    result->blocks_.push_back(std::move(copy));
  }
  return result;
}

AudioBlock* ModelChain::Find(std::string_view id) const {
  const auto found = std::find_if(blocks_.begin(), blocks_.end(),
                                  [id](const auto& block) { return block->Id() == id; });
  return found == blocks_.end() ? nullptr : found->get();
}
