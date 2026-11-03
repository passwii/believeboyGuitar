#pragma once

#include <atomic>
#include <string>
#include <vector>

#include <juce_audio_devices/juce_audio_devices.h>

#include "device_catalog.hpp"
#include "realtime_processor.hpp"

class AudioDeviceHost final : private juce::AudioIODeviceCallback {
 public:
  explicit AudioDeviceHost(RealtimeProcessor& processor);
  ~AudioDeviceHost() override;

  std::vector<AudioDeviceInfo> ListDevices();
  bool Start(const std::string& inputDeviceId, int inputChannel,
             const std::string& outputDeviceId, int bufferSize,
             double& actualSampleRate, int& actualBufferSize, std::string& error);
  void Stop() noexcept;
  bool Running() const noexcept { return running_.load(std::memory_order_acquire); }
  bool DeviceError() const noexcept { return deviceError_.load(std::memory_order_acquire); }
  std::string InputDeviceId() const { return inputDeviceId_; }
  std::string OutputDeviceId() const { return outputDeviceId_; }

 private:
  void audioDeviceIOCallbackWithContext(const float* const* inputChannelData,
                                        int numInputChannels,
                                        float* const* outputChannelData,
                                        int numOutputChannels, int numSamples,
                                        const juce::AudioIODeviceCallbackContext&) override;
  void audioDeviceAboutToStart(juce::AudioIODevice*) override;
  void audioDeviceStopped() override;
  void audioDeviceError(const juce::String&) override;

  RealtimeProcessor& processor_;
  juce::AudioDeviceManager manager_;
  std::atomic<bool> running_{false};
  std::atomic<bool> deviceError_{false};
  bool callbackAttached_ = false;
  std::string inputDeviceId_;
  std::string outputDeviceId_;
  int inputChannel_ = 0;
};
