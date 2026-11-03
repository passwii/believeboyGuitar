#include <array>
#include <atomic>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <limits>
#include <set>
#include <string>
#include <thread>
#include <vector>

#include <gtest/gtest.h>
#include <json.hpp>

#include "guitar_engine.h"

namespace {

// Writes a minimal mono 16-bit PCM WAV so the concurrency tests can mutate the
// audio graph with cheap impulse-response blocks. Reloading a NAM model costs
// hundreds of milliseconds per prepare, which would dominate the test run.
class ImpulseResponseFixture {
 public:
  ImpulseResponseFixture() {
    path_ = std::filesystem::temp_directory_path() / "guitar_engine_abi_test_ir.wav";
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

// Returns the block ids reported by a snapshot document.
std::vector<std::string> BlockIdsOf(const std::string& snapshot) {
  std::vector<std::string> ids;
  const auto parsed = nlohmann::json::parse(snapshot);
  for (const auto& block : parsed.at("blocks"))
    ids.push_back(block.at("id").get<std::string>());
  return ids;
}

bool HasDuplicateIds(const std::vector<std::string>& ids) {
  std::set<std::string> seen;
  for (const auto& id : ids)
    if (!seen.insert(id).second)
      return true;
  return false;
}

}  // namespace

TEST(GuitarEngineAbiTest, CreatesStoppedEngineWithEmptyChain) {
  ASSERT_EQ(guitar_engine_abi_version(), 1u);
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  std::array<char, 4096> json{};
  size_t written = 0;
  guitar_engine_destroy(nullptr);
  ASSERT_EQ(guitar_engine_snapshot(engine, json.data(), json.size(), &written), GE_OK);
  ASSERT_GT(written, 0u);
  const std::string state(json.data(), written - 1);
  EXPECT_NE(state.find("\"running\":false"), std::string::npos);
  EXPECT_NE(state.find("\"sampleRate\":48000"), std::string::npos);
  EXPECT_NE(state.find("\"bufferSize\":128"), std::string::npos);
  EXPECT_NE(state.find("\"blocks\":[]"), std::string::npos);
  EXPECT_EQ(guitar_engine_stop(engine), GE_OK);
  guitar_engine_destroy(engine);
}

TEST(GuitarEngineAbiTest, ReportsExactRequiredSizeWithoutPartialJson) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  std::array<char, 1> output{'x'};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_snapshot(engine, output.data(), output.size(), &written),
            GE_BUFFER_TOO_SMALL);
  EXPECT_GT(written, output.size());
  EXPECT_EQ(output[0], 'x');

  std::array<char, 4096> complete{};
  size_t completeSize = 0;
  ASSERT_EQ(guitar_engine_snapshot(engine, complete.data(), complete.size(), &completeSize), GE_OK);
  EXPECT_EQ(written, completeSize);
  guitar_engine_destroy(engine);
}

TEST(GuitarEngineAbiTest, ValidatesArgumentsAndStoresControlGains) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  EXPECT_EQ(guitar_engine_snapshot(nullptr, nullptr, 0, nullptr), GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_set_input_gain(engine, std::numeric_limits<double>::infinity()),
            GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_set_master_gain(engine, -6.0), GE_OK);
  EXPECT_EQ(guitar_engine_set_input_gain(engine, 3.0), GE_OK);
  EXPECT_EQ(guitar_engine_set_param(engine, "block", "unsupported", 1.0), GE_INVALID_PARAMETER);

  std::array<char, 4096> json{};
  size_t written = 0;
  ASSERT_EQ(guitar_engine_snapshot(engine, json.data(), json.size(), &written), GE_OK);
  const std::string state(json.data(), written - 1);
  EXPECT_NE(state.find("\"inputGainDb\":3.0"), std::string::npos);
  EXPECT_NE(state.find("\"outputGainDb\":-6.0"), std::string::npos);
  EXPECT_NE(state.find("\"running\":false"), std::string::npos);
  guitar_engine_destroy(engine);
}

