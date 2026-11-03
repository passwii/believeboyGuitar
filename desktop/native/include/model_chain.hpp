#pragma once

#include <atomic>
#include <filesystem>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_dsp/juce_dsp.h>

struct BlockInfo {
  std::string id;
  std::string kind;
  std::filesystem::path path;
  bool bypassed;
  float inputGainDb;
  float outputGainDb;
  float mix;
};

class AudioBlock {
 public:
  AudioBlock(std::string id, std::string kind, std::filesystem::path path);
  virtual ~AudioBlock() = default;

  virtual void Prepare(double sampleRate, int maxBlockSize);
  virtual void PrepareForClone(double sampleRate, int maxBlockSize) {
    Prepare(sampleRate, maxBlockSize);
  }
  virtual std::unique_ptr<AudioBlock> Clone() const { return nullptr; }
  void Process(juce::AudioBuffer<float>& buffer);
  bool SetParam(std::string_view name, float value);
  bool ApplyParam(std::string_view name, float value, float smoothingTarget) noexcept;
  BlockInfo Info() const;
  std::string_view Id() const noexcept { return id_; }

 protected:
  virtual void ProcessWet(juce::AudioBuffer<float>& buffer) = 0;
  void PrepareBase(double sampleRate, int maxBlockSize, bool resetRuntime);
  void CopySettingsTo(AudioBlock& target) const;
  const std::filesystem::path& SourcePath() const noexcept { return path_; }

 private:
  struct RuntimeState {
    std::atomic<bool> bypassed{false};
    std::atomic<float> inputGainTarget{1.0f};
    std::atomic<float> outputGainTarget{1.0f};
    std::atomic<float> mixTarget{1.0f};
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> inputGain;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> outputGain;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> mix;
    float lastInputGainTarget = 1.0f;
    float lastOutputGainTarget = 1.0f;
    float lastMixTarget = 1.0f;
  };

  std::string id_;
  std::string kind_;
  std::filesystem::path path_;
  std::shared_ptr<RuntimeState> runtime_;
  bool bypassed_ = false;
  float inputGainDb_ = 0.0f;
  float outputGainDb_ = 0.0f;
  float mix_ = 1.0f;
  juce::AudioBuffer<float> dryBuffer_;
};

class ModelChain {
 public:
  void Prepare(double sampleRate, int maxBlockSize);
  std::optional<BlockInfo> AddFile(const std::filesystem::path& path, std::string& error);
  std::string NextBlockIdFor(const std::filesystem::path& path) const;
  void Append(std::unique_ptr<AudioBlock> block);
  bool RemoveBlock(std::string_view id);
  bool Reorder(const std::vector<std::string>& ids);
  bool SetParam(std::string_view id, std::string_view name, float value);
  bool ApplyParam(std::string_view id, std::string_view name, float value,
                  float smoothingTarget) noexcept;
  bool SetBypassed(std::string_view id, bool bypassed);
  bool HasBlock(std::string_view id) const;
  void Process(juce::AudioBuffer<float>& buffer);
  std::vector<BlockInfo> Snapshot() const;
  std::unique_ptr<ModelChain> Clone() const;

 private:
  AudioBlock* Find(std::string_view id) const;

  double sampleRate_ = 48000.0;
  int maxBlockSize_ = 128;
  std::size_t nextId_ = 1;
  std::vector<std::unique_ptr<AudioBlock>> blocks_;
};
