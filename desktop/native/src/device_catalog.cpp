#include "device_catalog.hpp"

#include <algorithm>
#include <unordered_map>

namespace {

void AppendUnique(std::vector<int>& destination, const std::vector<int>& source) {
  for (const auto value : source)
    if (std::find(destination.begin(), destination.end(), value) == destination.end())
      destination.push_back(value);
}

}  // namespace

std::vector<AudioDeviceInfo> MergeDeviceCatalog(
    const std::vector<AudioDeviceInfo>& inputDevices,
    const std::vector<AudioDeviceInfo>& outputDevices) {
  std::vector<AudioDeviceInfo> merged;
  std::unordered_map<std::string, size_t> indexById;
  indexById.reserve(inputDevices.size() + outputDevices.size());

  const auto append = [&merged, &indexById](const AudioDeviceInfo& endpoint) {
    const auto [found, inserted] = indexById.emplace(endpoint.id, merged.size());
    if (inserted) {
      merged.push_back(endpoint);
      return;
    }

    auto& device = merged[found->second];
    if (device.name.empty())
      device.name = endpoint.name;
    device.inputChannels = std::max(device.inputChannels, endpoint.inputChannels);
    device.outputChannels = std::max(device.outputChannels, endpoint.outputChannels);
    AppendUnique(device.sampleRates, endpoint.sampleRates);
    AppendUnique(device.bufferSizes, endpoint.bufferSizes);
  };

  for (const auto& device : inputDevices)
    append(device);
  for (const auto& device : outputDevices)
    append(device);
  return merged;
}
