#include <gtest/gtest.h>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <memory>
#include <string>
#include <string_view>
#include <utility>
#include "model_chain.hpp"

static void writeLe16(std::ostream& out, uint16_t value) {
  const char bytes[] = {static_cast<char>(value), static_cast<char>(value >> 8)};
  out.write(bytes, sizeof(bytes));
}

static void writeLe32(std::ostream& out, uint32_t value) {
  const char bytes[] = {static_cast<char>(value), static_cast<char>(value >> 8),
                        static_cast<char>(value >> 16), static_cast<char>(value >> 24)};
  out.write(bytes, sizeof(bytes));
}

static void writeImpulseWav(const std::filesystem::path& path) {
  constexpr uint32_t frames = 128;
  constexpr uint32_t dataBytes = frames * 2;
  std::ofstream out(path, std::ios::binary);
  out.write("RIFF", 4); writeLe32(out, 36 + dataBytes); out.write("WAVEfmt ", 8);
  writeLe32(out, 16); writeLe16(out, 1); writeLe16(out, 1); writeLe32(out, 48000);
  writeLe32(out, 96000); writeLe16(out, 2); writeLe16(out, 16);
  out.write("data", 4); writeLe32(out, dataBytes);
  for (uint32_t i = 0; i < frames; ++i) writeLe16(out, i == 0 ? 32767 : 0);
}

class GainBlock final : public AudioBlock {
 public:
  GainBlock(std::string id, float gain) : AudioBlock(std::move(id), "test", {}), gain_(gain) {}
  void Prepare(double sampleRate, int maxBlockSize) override {
    AudioBlock::Prepare(sampleRate, maxBlockSize);
  }
  void ProcessWet(juce::AudioBuffer<float>& buffer) override { buffer.applyGain(gain_); }

 private:
  float gain_;
};

TEST(ModelChainTest, ProcessesEnabledBlocksInOrder) {
  ModelChain chain;
  chain.Append(std::make_unique<GainBlock>("first", 2.0f));
  chain.Append(std::make_unique<GainBlock>("second", 3.0f));
  juce::AudioBuffer<float> buffer(1, 2);
  buffer.setSample(0, 0, 0.1f);
  buffer.setSample(0, 1, -0.2f);
  chain.Prepare(48000.0, 128);
  chain.Process(buffer);
  EXPECT_FLOAT_EQ(buffer.getSample(0, 0), 0.6f);
  EXPECT_FLOAT_EQ(buffer.getSample(0, 1), -1.2f);
}

TEST(ModelChainTest, BypassedBlockDoesNotChangeTheSignal) {
  ModelChain chain;
  chain.Append(std::make_unique<GainBlock>("first", 4.0f));
  chain.Append(std::make_unique<GainBlock>("second", 3.0f));
  ASSERT_TRUE(chain.SetBypassed("first", true));
  juce::AudioBuffer<float> buffer(1, 1);
  buffer.setSample(0, 0, 0.125f);
  chain.Prepare(48000.0, 128);
  chain.Process(buffer);
  EXPECT_FLOAT_EQ(buffer.getSample(0, 0), 0.375f);
}

TEST(ModelChainTest, RejectsOversizedBlocksWithoutChangingTheSignal) {
  ModelChain chain;
  chain.Append(std::make_unique<GainBlock>("gain", 2.0f));
  chain.Prepare(48000.0, 2);
  juce::AudioBuffer<float> buffer(1, 3);
  buffer.setSample(0, 0, 0.125f);
  buffer.setSample(0, 1, -0.25f);
  buffer.setSample(0, 2, 0.5f);

  chain.Process(buffer);

  EXPECT_FLOAT_EQ(buffer.getSample(0, 0), 0.125f);
  EXPECT_FLOAT_EQ(buffer.getSample(0, 1), -0.25f);
  EXPECT_FLOAT_EQ(buffer.getSample(0, 2), 0.5f);
}

TEST(ModelChainTest, AppliesBlockGainAndWetMix) {
  ModelChain chain;
  chain.Append(std::make_unique<GainBlock>("gain", 2.0f));
  ASSERT_TRUE(chain.SetParam("gain", "inputGainDb", 6.0205999f));
  ASSERT_TRUE(chain.SetParam("gain", "mix", 0.5f));
  juce::AudioBuffer<float> buffer(1, 1);
  buffer.setSample(0, 0, 0.25f);
  chain.Prepare(48000.0, 128);
  chain.Process(buffer);
  EXPECT_NEAR(buffer.getSample(0, 0), 0.75f, 1.0e-5f);
}

