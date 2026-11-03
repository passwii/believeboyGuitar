#pragma once

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <string>
#include <system_error>

// Writes a minimal mono 16-bit PCM WAV so the tests can mutate the audio graph
// with cheap impulse-response blocks. Reloading a NAM model costs hundreds of
// milliseconds per prepare, which would dominate the test run.
class ImpulseResponseFixture {
 public:
  ImpulseResponseFixture() {
    path_ = std::filesystem::temp_directory_path() / "guitar_engine_test_ir.wav";
    WriteMonoPcmWav(path_, 48000, 256);
  }

  ~ImpulseResponseFixture() {
    std::error_code ignored;
    std::filesystem::remove(path_, ignored);
  }

  ImpulseResponseFixture(const ImpulseResponseFixture&) = delete;
  ImpulseResponseFixture& operator=(const ImpulseResponseFixture&) = delete;

  const std::string& path() const { return path_; }

 private:
  static void WriteMonoPcmWav(const std::filesystem::path& path, int sampleRate, int frames) {
    const auto dataBytes = static_cast<uint32_t>(frames * 2);
    std::ofstream file(path, std::ios::binary);
    const auto writeU32 = [&file](uint32_t value) {
      const unsigned char bytes[4] = {static_cast<unsigned char>(value & 0xFFu),
                                      static_cast<unsigned char>((value >> 8) & 0xFFu),
                                      static_cast<unsigned char>((value >> 16) & 0xFFu),
                                      static_cast<unsigned char>((value >> 24) & 0xFFu)};
      file.write(reinterpret_cast<const char*>(bytes), 4);
    };
    const auto writeU16 = [&file](uint16_t value) {
      const unsigned char bytes[2] = {static_cast<unsigned char>(value & 0xFFu),
                                      static_cast<unsigned char>((value >> 8) & 0xFFu)};
      file.write(reinterpret_cast<const char*>(bytes), 2);
    };
    file.write("RIFF", 4);
    writeU32(36 + dataBytes);
    file.write("WAVE", 4);
    file.write("fmt ", 4);
    writeU32(16);
    writeU16(1);  // PCM
    writeU16(1);  // mono
    writeU32(static_cast<uint32_t>(sampleRate));
    writeU32(static_cast<uint32_t>(sampleRate * 2));  // byte rate
    writeU16(2);  // block align
    writeU16(16);  // bits per sample
    file.write("data", 4);
    writeU32(dataBytes);
    for (int i = 0; i < frames; ++i)
      writeU16(static_cast<uint16_t>(i % 32 == 0 ? 8000 : 0));
  }

  std::string path_;
};
