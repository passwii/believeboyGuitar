#include "guitar_engine.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <filesystem>
#include <limits>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <vector>

#include <json.hpp>

#include "audio_device_host.hpp"
#include "guitar_engine_internal.hpp"

namespace {

using Json = nlohmann::json;
constexpr size_t kMaxPathLength = 4096;
constexpr size_t kMaxIdentifierLength = 256;

int CopyOut(const std::string& value, char* output, size_t capacity, size_t* written) {
  const size_t required = value.size() + 1;
  if (written == nullptr || output == nullptr)
    return GE_INVALID_ARGUMENT;
  *written = required;
  if (capacity < required)
    return GE_BUFFER_TOO_SMALL;
  std::copy(value.begin(), value.end(), output);
  output[value.size()] = '\0';
  return GE_OK;
}

int NullEngine(const guitar_engine* engine) {
  return engine == nullptr ? GE_INVALID_ARGUMENT : GE_OK;
}

// Records the failure message. The caller must already hold
// engine->controlMutex.
void SetErrorLocked(guitar_engine* engine, std::string_view message) noexcept {
  if (engine == nullptr)
    return;
  try {
    engine->lastError.assign(message);
  } catch (...) {
  }
}

// Records the failure message. Acquires engine->controlMutex, so it must not
// be called from a scope that already holds that mutex. It is the only safe
// way to write lastError from an exception handler, because the lock guard
// of a locked try block has already been unwound when the handler runs.
void SetError(guitar_engine* engine, std::string_view message) noexcept {
  if (engine == nullptr)
    return;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    SetErrorLocked(engine, message);
  } catch (...) {
  }
}

// Stops the device and records the failure under a single critical section so
// that no other ABI call can observe a half-failed start.
void AbortStart(guitar_engine* engine, std::string_view message) noexcept {
  if (engine == nullptr)
    return;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    engine->host.Stop();
    engine->processor.SetPublishingEnabled(false);
    SetErrorLocked(engine, message);
  } catch (...) {
  }
}

// Maps the outcome of a control-graph mutation onto the public result codes.
// Busy is the only code that reports a temporary condition: the request was
// valid but the bounded queue could not take it.
int GraphResultCode(GraphResult result) {
  switch (result) {
    case GraphResult::Ok:
      return GE_OK;
    case GraphResult::Invalid:
      return GE_INVALID_ARGUMENT;
    case GraphResult::NotFound:
      return GE_BLOCK_NOT_FOUND;
    case GraphResult::LoadFailed:
      return GE_MODEL_LOAD_FAILED;
    case GraphResult::Busy:
      return GE_BUSY;
    case GraphResult::Internal:
      break;
  }
  return GE_INTERNAL_ERROR;
}

// Picks the message reported for a failed graph mutation.
std::string_view GraphFailureMessage(GraphResult result, const std::string& detail) {
  if (!detail.empty())
    return detail;
  switch (result) {
    case GraphResult::Busy:
      return kUpdateQueueFullMessage;
    case GraphResult::Invalid:
      return "Invalid audio graph mutation";
    case GraphResult::NotFound:
      return "Audio block not found";
    case GraphResult::LoadFailed:
      return "Unable to load the audio model";
    case GraphResult::Ok:
    case GraphResult::Internal:
      break;
  }
  return "Unable to update the audio graph";
}

bool ValidText(const char* text, size_t maxLength, std::string& value) {
  if (text == nullptr)
    return false;
  size_t length = 0;
  while (length <= maxLength && text[length] != '\0')
    ++length;
  if (length == 0 || length > maxLength)
    return false;
  value.assign(text, length);
  return true;
}

float MeterDb(float value) {
  return value > 0.0f ? 20.0f * std::log10(value) : -120.0f;
}

Json BlockJson(const BlockInfo& block) {
  return Json{{"id", block.id},
              {"kind", block.kind},
              {"path", block.path.string()},
              {"bypassed", block.bypassed},
              {"inputGainDb", block.inputGainDb},
              {"outputGainDb", block.outputGainDb},
              {"mix", block.mix}};
}

}  // namespace

