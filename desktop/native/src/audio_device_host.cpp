#include "audio_device_host.hpp"

#include <algorithm>
#include <cmath>

namespace {

std::string DeviceId(const juce::String& type, const juce::String& name) {
  return type.toStdString() + ":" + name.toStdString();
}

// juce::AudioIODeviceType::createDevice takes the output device name first
// and the input device name second. Passing an empty name for one direction
// yields a probe that only exposes the other direction's channels, which is
// how each endpoint is enumerated independently below.
std::unique_ptr<juce::AudioIODevice> CreateOutputOnlyProbe(
    juce::AudioIODeviceType* type, const juce::String& name) {
  return std::unique_ptr<juce::AudioIODevice>(type->createDevice(name, {}));
}

std::unique_ptr<juce::AudioIODevice> CreateInputOnlyProbe(
    juce::AudioIODeviceType* type, const juce::String& name) {
  return std::unique_ptr<juce::AudioIODevice>(type->createDevice({}, name));
}

bool SplitDeviceId(const std::string& id, std::string& type, std::string& name) {
  const auto separator = id.find(':');
  if (separator == std::string::npos)
    return false;
  type = id.substr(0, separator);
  name = id.substr(separator + 1);
  return !type.empty() && !name.empty();
}

}  // namespace

AudioDeviceHost::AudioDeviceHost(RealtimeProcessor& processor) : processor_(processor) {}

AudioDeviceHost::~AudioDeviceHost() { Stop(); }

std::vector<AudioDeviceInfo> AudioDeviceHost::ListDevices() {
  std::vector<AudioDeviceInfo> inputs;
  std::vector<AudioDeviceInfo> outputs;
  auto& types = manager_.getAvailableDeviceTypes();
  for (auto* type : types) {
    type->scanForDevices();
    for (const auto& name : type->getDeviceNames(true)) {
      auto device = CreateInputOnlyProbe(type, name);
      if (!device)
        continue;
      AudioDeviceInfo info;
      info.id = DeviceId(type->getTypeName(), name);
      info.name = name.toStdString();
      info.inputChannels = device->getInputChannelNames().size();
      for (const auto rate : device->getAvailableSampleRates())
        info.sampleRates.push_back(static_cast<int>(std::llround(rate)));
      for (const auto size : device->getAvailableBufferSizes())
        info.bufferSizes.push_back(size);
      inputs.push_back(std::move(info));
    }
    for (const auto& name : type->getDeviceNames(false)) {
      auto device = CreateOutputOnlyProbe(type, name);
      if (!device)
        continue;
      AudioDeviceInfo info;
      info.id = DeviceId(type->getTypeName(), name);
      info.name = name.toStdString();
      info.outputChannels = device->getOutputChannelNames().size();
      for (const auto rate : device->getAvailableSampleRates())
        info.sampleRates.push_back(static_cast<int>(std::llround(rate)));
      for (const auto size : device->getAvailableBufferSizes())
        info.bufferSizes.push_back(size);
      outputs.push_back(std::move(info));
    }
  }
  return MergeDeviceCatalog(inputs, outputs);
}