TEST(GuitarEngineAbiTest, SmallBlockIdBufferDoesNotChangeTheChain) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  std::array<char, 1> blockId{'x'};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_add_file(engine, NAM_A2_TEST_FIXTURE, blockId.data(),
                                   blockId.size(), &written),
            GE_BUFFER_TOO_SMALL);
  EXPECT_EQ(written, std::string("nam-1").size() + 1);
  EXPECT_EQ(blockId[0], 'x');

  std::array<char, 4096> json{};
  size_t jsonSize = 0;
  ASSERT_EQ(guitar_engine_snapshot(engine, json.data(), json.size(), &jsonSize), GE_OK);
  EXPECT_NE(std::string(json.data(), jsonSize - 1).find("\"blocks\":[]"),
            std::string::npos);
  guitar_engine_destroy(engine);
}

TEST(GuitarEngineAbiTest, RejectsMalformedBlockIdList) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  ImpulseResponseFixture fixture;

  // A malformed document is rejected and reports the parse failure.
  EXPECT_EQ(guitar_engine_reorder(engine, nullptr), GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_reorder(engine, "not json"), GE_INVALID_ARGUMENT);

  std::array<char, 512> text{};
  size_t written = 0;
  ASSERT_EQ(guitar_engine_last_error(engine, text.data(), text.size(), &written), GE_OK);
  ASSERT_GT(written, 0u);
  EXPECT_EQ(std::string(text.data(), written - 1), "Malformed audio block id list");

  // A well formed document with the wrong shape is rejected as well, but it
  // is not a malformed document, so it does not report a parse failure.
  EXPECT_EQ(guitar_engine_reorder(engine, "{}"), GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_reorder(engine, "[1, 2]"), GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_reorder(engine, "[\"\"]"), GE_INVALID_ARGUMENT);

  // A valid list still reorders the chain and clears the reported error.
  std::array<char, 64> id{};
  size_t idSize = 0;
  ASSERT_EQ(guitar_engine_add_file(engine, fixture.path().c_str(), id.data(), id.size(),
                                   &idSize),
            GE_OK);
  const std::string blockId(id.data(), idSize - 1);
  const std::string list = "[\"" + blockId + "\"]";
  EXPECT_EQ(guitar_engine_reorder(engine, list.c_str()), GE_OK);
  ASSERT_EQ(guitar_engine_last_error(engine, text.data(), text.size(), &written), GE_OK);
  ASSERT_GT(written, 0u);
  EXPECT_EQ(std::string(text.data(), written - 1), std::string());
  guitar_engine_destroy(engine);
}

TEST(GuitarEngineAbiTest, SerializesConcurrentControlSettersAndSnapshots) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  ImpulseResponseFixture fixture;
  std::atomic<bool> start{false};
  std::atomic<bool> controlDone{false};
  std::atomic<int> snapshots{0};
  std::atomic<int> failures{0};
  int addResult = GE_INTERNAL_ERROR;

  std::thread control([&] {
    while (!start.load(std::memory_order_acquire)) {}
    std::array<char, 64> id{};
    size_t written = 0;
    addResult = guitar_engine_add_file(engine, fixture.path().c_str(), id.data(), id.size(),
                                       &written);
    for (int i = 0; i < 100; ++i) {
      if (guitar_engine_set_input_gain(engine, static_cast<double>(i % 12) - 6.0) != GE_OK ||
          guitar_engine_set_master_gain(engine, -static_cast<double>(i % 18)) != GE_OK)
        failures.fetch_add(1, std::memory_order_relaxed);
    }
    controlDone.store(true, std::memory_order_release);
  });
  std::thread reader([&] {
    while (!start.load(std::memory_order_acquire)) {}
    for (int i = 0; i < 2000 || !controlDone.load(std::memory_order_acquire); ++i) {
      std::array<char, 4096> json{};
      size_t written = 0;
      if (guitar_engine_snapshot(engine, json.data(), json.size(), &written) != GE_OK ||
          written == 0 || json[written - 1] != '\0') {
        failures.fetch_add(1, std::memory_order_relaxed);
      } else {
        snapshots.fetch_add(1, std::memory_order_relaxed);
      }
    }
  });
  start.store(true, std::memory_order_release);
  control.join();
  reader.join();

  EXPECT_EQ(addResult, GE_OK);
  EXPECT_GE(snapshots.load(std::memory_order_relaxed), 2000);
  EXPECT_EQ(failures.load(std::memory_order_relaxed), 0);
  guitar_engine_destroy(engine);
}

