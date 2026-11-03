cmake_minimum_required(VERSION 3.22.1)
project(GuitarNative LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 9.0.3
  GIT_SHALLOW TRUE
)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.15.2
  GIT_SHALLOW TRUE
)

set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "" FORCE)
set(JUCE_ENABLE_MODULE_SOURCE_GROUPS OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(JUCE googletest)

set(NAM_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/external/NeuralAmpModelerCore")
add_library(NAM STATIC
  "${NAM_ROOT}/NAM/activations.cpp"
  "${NAM_ROOT}/NAM/container.cpp"
  "${NAM_ROOT}/NAM/conv1d.cpp"
  "${NAM_ROOT}/NAM/convnet.cpp"
  "${NAM_ROOT}/NAM/dsp.cpp"
  "${NAM_ROOT}/NAM/get_dsp.cpp"
  "${NAM_ROOT}/NAM/linear.cpp"
  "${NAM_ROOT}/NAM/lstm.cpp"
  "${NAM_ROOT}/NAM/ring_buffer.cpp"
  "${NAM_ROOT}/NAM/util.cpp"
  "${NAM_ROOT}/NAM/wavenet/a2_fast.cpp"
  "${NAM_ROOT}/NAM/wavenet/model.cpp"
  "${NAM_ROOT}/NAM/wavenet/slimmable.cpp"
)
target_compile_definitions(NAM PUBLIC NAM_ENABLE_A2_FAST NAM_SAMPLE_FLOAT)
target_include_directories(NAM PUBLIC
  "${NAM_ROOT}/NAM"
  "${NAM_ROOT}/Dependencies/eigen"
  "${NAM_ROOT}/Dependencies/nlohmann"
  "${NAM_ROOT}/Dependencies/AudioDSPTools/dsp"
)

enable_testing()

add_library(AudioEngine SHARED
  src/device_catalog.cpp
  src/model_chain.cpp
  src/realtime_processor.cpp
  src/audio_device_host.cpp
  src/guitar_engine.cpp
)
target_include_directories(AudioEngine PUBLIC include PRIVATE
  src
  "${NAM_ROOT}/Dependencies/AudioDSPTools/dsp/ResamplingContainer/Dependencies")
target_link_libraries(AudioEngine PRIVATE
  NAM
  juce::juce_audio_devices
  juce::juce_audio_formats
  juce::juce_audio_utils
  juce::juce_core
  juce::juce_dsp
)
if(APPLE)
  target_link_options(AudioEngine PRIVATE "-Wl,-force_load,$<TARGET_FILE:NAM>")
endif()

add_executable(ModelChainTests
  tests/model_chain_test.cpp
  src/model_chain.cpp
)
target_include_directories(ModelChainTests PRIVATE include)
target_compile_definitions(ModelChainTests PRIVATE
  NAM_A2_TEST_FIXTURE="${NAM_ROOT}/example_models/A2.nam"
)
target_link_libraries(ModelChainTests PRIVATE
  NAM
  juce::juce_audio_formats
  juce::juce_dsp
  GTest::gtest_main
)
if(APPLE)
  target_link_options(ModelChainTests PRIVATE
    "-Wl,-force_load,$<TARGET_FILE:NAM>"
  )
endif()
add_test(NAME ModelChainTests COMMAND ModelChainTests)

add_executable(GuitarEngineAbiTests
  tests/guitar_engine_abi_test.cpp
)
target_include_directories(GuitarEngineAbiTests PRIVATE include)
target_compile_definitions(GuitarEngineAbiTests PRIVATE
  NAM_A2_TEST_FIXTURE="${NAM_ROOT}/example_models/A2.nam")
target_include_directories(GuitarEngineAbiTests PRIVATE
  "${NAM_ROOT}/Dependencies/nlohmann")
target_link_libraries(GuitarEngineAbiTests PRIVATE AudioEngine GTest::gtest_main)
add_test(NAME GuitarEngineAbiTests COMMAND GuitarEngineAbiTests)

# White-box test for the control-graph queue: it drives the internals of the
# engine handle, so it compiles the engine sources itself instead of linking
# the shared library. Two copies of JUCE in one process would mix their global
# string pools and abort on the first free.
add_executable(GuitarEngineQueueTests
  tests/guitar_engine_queue_test.cpp
  src/guitar_engine.cpp
  src/model_chain.cpp
  src/realtime_processor.cpp
  src/audio_device_host.cpp
  src/device_catalog.cpp
)
target_include_directories(GuitarEngineQueueTests PRIVATE include src tests
  "${NAM_ROOT}/Dependencies/nlohmann"
  "${NAM_ROOT}/Dependencies/AudioDSPTools/dsp/ResamplingContainer/Dependencies")
target_link_libraries(GuitarEngineQueueTests PRIVATE
  NAM
  juce::juce_audio_basics
  juce::juce_audio_devices
  juce::juce_audio_formats
  juce::juce_core
  juce::juce_dsp
  GTest::gtest_main)
if(APPLE)
  target_link_options(GuitarEngineQueueTests PRIVATE "-Wl,-force_load,$<TARGET_FILE:NAM>")
endif()
add_test(NAME GuitarEngineQueueTests COMMAND GuitarEngineQueueTests)

# White-box test for the locking discipline of the ABI error paths: it drives
# the internals of the engine handle, so it compiles the engine sources itself
# instead of linking the shared library. Two copies of JUCE in one process
# would mix their global string pools and abort on the first free.
add_executable(GuitarEngineLockingTests
  tests/guitar_engine_locking_test.cpp
  src/guitar_engine.cpp
  src/model_chain.cpp
  src/realtime_processor.cpp
  src/audio_device_host.cpp
  src/device_catalog.cpp
)
target_include_directories(GuitarEngineLockingTests PRIVATE include src tests
  "${NAM_ROOT}/Dependencies/nlohmann"
  "${NAM_ROOT}/Dependencies/AudioDSPTools/dsp/ResamplingContainer/Dependencies")
target_compile_definitions(GuitarEngineLockingTests PRIVATE
  GUITAR_ENGINE_SOURCE_DIR="${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(GuitarEngineLockingTests PRIVATE
  NAM
  juce::juce_audio_basics
  juce::juce_audio_devices
  juce::juce_audio_formats
  juce::juce_core
  juce::juce_dsp
  GTest::gtest_main)
if(APPLE)
  target_link_options(GuitarEngineLockingTests PRIVATE "-Wl,-force_load,$<TARGET_FILE:NAM>")
endif()
add_test(NAME GuitarEngineLockingTests COMMAND GuitarEngineLockingTests)

add_executable(DeviceCatalogTests tests/device_catalog_test.cpp)
target_include_directories(DeviceCatalogTests PRIVATE src)
target_sources(DeviceCatalogTests PRIVATE src/device_catalog.cpp)
target_link_libraries(DeviceCatalogTests PRIVATE GTest::gtest_main)
add_test(NAME DeviceCatalogTests COMMAND DeviceCatalogTests)

add_executable(RealtimeAudioTests
  tests/realtime_audio_test.cpp
  src/model_chain.cpp
  src/realtime_processor.cpp
  "${NAM_ROOT}/tools/test/allocation_tracking.cpp"
)
target_include_directories(RealtimeAudioTests PRIVATE include src
  "${NAM_ROOT}/tools/test"
  "${NAM_ROOT}/Dependencies/AudioDSPTools/dsp/ResamplingContainer/Dependencies")
target_compile_definitions(RealtimeAudioTests PRIVATE
  NAM_A2_TEST_FIXTURE="${NAM_ROOT}/example_models/A2.nam")
target_link_libraries(RealtimeAudioTests PRIVATE
  NAM
  juce::juce_audio_basics
  juce::juce_audio_formats
  juce::juce_core
  juce::juce_dsp
  GTest::gtest_main)
if(APPLE)
  target_link_options(RealtimeAudioTests PRIVATE "-Wl,-force_load,$<TARGET_FILE:NAM>")
  target_link_libraries(RealtimeAudioTests PRIVATE ${CMAKE_DL_LIBS})
endif()
add_test(NAME RealtimeAudioTests COMMAND RealtimeAudioTests)
