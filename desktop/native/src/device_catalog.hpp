#pragma once

#include <string>
#include <vector>

struct AudioDeviceInfo {
  std::string id;
  std::string name;
  int inputChannels = 0;
  int outputChannels = 0;
  std::vector<int> sampleRates;
  std::vector<int> bufferSizes;
};

std::vector<AudioDeviceInfo> MergeDeviceCatalog(
    const std::vector<AudioDeviceInfo>& inputDevices,
    const std::vector<AudioDeviceInfo>& outputDevices);
