#include <gtest/gtest.h>

#include "device_catalog.hpp"

TEST(DeviceCatalogTest, MergesDuplexEndpointsAndPreservesBothChannelCounts) {
  const std::vector<AudioDeviceInfo> inputs{{"CoreAudio:Interface", "Interface", 2, 0,
                                              {44100, 48000}, {64, 128}}};
  const std::vector<AudioDeviceInfo> outputs{{"CoreAudio:Interface", "Interface", 0, 4,
                                               {48000, 96000}, {128, 256}}};

  const auto merged = MergeDeviceCatalog(inputs, outputs);

  ASSERT_EQ(merged.size(), 1u);
  EXPECT_EQ(merged[0].id, "CoreAudio:Interface");
  EXPECT_EQ(merged[0].inputChannels, 2);
  EXPECT_EQ(merged[0].outputChannels, 4);
  EXPECT_EQ(merged[0].sampleRates, (std::vector<int>{44100, 48000, 96000}));
  EXPECT_EQ(merged[0].bufferSizes, (std::vector<int>{64, 128, 256}));
}

TEST(DeviceCatalogTest, KeepsInputOnlyAndOutputOnlyEndpointsSeparate) {
  const std::vector<AudioDeviceInfo> inputs{{"CoreAudio:Mic", "Mic", 1, 0, {48000}, {128}}};
  const std::vector<AudioDeviceInfo> outputs{{"CoreAudio:Speakers", "Speakers", 0, 2,
                                               {44100}, {256}}};

  const auto merged = MergeDeviceCatalog(inputs, outputs);

  ASSERT_EQ(merged.size(), 2u);
  EXPECT_EQ(merged[0].inputChannels, 1);
  EXPECT_EQ(merged[0].outputChannels, 0);
  EXPECT_EQ(merged[1].inputChannels, 0);
  EXPECT_EQ(merged[1].outputChannels, 2);
}

TEST(DeviceCatalogTest, MergesByFullDeviceIdNotByDisplayName) {
  const std::vector<AudioDeviceInfo> inputs{{"CoreAudio:Studio", "Studio", 2, 0,
                                              {48000}, {128}}};
  const std::vector<AudioDeviceInfo> outputs{{"ASIO:Studio", "Studio", 0, 2,
                                               {48000}, {128}}};

  const auto merged = MergeDeviceCatalog(inputs, outputs);

  ASSERT_EQ(merged.size(), 2u);
  EXPECT_EQ(merged[0].id, "CoreAudio:Studio");
  EXPECT_EQ(merged[1].id, "ASIO:Studio");
  EXPECT_EQ(merged[0].outputChannels, 0);
  EXPECT_EQ(merged[1].inputChannels, 0);
}

TEST(DeviceCatalogTest, RepeatedEndpointIdsCollapseIntoOneEntry) {
  const std::vector<AudioDeviceInfo> inputs{{"CoreAudio:Duplex", "Duplex", 2, 0,
                                              {48000}, {128}},
                                             {"CoreAudio:Duplex", "Duplex", 2, 0,
                                              {48000}, {128}}};
  const std::vector<AudioDeviceInfo> outputs{{"CoreAudio:Duplex", "Duplex", 0, 2,
                                               {48000}, {128}},
                                              {"CoreAudio:Duplex", "Duplex", 0, 2,
                                               {48000}, {128}}};

  const auto merged = MergeDeviceCatalog(inputs, outputs);

  ASSERT_EQ(merged.size(), 1u);
  EXPECT_EQ(merged[0].inputChannels, 2);
  EXPECT_EQ(merged[0].outputChannels, 2);
  EXPECT_EQ(merged[0].sampleRates, (std::vector<int>{48000}));
  EXPECT_EQ(merged[0].bufferSizes, (std::vector<int>{128}));
}