TEST(GuitarEngineAbiTest, ConcurrentGraphMutationsStaySerialized) {
  ImpulseResponseFixture fixture;

  // Several threads append a block at the same time while other threads keep
  // polling the snapshot. Without the engine mutex the appends race on the
  // control graph's block id counter and block vector, so the chain ends up
  // with duplicate ids, a lost block, or a torn snapshot. Each round uses a
  // fresh engine so a single collision cannot mask the next round.
  constexpr int kRounds = 3;
  constexpr int kWriters = 12;
  constexpr int kReaders = 2;
  constexpr int kReadsPerReader = 400;
  constexpr int kMalformers = 2;
  constexpr int kReordersPerMalformer = 200;

  for (int round = 0; round < kRounds; ++round) {
    auto* engine = guitar_engine_create();
    ASSERT_NE(engine, nullptr);

    std::atomic<bool> start{false};
    std::atomic<int> addedBlocks{0};
    std::atomic<int> failures{0};
    std::atomic<int> duplicateIds{0};
    std::atomic<int> snapshots{0};
    std::atomic<int> malformedReorders{0};
    std::vector<std::thread> threads;

    for (int writer = 0; writer < kWriters; ++writer) {
      threads.emplace_back([&] {
        while (!start.load(std::memory_order_acquire)) {
        }
        std::array<char, 64> id{};
        size_t written = 0;
        if (guitar_engine_add_file(engine, fixture.path().c_str(), id.data(), id.size(),
                                   &written) != GE_OK ||
            written == 0 || written > id.size() || id[written - 1] != '\0') {
          failures.fetch_add(1, std::memory_order_relaxed);
          return;
        }
        addedBlocks.fetch_add(1, std::memory_order_relaxed);
      });
    }

    for (int reader = 0; reader < kReaders; ++reader) {
      threads.emplace_back([&] {
        while (!start.load(std::memory_order_acquire)) {
        }
        for (int i = 0; i < kReadsPerReader; ++i) {
          std::array<char, 8192> json{};
          size_t written = 0;
          if (guitar_engine_snapshot(engine, json.data(), json.size(), &written) != GE_OK ||
              written == 0 || written > json.size() || json[written - 1] != '\0') {
            failures.fetch_add(1, std::memory_order_relaxed);
            continue;
          }
          std::vector<std::string> ids;
          try {
            ids = BlockIdsOf(std::string(json.data(), written - 1));
          } catch (const std::exception&) {
            failures.fetch_add(1, std::memory_order_relaxed);
            continue;
          }
          if (HasDuplicateIds(ids))
            duplicateIds.fetch_add(1, std::memory_order_relaxed);
          snapshots.fetch_add(1, std::memory_order_relaxed);
        }
      });
    }

    // The malformed reorder path records an error message. It runs next to
    // the snapshot readers so that the error write and the snapshot reads
    // contend for the same control mutex.
    for (int malformer = 0; malformer < kMalformers; ++malformer) {
      threads.emplace_back([&] {
        while (!start.load(std::memory_order_acquire)) {
        }
        for (int i = 0; i < kReordersPerMalformer; ++i) {
          if (guitar_engine_reorder(engine, "not json") != GE_INVALID_ARGUMENT) {
            failures.fetch_add(1, std::memory_order_relaxed);
            return;
          }
          malformedReorders.fetch_add(1, std::memory_order_relaxed);
        }
      });
    }

    start.store(true, std::memory_order_release);
    for (auto& thread : threads)
      thread.join();

    EXPECT_EQ(failures.load(std::memory_order_relaxed), 0);
    EXPECT_EQ(duplicateIds.load(std::memory_order_relaxed), 0);
    EXPECT_EQ(addedBlocks.load(std::memory_order_relaxed), kWriters);
    EXPECT_EQ(snapshots.load(std::memory_order_relaxed), kReaders * kReadsPerReader);
    EXPECT_EQ(malformedReorders.load(std::memory_order_relaxed),
              kMalformers * kReordersPerMalformer);

    std::array<char, 8192> json{};
    size_t written = 0;
    ASSERT_EQ(guitar_engine_snapshot(engine, json.data(), json.size(), &written), GE_OK);
    const auto ids = BlockIdsOf(std::string(json.data(), written - 1));
    EXPECT_EQ(ids.size(), static_cast<size_t>(kWriters));
    EXPECT_FALSE(HasDuplicateIds(ids));
    guitar_engine_destroy(engine);
  }
}