TEST(ModelChainTest, ReorderChangesSnapshotOrder) {
  ModelChain chain;
  chain.Append(std::make_unique<GainBlock>("first", 2.0f));
  chain.Append(std::make_unique<GainBlock>("second", 3.0f));
  ASSERT_TRUE(chain.Reorder({"second", "first"}));
  const auto blocks = chain.Snapshot();
  ASSERT_EQ(blocks.size(), 2u);
  EXPECT_EQ(blocks[0].id, "second");
  EXPECT_EQ(blocks[1].id, "first");
}

TEST(ModelChainTest, LoadsA2FixtureAndProcessesFiniteAudio) {
  ModelChain chain;
  std::string error;
  auto block = chain.AddFile(NAM_A2_TEST_FIXTURE, error);
  ASSERT_TRUE(block.has_value()) << error;
  chain.Prepare(48000.0, 128);
  juce::AudioBuffer<float> buffer(1, 128);
  for (int i = 0; i < buffer.getNumSamples(); ++i)
    buffer.setSample(0, i, 0.1f * std::sin(2.0 * juce::MathConstants<double>::pi * 110.0 * i / 48000.0));
  chain.Process(buffer);
  bool hasSignal = false;
  for (int i = 0; i < buffer.getNumSamples(); ++i) {
    EXPECT_TRUE(std::isfinite(buffer.getSample(0, i)));
    hasSignal = hasSignal || std::abs(buffer.getSample(0, i)) > 1.0e-6f;
  }
  EXPECT_TRUE(hasSignal);
}

TEST(ModelChainTest, RejectsMissingAndUnsupportedFilesWithoutAddingBlocks) {
  ModelChain chain;
  std::string error;
  EXPECT_FALSE(chain.AddFile("/definitely/missing.nam", error).has_value());
  const auto unsupportedPath = std::filesystem::temp_directory_path() / "guitar-effects-notes.txt";
  const auto corruptPath = std::filesystem::temp_directory_path() / "guitar-effects-corrupt.wav";
  {
    std::ofstream out(unsupportedPath, std::ios::binary);
    out << "not an audio file";
  }
  {
    std::ofstream out(corruptPath, std::ios::binary);
    out << "not a WAV file";
  }
  EXPECT_FALSE(chain.AddFile(unsupportedPath, error).has_value());
  EXPECT_NE(error.find("Unsupported file extension"), std::string::npos);
  EXPECT_FALSE(chain.AddFile(corruptPath, error).has_value());
  EXPECT_NE(error.find("Unable to decode WAV impulse response"), std::string::npos);
  EXPECT_TRUE(chain.Snapshot().empty());
  std::filesystem::remove(unsupportedPath);
  std::filesystem::remove(corruptPath);
}

TEST(ModelChainTest, LoadsWavImpulseResponseFromOriginalPath) {
  const auto path = std::filesystem::temp_directory_path() / "guitar-effects-test-ir.wav";
  writeImpulseWav(path);
  ModelChain chain;
  std::string error;
  const auto block = chain.AddFile(path, error);
  ASSERT_TRUE(block.has_value()) << error;
  EXPECT_EQ(block->kind, "ir");
  EXPECT_EQ(block->path, path);
  chain.Prepare(48000.0, 128);
  bool hasSignal = false;
  for (int blockIndex = 0; blockIndex < 16; ++blockIndex) {
    juce::AudioBuffer<float> buffer(1, 128);
    buffer.clear();
    if (blockIndex == 0)
      buffer.setSample(0, 0, 0.25f);
    chain.Process(buffer);
    for (int i = 0; i < buffer.getNumSamples(); ++i) {
      EXPECT_TRUE(std::isfinite(buffer.getSample(0, i)));
      hasSignal = hasSignal || std::abs(buffer.getSample(0, i)) > 1.0e-6f;
    }
  }
  EXPECT_TRUE(hasSignal);
  std::filesystem::remove(path);
}