extern "C" {

uint32_t guitar_engine_abi_version(void) { return 1; }

guitar_engine* guitar_engine_create(void) {
  try {
    return new guitar_engine();
  } catch (...) {
    return nullptr;
  }
}

// The caller owns the handle until this call returns: destroy must not
// overlap with any other call on the same engine, and the handle must not be
// used afterwards.
void guitar_engine_destroy(guitar_engine* engine) {
  if (engine == nullptr)
    return;
  try {
    {
      std::lock_guard<std::mutex> lock(engine->controlMutex);
      engine->host.Stop();
      engine->processor.SetPublishingEnabled(false);
      engine->processor.CollectRetired();
    }
    delete engine;
  } catch (...) {
  }
}

int guitar_engine_list_devices(guitar_engine* engine, char* json_out,
                               size_t capacity, size_t* written) {
  if (NullEngine(engine) != GE_OK || json_out == nullptr || written == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    Json devices = Json::array();
    for (const auto& device : engine->host.ListDevices()) {
      devices.push_back({{"id", device.id},
                         {"name", device.name},
                         {"inputChannels", device.inputChannels},
                         {"outputChannels", device.outputChannels},
                         {"sampleRates", device.sampleRates},
                         {"bufferSizes", device.bufferSizes}});
    }
    return CopyOut(devices.dump(), json_out, capacity, written);
  } catch (...) {
    SetError(engine, "Unable to enumerate audio devices");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_start(guitar_engine* engine, const char* input_device_id,
                        int input_channel, const char* output_device_id,
                        int buffer_size) {
  if (NullEngine(engine) != GE_OK || input_channel < 0 || buffer_size < 0)
    return GE_INVALID_ARGUMENT;
  if (input_device_id == nullptr || output_device_id == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    engine->processor.SetPublishingEnabled(false);
    std::string inputId, outputId;
    if (!ValidText(input_device_id, kMaxIdentifierLength, inputId) ||
        !ValidText(output_device_id, kMaxIdentifierLength, outputId))
      return GE_INVALID_ARGUMENT;
    double sampleRate = 0.0;
    int actualBuffer = 0;
    std::string error;
    if (!engine->host.Start(inputId, input_channel, outputId, buffer_size,
                            sampleRate, actualBuffer, error)) {
      SetErrorLocked(engine, error);
      return GE_DEVICE_OPEN_FAILED;
    }
    engine->sampleRate = static_cast<int>(std::llround(sampleRate));
    engine->bufferSize = actualBuffer;
    engine->processor.SetPublishingEnabled(true);
    engine->lastError.clear();
    return GE_OK;
  } catch (const std::exception& error) {
    AbortStart(engine, error.what());
    return GE_DEVICE_OPEN_FAILED;
  } catch (...) {
    AbortStart(engine, "Unknown audio device error");
    return GE_DEVICE_OPEN_FAILED;
  }
}

int guitar_engine_stop(guitar_engine* engine) {
  if (engine == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    engine->host.Stop();
    engine->processor.SetPublishingEnabled(false);
    engine->processor.CollectRetired();
    return GE_OK;
  } catch (...) {
    SetError(engine, "Unable to stop audio device");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_set_input_gain(guitar_engine* engine, double gain_db) {
  if (NullEngine(engine) != GE_OK || !std::isfinite(gain_db))
    return GE_INVALID_ARGUMENT;
  const double linear = std::pow(10.0, gain_db / 20.0);
  if (!std::isfinite(linear) || !std::isfinite(static_cast<float>(linear)))
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    engine->processor.SetInputGainDb(gain_db);
    engine->inputGainDb = gain_db;
    return GE_OK;
  } catch (...) {
    SetError(engine, "Unable to set input gain");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_set_master_gain(guitar_engine* engine, double gain_db) {
  if (NullEngine(engine) != GE_OK || !std::isfinite(gain_db))
    return GE_INVALID_ARGUMENT;
  const double linear = std::pow(10.0, gain_db / 20.0);
  if (!std::isfinite(linear) || !std::isfinite(static_cast<float>(linear)))
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    engine->processor.SetMasterGainDb(gain_db);
    engine->outputGainDb = gain_db;
    return GE_OK;
  } catch (...) {
    SetError(engine, "Unable to set master gain");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_add_file(guitar_engine* engine, const char* path,
                           char* block_id_out, size_t capacity, size_t* written) {
  if (NullEngine(engine) != GE_OK || path == nullptr || block_id_out == nullptr || written == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    size_t length = 0;
    while (length <= kMaxPathLength && path[length] != '\0')
      ++length;
    if (length == 0 || length > kMaxPathLength)
      return GE_INVALID_ARGUMENT;
    std::string filePath(path, length);
    auto extension = std::filesystem::path(filePath).extension().string();
    std::transform(extension.begin(), extension.end(), extension.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (extension == ".nam" || extension == ".wav") {
      const auto id = engine->processor.NextBlockIdFor(filePath);
      *written = id.size() + 1;
      if (capacity < *written)
        return GE_BUFFER_TOO_SMALL;
    }
    std::string error;
    BlockInfo info;
    const auto result = engine->processor.AddFile(std::filesystem::path(filePath), error, info);
    if (result != GraphResult::Ok) {
      SetErrorLocked(engine, GraphFailureMessage(result, error));
      return GraphResultCode(result);
    }
    engine->lastError.clear();
    return CopyOut(info.id, block_id_out, capacity, written);
  } catch (const std::exception& error) {
    SetError(engine, error.what());
    return GE_MODEL_LOAD_FAILED;
  } catch (...) {
    SetError(engine, "Unknown model loading error");
    return GE_MODEL_LOAD_FAILED;
  }
}

int guitar_engine_remove_block(guitar_engine* engine, const char* block_id) {
  if (NullEngine(engine) != GE_OK)
    return GE_INVALID_ARGUMENT;
  if (block_id == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    std::string id;
    if (!ValidText(block_id, kMaxIdentifierLength, id))
      return GE_INVALID_ARGUMENT;
    const auto result = engine->processor.RemoveBlock(id);
    if (result != GraphResult::Ok) {
      SetErrorLocked(engine, GraphFailureMessage(result, {}));
      return GraphResultCode(result);
    }
    engine->processor.CollectRetired();
    engine->lastError.clear();
    return GE_OK;
  } catch (...) {
    SetError(engine, "Unable to remove audio block");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_reorder(guitar_engine* engine, const char* block_ids_json) {
  if (NullEngine(engine) != GE_OK || block_ids_json == nullptr)
    return GE_INVALID_ARGUMENT;
  // The id list is parsed before the control mutex is taken: parsing is pure
  // work on caller-owned data and does not belong in the critical section.
  // Keeping it outside the locked scope also means that the malformed-input
  // path below is reached without the mutex held, so its error message is
  // written with SetError, which takes the mutex itself.
  std::vector<std::string> ids;
  try {
    const auto parsed = Json::parse(block_ids_json);
    if (!parsed.is_array())
      return GE_INVALID_ARGUMENT;
    ids.reserve(parsed.size());
    for (const auto& item : parsed) {
      if (!item.is_string())
        return GE_INVALID_ARGUMENT;
      auto id = item.get<std::string>();
      if (id.empty() || id.size() > kMaxIdentifierLength)
        return GE_INVALID_ARGUMENT;
      ids.push_back(std::move(id));
    }
  } catch (const nlohmann::json::exception&) {
    SetError(engine, "Malformed audio block id list");
    return GE_INVALID_ARGUMENT;
  } catch (...) {
    SetError(engine, "Unable to reorder audio blocks");
    return GE_INTERNAL_ERROR;
  }
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    const auto result = engine->processor.Reorder(ids);
    if (result != GraphResult::Ok) {
      SetErrorLocked(engine, GraphFailureMessage(result, {}));
      return GraphResultCode(result);
    }
    engine->processor.CollectRetired();
    engine->lastError.clear();
    return GE_OK;
  } catch (...) {
    SetError(engine, "Unable to reorder audio blocks");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_set_param(guitar_engine* engine, const char* block_id,
                            const char* name, double value) {
  if (NullEngine(engine) != GE_OK || !std::isfinite(value))
    return GE_INVALID_ARGUMENT;
  if (block_id == nullptr || name == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    std::string id, parameter;
    if (!ValidText(block_id, kMaxIdentifierLength, id) ||
        !ValidText(name, 64, parameter))
      return GE_INVALID_ARGUMENT;
    if (parameter != "bypassed" && parameter != "inputGainDb" &&
        parameter != "outputGainDb" && parameter != "mix")
      return GE_INVALID_PARAMETER;
    if (parameter == "bypassed" && value != 0.0 && value != 1.0)
      return GE_INVALID_PARAMETER;
    const float floatValue = static_cast<float>(value);
    if (!std::isfinite(floatValue))
      return GE_INVALID_PARAMETER;
    if ((parameter == "inputGainDb" || parameter == "outputGainDb") &&
        !std::isfinite(std::pow(10.0f, floatValue / 20.0f)))
      return GE_INVALID_PARAMETER;
    const auto result = engine->processor.SetParam(id, parameter, floatValue);
    if (result != GraphResult::Ok) {
      SetErrorLocked(engine, GraphFailureMessage(result, {}));
      if (result == GraphResult::Invalid)
        return GE_INVALID_PARAMETER;
      return GraphResultCode(result);
    }
    engine->processor.CollectRetired();
    engine->lastError.clear();
    return GE_OK;
  } catch (...) {
    SetError(engine, "Unable to set audio parameter");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_snapshot(guitar_engine* engine, char* json_out,
                           size_t capacity, size_t* written) {
  if (NullEngine(engine) != GE_OK || json_out == nullptr || written == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    Json blocks = Json::array();
    for (const auto& block : engine->processor.Snapshot())
      blocks.push_back(BlockJson(block));
    const auto lastError = engine->host.DeviceError()
                               ? std::string("Audio device reported an error")
                               : engine->lastError;
    Json snapshot{{"running", engine->host.Running()},
                  {"inputDeviceId", engine->host.InputDeviceId()},
                  {"outputDeviceId", engine->host.OutputDeviceId()},
                  {"sampleRate", engine->sampleRate},
                  {"bufferSize", engine->bufferSize},
                  {"inputGainDb", engine->inputGainDb},
                  {"outputGainDb", engine->outputGainDb},
                  {"blocks", std::move(blocks)},
                  {"inputMeterDb", MeterDb(engine->processor.InputMeter())},
                  {"outputMeterDb", MeterDb(engine->processor.OutputMeter())},
                  {"underruns", engine->processor.Underruns()},
                  {"lastError", lastError}};
    return CopyOut(snapshot.dump(), json_out, capacity, written);
  } catch (...) {
    SetError(engine, "Unable to create engine snapshot");
    return GE_INTERNAL_ERROR;
  }
}

int guitar_engine_last_error(guitar_engine* engine, char* text_out,
                             size_t capacity, size_t* written) {
  if (NullEngine(engine) != GE_OK || text_out == nullptr || written == nullptr)
    return GE_INVALID_ARGUMENT;
  try {
    std::lock_guard<std::mutex> lock(engine->controlMutex);
    const auto lastError = engine->host.DeviceError()
                               ? std::string("Audio device reported an error")
                               : engine->lastError;
    return CopyOut(lastError, text_out, capacity, written);
  } catch (...) {
    SetError(engine, "Unable to read the last error message");
    return GE_INTERNAL_ERROR;
  }
}

}  // extern "C"
