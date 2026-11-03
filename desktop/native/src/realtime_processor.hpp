#pragma once

#include <array>
#include <atomic>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

#include "model_chain.hpp"

namespace iplug {
inline constexpr double PI = 3.14159265358979323846;
}

#include <LanczosResampler.h>

// Outcome of an audio graph mutation. Busy is temporary; Invalid, NotFound and
// LoadFailed describe permanent errors.
enum class GraphResult {
  Ok,
  Invalid,
  NotFound,
  LoadFailed,
  Busy,
  Internal,
};

// Reported when a valid update cannot be published because the audio thread
// has not drained its bounded update queues yet.
inline constexpr char kUpdateQueueFullMessage[] = "Audio update queue is full";

class RealtimeProcessor {
 public:
  RealtimeProcessor();
  ~RealtimeProcessor();
  RealtimeProcessor(const RealtimeProcessor&) = delete;
  RealtimeProcessor& operator=(const RealtimeProcessor&) = delete;

  bool Prepare(double deviceSampleRate, int maxDeviceFrames);
  void Process(const float* monoInput, float* leftOutput, float* rightOutput,
               int deviceFrames) noexcept;
  void SetInputGainDb(double gainDb) noexcept;
  void SetMasterGainDb(double gainDb) noexcept;
  uint64_t Underruns() const noexcept { return underruns_.load(std::memory_order_relaxed); }
  float InputMeter() const noexcept { return inputMeter_.load(std::memory_order_relaxed); }
  float OutputMeter() const noexcept { return outputMeter_.load(std::memory_order_relaxed); }

  GraphResult AddFile(const std::filesystem::path& path, std::string& error, BlockInfo& info);
  GraphResult RemoveBlock(std::string_view id);
  GraphResult Reorder(const std::vector<std::string>& ids);
  GraphResult SetParam(std::string_view id, std::string_view name, float value);
  // While stopped, the control graph is the source of truth and Prepare()
  // rebuilds the active graph before the device starts.
  void SetPublishingEnabled(bool enabled) noexcept {
    publishing_.store(enabled, std::memory_order_release);
  }
  std::vector<BlockInfo> Snapshot() const;
  std::string NextBlockIdFor(const std::filesystem::path& path) const;
  void CollectRetired() noexcept;

  // Each audio update queue is a single-producer/single-consumer ring with one
  // slot kept empty so that "full" and "empty" differ.
  static constexpr uint32_t kPendingQueueCapacity = 7;

 private:
  using Resampler = dsp::LanczosResampler<float, 1>;
  static constexpr uint32_t kQueueSize = kPendingQueueCapacity + 1;

  struct ParameterChange {
    std::array<char, 257> blockId{};
    std::array<char, 65> name{};
    float value = 0.0f;
    float smoothingTarget = 0.0f;
  };

  GraphResult PublishControlGraph();
  bool PushPending(ModelChain* graph) noexcept;
  ModelChain* PopPending() noexcept;
  bool HasPendingGraphUpdates() const noexcept;
  uint32_t PendingParameterCount() const noexcept;
  bool PushParameterChange(const ParameterChange& change) noexcept;
  bool PopParameterChange(ParameterChange& change) noexcept;
  bool PushRetired(ModelChain* graph) noexcept;
  ModelChain* PopRetired() noexcept;
  bool CanPushRetired() const noexcept;

  std::unique_ptr<ModelChain> controlGraph_;
  std::atomic<ModelChain*> activeGraph_{nullptr};
  std::array<ModelChain*, kQueueSize> pending_{};
  // Parameter records own their text so no caller memory reaches the callback.
  std::array<ParameterChange, kQueueSize> parameterPending_{};
  std::array<ModelChain*, kQueueSize> retired_{};
  alignas(64) std::atomic<uint32_t> pendingWrite_{0};
  alignas(64) std::atomic<uint32_t> pendingRead_{0};
  alignas(64) std::atomic<uint32_t> parameterWrite_{0};
  alignas(64) std::atomic<uint32_t> parameterRead_{0};
  alignas(64) std::atomic<uint32_t> retiredWrite_{0};
  alignas(64) std::atomic<uint32_t> retiredRead_{0};

  double deviceSampleRate_ = 48000.0;
  int maxDeviceFrames_ = 128;
  int maxChainFrames_ = 160;
  std::unique_ptr<Resampler> inputResampler_;
  std::unique_ptr<Resampler> outputResampler_;
  std::vector<float> inputScratch_;
  std::vector<float> chainScratch_;
  std::vector<float> outputScratch_;
  std::array<float*, 1> inputPointers_{};
  std::array<float*, 1> chainPointers_{};
  std::array<float*, 1> outputPointers_{};
  juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> inputGain_;
  juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> masterGain_;
  std::atomic<float> requestedInputGain_{1.0f};
  std::atomic<float> requestedMasterGain_{1.0f};
  float lastInputGain_ = 1.0f;
  float lastMasterGain_ = 1.0f;
  std::atomic<uint64_t> underruns_{0};
  std::atomic<float> inputMeter_{0.0f};
  std::atomic<float> outputMeter_{0.0f};
  std::atomic<bool> publishing_{true};
};