bool AudioDeviceHost::Start(const std::string& inputDeviceId, int inputChannel,
                            const std::string& outputDeviceId, int bufferSize,
                            double& actualSampleRate, int& actualBufferSize,
                            std::string& error) {
  Stop();
  deviceError_.store(false, std::memory_order_release);
  std::string inputType, inputName, outputType, outputName;
  if (!SplitDeviceId(inputDeviceId, inputType, inputName) ||
      !SplitDeviceId(outputDeviceId, outputType, outputName) || inputChannel < 0 ||
      bufferSize < 0) {
    error = "Invalid audio device configuration";
    return false;
  }

  auto& types = manager_.getAvailableDeviceTypes();
  auto findType = [&types](const std::string& wanted) -> juce::AudioIODeviceType* {
    for (auto* type : types)
      if (type->getTypeName().toStdString() == wanted)
        return type;
    return nullptr;
  };
  auto* inType = findType(inputType);
  auto* outType = findType(outputType);
  if (inType == nullptr || outType == nullptr) {
    error = "Requested audio device is unavailable";
    return false;
  }
  if (inputType != outputType) {
    error = "Input and output devices must use the same JUCE device type";
    return false;
  }

  std::unique_ptr<juce::AudioIODevice> probe(inType->createDevice(outputName, inputName));
  if (!probe) {
    error = "Unable to find the requested input/output device pair";
    return false;
  }
  if (inputChannel >= probe->getInputChannelNames().size() ||
      probe->getOutputChannelNames().size() < 2) {
    error = "The device lacks the requested mono input or stereo output channels";
    return false;
  }
  const auto rates = probe->getAvailableSampleRates();
  double requestedRate = 48000.0;
  if (!rates.contains(requestedRate))
    requestedRate = rates.isEmpty() ? 48000.0 : rates.getFirst();
  const auto buffers = probe->getAvailableBufferSizes();
  int requestedBuffer = bufferSize > 0 ? bufferSize : 128;
  if (!buffers.contains(requestedBuffer))
    requestedBuffer = probe->getDefaultBufferSize();
  probe.reset();

  manager_.setCurrentAudioDeviceType(inputType, true);
  const auto initError = manager_.initialise(0, 0, nullptr, false);
  if (initError.isNotEmpty()) {
    error = initError.toStdString();
    return false;
  }
  juce::AudioDeviceManager::AudioDeviceSetup setup;
  setup.inputDeviceName = inputName;
  setup.outputDeviceName = outputName;
  setup.sampleRate = requestedRate;
  setup.bufferSize = requestedBuffer;
  setup.useDefaultInputChannels = false;
  setup.inputChannels.setBit(inputChannel);
  setup.useDefaultOutputChannels = false;
  setup.outputChannels.setBit(0);
  setup.outputChannels.setBit(1);
  const auto openError = manager_.setAudioDeviceSetup(setup, true);
  auto* device = manager_.getCurrentAudioDevice();
  if (openError.isNotEmpty() || device == nullptr) {
    error = openError.isNotEmpty() ? openError.toStdString() : "Unable to open audio device";
    manager_.closeAudioDevice();
    return false;
  }
  actualSampleRate = device->getCurrentSampleRate();
  actualBufferSize = device->getCurrentBufferSizeSamples();
  if (!processor_.Prepare(actualSampleRate, actualBufferSize)) {
    error = "Audio device negotiated an unsupported sample rate or buffer size";
    manager_.closeAudioDevice();
    return false;
  }
  inputChannel_ = inputChannel;
  inputDeviceId_ = inputDeviceId;
  outputDeviceId_ = outputDeviceId;
  manager_.addAudioCallback(this);
  callbackAttached_ = true;
  deviceError_.store(false, std::memory_order_release);
  running_.store(true, std::memory_order_release);
  error.clear();
  return true;
}

void AudioDeviceHost::Stop() noexcept {
  if (callbackAttached_) {
    manager_.removeAudioCallback(this);
    callbackAttached_ = false;
    running_.store(false, std::memory_order_release);
  }
  manager_.closeAudioDevice();
}

void AudioDeviceHost::audioDeviceIOCallbackWithContext(
    const float* const* inputChannelData, int numInputChannels,
    float* const* outputChannelData, int numOutputChannels, int numSamples,
    const juce::AudioIODeviceCallbackContext&) {
  // This runs on the realtime audio thread. It must never take the engine
  // control mutex: the control thread may hold that mutex while opening or
  // closing a device, and blocking the audio thread would glitch the stream.
  const float* input = inputChannel_ < numInputChannels ? inputChannelData[inputChannel_] : nullptr;
  float* left = numOutputChannels > 0 ? outputChannelData[0] : nullptr;
  float* right = numOutputChannels > 1 ? outputChannelData[1] : nullptr;
  processor_.Process(input, left, right, numSamples);
  for (int channel = 0; channel < numOutputChannels; ++channel) {
    if (channel != 0 && channel != 1 && outputChannelData[channel] != nullptr)
      std::fill_n(outputChannelData[channel], numSamples, 0.0f);
  }
}

void AudioDeviceHost::audioDeviceAboutToStart(juce::AudioIODevice*) {}

void AudioDeviceHost::audioDeviceStopped() { running_.store(false, std::memory_order_release); }

void AudioDeviceHost::audioDeviceError(const juce::String&) {
  deviceError_.store(true, std::memory_order_release);
  running_.store(false, std::memory_order_release);
}
