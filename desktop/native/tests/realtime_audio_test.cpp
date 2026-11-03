#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <dlfcn.h>

#include <gtest/gtest.h>

#include "allocation_tracking.h"
#include "realtime_processor.hpp"

__attribute__((constructor(101))) static void PrimeAllocationTrackingHooks() {
  allocation_tracking::original_malloc =
      reinterpret_cast<void* (*)(size_t)>(dlsym(RTLD_NEXT, "malloc"));
  allocation_tracking::original_free =
      reinterpret_cast<void (*)(void*)>(dlsym(RTLD_NEXT, "free"));
  allocation_tracking::original_realloc =
      reinterpret_cast<void* (*)(void*, size_t)>(dlsym(RTLD_NEXT, "realloc"));
}

TEST(RealtimeAudioTest, ResampledA2SteadyStateAndOversizedBlocksDoNotAllocate) {
  RealtimeProcessor processor;
  std::string error;
  BlockInfo block;
  ASSERT_EQ(processor.AddFile(NAM_A2_TEST_FIXTURE, error, block), GraphResult::Ok) << error;
  ASSERT_TRUE(processor.Prepare(44100.0, 128));
  ASSERT_EQ(processor.SetParam(block.id, "mix", 0.5f), GraphResult::Ok);

  std::array<float, 129> input{};
  std::array<float, 129> left{};
  std::array<float, 129> right{};
  for (int i = 0; i < 128; ++i)
    input[static_cast<size_t>(i)] = (i % 16 == 0) ? 0.25f : 0.0f;
  for (int i = 0; i < 129; ++i) {
    left[static_cast<size_t>(i)] = 1.0f;
    right[static_cast<size_t>(i)] = 1.0f;
  }

  // Prime the dependency's lazy dlsym hooks before its tracked region begins.
  void* allocationProbe = std::malloc(1);
  std::free(allocationProbe);

  bool oversizedWasSilent = false;
  uint64_t underruns = 0;
  float processedPeak = 0.0f;
  allocation_tracking::run_allocation_test_no_allocations(
      nullptr,
      [&] {
        for (int i = 0; i < 64; ++i)
          processor.Process(input.data(), left.data(), right.data(), 128);
        processedPeak = processor.OutputMeter();
        processor.Process(input.data(), left.data(), right.data(), 129);
        oversizedWasSilent = true;
        for (int i = 0; i < 129; ++i)
          oversizedWasSilent = oversizedWasSilent && left[static_cast<size_t>(i)] == 0.0f &&
                               right[static_cast<size_t>(i)] == 0.0f;
        underruns = processor.Underruns();
      },
      nullptr, "RealtimeAudioTest");

  EXPECT_TRUE(oversizedWasSilent);
  EXPECT_EQ(underruns, 1u);
  EXPECT_GT(processedPeak, 0.0f);
}

TEST(RealtimeAudioTest, LiveMixChangeRampsWithoutResettingTheNAMState) {
  RealtimeProcessor changed;
  RealtimeProcessor reference;
  std::string error;
  BlockInfo changedBlock;
  BlockInfo referenceBlock;
  ASSERT_EQ(changed.AddFile(NAM_A2_TEST_FIXTURE, error, changedBlock), GraphResult::Ok) << error;
  ASSERT_EQ(reference.AddFile(NAM_A2_TEST_FIXTURE, error, referenceBlock), GraphResult::Ok) << error;
  ASSERT_TRUE(changed.Prepare(48000.0, 128));
  ASSERT_TRUE(reference.Prepare(48000.0, 128));
  ASSERT_EQ(changed.SetParam(changedBlock.id, "mix", 0.0f), GraphResult::Ok);
  ASSERT_EQ(reference.SetParam(referenceBlock.id, "mix", 0.0f), GraphResult::Ok);

  std::array<float, 128> input{};
  std::array<float, 128> changedLeft{};
  std::array<float, 128> changedRight{};
  std::array<float, 128> referenceLeft{};
  std::array<float, 128> referenceRight{};
  uint64_t frame = 0;
  const auto fillInput = [&] {
    for (auto& sample : input) {
      sample = 0.1f * std::sin(static_cast<float>(frame) * 0.071f);
      ++frame;
    }
  };

  for (int block = 0; block < 64; ++block) {
    fillInput();
    changed.Process(input.data(), changedLeft.data(), changedRight.data(), 128);
    reference.Process(input.data(), referenceLeft.data(), referenceRight.data(), 128);
  }

  ASSERT_EQ(changed.SetParam(changedBlock.id, "mix", 1.0f), GraphResult::Ok);
  fillInput();
  changed.Process(input.data(), changedLeft.data(), changedRight.data(), 128);
  reference.Process(input.data(), referenceLeft.data(), referenceRight.data(), 128);

  float maxDifference = 0.0f;
  for (size_t i = 0; i < input.size(); ++i)
    maxDifference = std::max(maxDifference, std::abs(changedLeft[i] - referenceLeft[i]));
  EXPECT_LT(maxDifference, 0.05f)
      << "a live mix change should ramp from the current value and retain NAM state";
}

TEST(RealtimeAudioTest, StructuralUpdatePreservesPendingParameterRamp) {
  RealtimeProcessor changed;
  RealtimeProcessor reference;
  std::string error;
  BlockInfo changedBlock;
  BlockInfo referenceBlock;
  ASSERT_EQ(changed.AddFile(NAM_A2_TEST_FIXTURE, error, changedBlock), GraphResult::Ok) << error;
  ASSERT_EQ(reference.AddFile(NAM_A2_TEST_FIXTURE, error, referenceBlock), GraphResult::Ok) << error;
  ASSERT_TRUE(changed.Prepare(48000.0, 128));
  ASSERT_TRUE(reference.Prepare(48000.0, 128));
  ASSERT_EQ(changed.SetParam(changedBlock.id, "mix", 0.0f), GraphResult::Ok);
  ASSERT_EQ(reference.SetParam(referenceBlock.id, "mix", 0.0f), GraphResult::Ok);

  std::array<float, 128> input{};
  std::array<float, 128> changedLeft{};
  std::array<float, 128> changedRight{};
  std::array<float, 128> referenceLeft{};
  std::array<float, 128> referenceRight{};
  uint64_t frame = 0;
  const auto fillInput = [&] {
    for (auto& sample : input) {
      sample = 0.1f * std::sin(static_cast<float>(frame) * 0.071f);
      ++frame;
    }
  };
  for (int block = 0; block < 64; ++block) {
    fillInput();
    changed.Process(input.data(), changedLeft.data(), changedRight.data(), 128);
    reference.Process(input.data(), referenceLeft.data(), referenceRight.data(), 128);
  }

  ASSERT_EQ(changed.SetParam(changedBlock.id, "inputGainDb", -24.0f), GraphResult::Ok);
  ASSERT_EQ(changed.Reorder({changedBlock.id}), GraphResult::Ok);
  fillInput();
  changed.Process(input.data(), changedLeft.data(), changedRight.data(), 128);
  reference.Process(input.data(), referenceLeft.data(), referenceRight.data(), 128);

  float maxDifference = 0.0f;
  for (size_t i = 0; i < input.size(); ++i)
    maxDifference = std::max(maxDifference, std::abs(changedLeft[i] - referenceLeft[i]));
  EXPECT_LT(maxDifference, 0.03f)
      << "a structural graph swap should preserve the active gain ramp";
}
