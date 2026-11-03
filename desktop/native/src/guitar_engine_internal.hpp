#pragma once

#include <mutex>
#include <string>

#include "audio_device_host.hpp"
#include "realtime_processor.hpp"

// The opaque engine handle.
//
// This definition lives in a header rather than in guitar_engine.cpp so that
// white-box tests can drive the handle's internals. The public ABI in
// include/guitar_engine.h still treats guitar_engine as an opaque type.
//
// Every control-plane field below is protected by controlMutex: the audio
// device host, the processor control graph and lastError. The realtime audio
// callback never acquires that mutex, so a device start or stop may block a
// control call without stalling the audio thread.
struct guitar_engine {
  guitar_engine() {
    // No audio thread runs until a device is started, so graph mutations are
    // only recorded in the control graph until then.
    processor.SetPublishingEnabled(false);
  }

  std::mutex controlMutex;
  RealtimeProcessor processor;
  AudioDeviceHost host{processor};
  std::string lastError;
  int sampleRate = 48000;
  int bufferSize = 128;
  double inputGainDb = 0.0;
  double outputGainDb = 0.0;
};
