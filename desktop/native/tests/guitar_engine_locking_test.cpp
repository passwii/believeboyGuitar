#include <array>
#include <atomic>
#include <chrono>
#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>

#include <gtest/gtest.h>

#include "guitar_engine.h"
#include "guitar_engine_internal.hpp"

namespace {

std::string LastErrorOf(guitar_engine* engine) {
  std::array<char, 512> text{};
  size_t written = 0;
  EXPECT_EQ(guitar_engine_last_error(engine, text.data(), text.size(), &written), GE_OK);
  if (written == 0)
    return {};
  return std::string(text.data(), written - 1);
}

std::string ReadFile(const std::string& path) {
  std::ifstream file(path);
  std::ostringstream contents;
  contents << file.rdbuf();
  return contents.str();
}

// Returns the body of the handler that deals with malformed JSON documents
// in guitar_engine_reorder.
std::string ReorderMalformedCatchBody(const std::string& source) {
  const auto function = source.find("int guitar_engine_reorder(");
  if (function == std::string::npos)
    return {};
  const auto handler = source.find("catch (const nlohmann::json::exception&)", function);
  if (handler == std::string::npos)
    return {};
  const auto bodyStart = source.find('{', handler);
  if (bodyStart == std::string::npos)
    return {};
  const auto bodyEnd = source.find('}', bodyStart);
  if (bodyEnd == std::string::npos)
    return {};
  return source.substr(bodyStart, bodyEnd - bodyStart + 1);
}

}  // namespace

// The malformed reorder path writes the error message of a failed call. That
// write shares the engine's lastError with the snapshot and the last-error
// readers, so it has to happen with the control mutex held.
TEST(GuitarEngineLockingTest, MalformedReorderErrorIsWrittenUnderTheControlMutex) {
  auto* engine = guitar_engine_create();
  ASSERT_NE(engine, nullptr);

  // This thread owns the control mutex, so no other ABI call may write
  // lastError while it is held. A malformed reorder therefore has to park on
  // the mutex instead of recording its error message.
  std::unique_lock<std::mutex> lock(engine->controlMutex);
  engine->lastError = "sentinel";

  std::atomic<bool> started{false};
  std::atomic<bool> finished{false};
  std::thread worker([&] {
    started.store(true, std::memory_order_release);
    const int result = guitar_engine_reorder(engine, "not json");
    EXPECT_EQ(result, GE_INVALID_ARGUMENT);
    finished.store(true, std::memory_order_release);
  });

  while (!started.load(std::memory_order_acquire))
    std::this_thread::sleep_for(std::chrono::milliseconds(1));

  // Give the worker time to parse the malformed document and to reach the
  // error write. The call may not complete while the mutex is held here.
  for (int i = 0; i < 100; ++i)
    std::this_thread::sleep_for(std::chrono::milliseconds(5));

  EXPECT_FALSE(finished.load(std::memory_order_acquire))
      << "the malformed reorder completed while another thread held the control mutex";
  EXPECT_EQ(engine->lastError, "sentinel")
      << "the malformed reorder wrote lastError without holding the control mutex";

  lock.unlock();
  worker.join();

  // Once the mutex is free the error is reported as usual.
  EXPECT_EQ(LastErrorOf(engine), "Malformed audio block id list");
  guitar_engine_destroy(engine);
}

// The race that this file guards against is only observable with a race
// detector, so the locking discipline of the error path is also pinned down
// structurally: the malformed document handler must go through the helper
// that takes the control mutex, never through the unlocked one.
TEST(GuitarEngineLockingTest, MalformedReorderHandlerUsesTheLockedErrorHelper) {
  const auto source =
      ReadFile(std::string(GUITAR_ENGINE_SOURCE_DIR) + "/src/guitar_engine.cpp");
  ASSERT_FALSE(source.empty()) << "the engine source could not be read";

  const auto body = ReorderMalformedCatchBody(source);
  ASSERT_FALSE(body.empty()) << "the malformed document handler was not found";
  EXPECT_NE(body.find("SetError("), std::string::npos);
  EXPECT_EQ(body.find("SetErrorLocked("), std::string::npos)
      << "the malformed document handler writes lastError without taking the control mutex";
}
