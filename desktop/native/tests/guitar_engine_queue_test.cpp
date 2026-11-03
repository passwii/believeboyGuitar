#include <array>
#include <cstdint>
#include <string>
#include <vector>

#include <gtest/gtest.h>
#include <json.hpp>

#include "guitar_engine.h"
#include "guitar_engine_internal.hpp"
#include "impulse_response_fixture.hpp"

namespace {

std::string SnapshotOf(guitar_engine* engine) {
  std::array<char, 8192> json{};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_snapshot(engine, json.data(), json.size(), &written), GE_OK);
  if (written == 0)
    return {};
  return std::string(json.data(), written - 1);
}

std::string LastErrorOf(guitar_engine* engine) {
  std::array<char, 512> text{};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_last_error(engine, text.data(), text.size(), &written), GE_OK);
  if (written == 0)
    return {};
  return std::string(text.data(), written - 1);
}

std::vector<std::string> BlockIdsOf(const std::string& snapshot) {
  std::vector<std::string> ids;
  const auto parsed = nlohmann::json::parse(snapshot);
  for (const auto& block : parsed.at("blocks"))
    ids.push_back(block.at("id").get<std::string>());
  return ids;
}

// Fills the pending graph queue of a stopped engine. The audio thread is the
// only consumer of that queue, so a stopped engine never drains it and every
// mutation below is published but never taken over.
void FillPendingQueue(guitar_engine* engine, const std::string& path,
                      std::vector<std::string>& ids) {
  for (uint32_t i = 0; i < RealtimeProcessor::kPendingQueueCapacity; ++i) {
    std::array<char, 64> id{};
    size_t written = 0;
    ASSERT_EQ(guitar_engine_add_file(engine, path.c_str(), id.data(), id.size(), &written),
              GE_OK);
    ids.emplace_back(id.data(), written - 1);
  }
}

}  // namespace

TEST(GuitarEngineQueueTest, SaturatedGraphQueueReportsBusy) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  ImpulseResponseFixture fixture;

  // A stopped engine keeps its mutations in the control graph instead of
  // publishing them, so publishing is turned on here to exercise the bounded
  // queue that only the audio thread drains.
  engine->processor.Prepare(48000.0, 128);
  engine->processor.SetPublishingEnabled(true);

  std::vector<std::string> ids;
  FillPendingQueue(engine, fixture.path(), ids);
  ASSERT_EQ(ids.size(), RealtimeProcessor::kPendingQueueCapacity);

  // The queue is full, so the next valid mutation cannot be published.
  std::array<char, 64> id{};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_add_file(engine, fixture.path().c_str(), id.data(), id.size(),
                                   &written),
            GE_BUSY);
  EXPECT_EQ(LastErrorOf(engine), kUpdateQueueFullMessage);

  // The rejected mutation must leave the control chain untouched.
  const auto idsAfter = BlockIdsOf(SnapshotOf(engine));
  EXPECT_EQ(idsAfter, ids);
  EXPECT_EQ(idsAfter.size(), RealtimeProcessor::kPendingQueueCapacity);

  guitar_engine_destroy(engine);
}

TEST(GuitarEngineQueueTest, SaturatedGraphQueueKeepsRealFailureReasons) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  ImpulseResponseFixture fixture;

  engine->processor.Prepare(48000.0, 128);
  engine->processor.SetPublishingEnabled(true);

  std::vector<std::string> ids;
  FillPendingQueue(engine, fixture.path(), ids);
  ASSERT_FALSE(ids.empty());

  // A request that can never succeed keeps its own reason even though the
  // queue is full: such a request is rejected before it is ever published.
  EXPECT_EQ(guitar_engine_remove_block(engine, "ir-does-not-exist"), GE_BLOCK_NOT_FOUND);
  EXPECT_EQ(guitar_engine_set_param(engine, "ir-does-not-exist", "mix", 0.5),
            GE_BLOCK_NOT_FOUND);
  EXPECT_EQ(guitar_engine_reorder(engine, "not json"), GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_reorder(engine, "[]"), GE_INVALID_ARGUMENT);
  EXPECT_EQ(guitar_engine_set_param(engine, ids.front().c_str(), "unsupported", 1.0),
            GE_INVALID_PARAMETER);

  // None of those failures may consume queue space or change the chain.
  const auto idsAfter = BlockIdsOf(SnapshotOf(engine));
  EXPECT_EQ(idsAfter, ids);

  guitar_engine_destroy(engine);
}

TEST(GuitarEngineQueueTest, GraphQueueRecoversOnceTheAudioThreadDrains) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);
  ImpulseResponseFixture fixture;

  engine->processor.Prepare(48000.0, 128);
  engine->processor.SetPublishingEnabled(true);

  std::vector<std::string> ids;
  FillPendingQueue(engine, fixture.path(), ids);

  std::array<char, 64> id{};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_add_file(engine, fixture.path().c_str(), id.data(), id.size(),
                                   &written),
            GE_BUSY);

  // Stand in for the audio thread and drain the pending queue.
  std::array<float, 128> input{};
  std::array<float, 128> left{};
  std::array<float, 128> right{};
  for (uint32_t i = 0; i < RealtimeProcessor::kPendingQueueCapacity; ++i)
    engine->processor.Process(input.data(), left.data(), right.data(), 128);

  // Backpressure is temporary: the next mutation is published again.
  EXPECT_EQ(guitar_engine_add_file(engine, fixture.path().c_str(), id.data(), id.size(),
                                   &written),
            GE_OK);
  EXPECT_EQ(LastErrorOf(engine), std::string());

  guitar_engine_destroy(engine);
}