TEST(GuitarEngineAbiTest, ConcurrentParameterWritesDoNotTearTheSnapshot) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  ImpulseResponseFixture fixture;

  std::array<char, 64> blockId{};
  size_t written = 0;
  ASSERT_EQ(guitar_engine_add_file(engine, fixture.path().c_str(), blockId.data(),
                                   blockId.size(), &written),
            GE_OK);
  const std::string id(blockId.data(), written - 1);

  constexpr int kWriters = 3;
  constexpr int kWritesPerWriter = 40;
  constexpr int kReaders = 2;
  constexpr int kReadsPerReader = 300;

  std::atomic<bool> start{false};
  std::atomic<int> failures{0};
  std::atomic<int> snapshots{0};
  std::vector<std::thread> threads;

  for (int writer = 0; writer < kWriters; ++writer) {
    threads.emplace_back([&] {
      while (!start.load(std::memory_order_acquire)) {
      }
      for (int i = 0; i < kWritesPerWriter; ++i) {
        if (guitar_engine_set_param(engine, id.c_str(), "mix",
                                    static_cast<double>(i % 11) / 10.0) != GE_OK)
          failures.fetch_add(1, std::memory_order_relaxed);
      }
    });
  }

  for (int reader = 0; reader < kReaders; ++reader) {
    threads.emplace_back([&] {
      while (!start.load(std::memory_order_acquire)) {
      }
      for (int i = 0; i < kReadsPerReader; ++i) {
        std::array<char, 8192> json{};
        size_t size = 0;
        if (guitar_engine_snapshot(engine, json.data(), json.size(), &size) != GE_OK ||
            size == 0 || size > json.size() || json[size - 1] != '\0') {
          failures.fetch_add(1, std::memory_order_relaxed);
          continue;
        }
        std::vector<std::string> ids;
        try {
          ids = BlockIdsOf(std::string(json.data(), size - 1));
        } catch (const std::exception&) {
          failures.fetch_add(1, std::memory_order_relaxed);
          continue;
        }
        if (ids.size() != 1u || ids.front() != id)
          failures.fetch_add(1, std::memory_order_relaxed);
        snapshots.fetch_add(1, std::memory_order_relaxed);
      }
    });
  }

  start.store(true, std::memory_order_release);
  for (auto& thread : threads)
    thread.join();

  EXPECT_EQ(failures.load(std::memory_order_relaxed), 0);
  EXPECT_EQ(snapshots.load(std::memory_order_relaxed), kReaders * kReadsPerReader);
  guitar_engine_destroy(engine);
}
