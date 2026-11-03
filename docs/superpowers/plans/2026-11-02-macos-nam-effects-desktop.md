# macOS NAM Effects Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal macOS guitar-effects app with a MyGo native UI and a low-latency JUCE/NAM A2 audio engine for local `.nam` and `.wav` IR files.

**Architecture:** The independent `desktop/` Go application owns the UI, local preset files, and user actions. A bundled C++20 dylib owns CoreAudio device I/O, 48 kHz resampling, NAM/IR processing, and meter snapshots. Go calls the dylib's versioned C ABI through purego; no Go or UI callback runs on the real-time audio thread. Local presets retain original model paths and never duplicate model bytes.

**Tech Stack:** Go 1.27.3, MyGo v0.6.2 native UI, purego v0.11.1, C++20, JUCE 9.0.3, NeuralAmpModelerCore commit `1f42f88535884450104b8711d7595019afa0495b`, AudioDSPTools commit `0827c6c2fc0deced568536142ea86f189e0b98a1`, CMake 3.22.1+, Ninja, and GoogleTest 1.15.2.

## Global Constraints

- Keep the current Next.js PWA under `app/` and the WeChat mini-program independent; all desktop code lives under `desktop/`.
- Build a MyGo native UI app; do not use MyGo's buffered playback package for live guitar monitoring.
- Keep C++ real-time callbacks free of Go calls, file I/O, blocking locks, and allocations.
- Process the guitar chain at 48 kHz; resample the active CoreAudio device rate at the chain boundary.
- The first version accepts mono guitar input and outputs stereo monitoring.
- Load local `.nam` models and WAV IRs from their original paths. Presets save paths and parameters; neither import nor save copies model files.
- Do not call the TONE3000 API or add cloud account/catalog features.
- Implement the app independently; do not copy TONE3000 Plugin code, assets, model files, or branding. Keep upstream dependency license notices and attribution with the project.
- The first version has serial NAM/IR blocks, bypass, per-block gain/mix, master gain, device setup, and local presets. It excludes backing tracks, chord recognition, TAB scoring, standalone delay/reverb/chorus, MIDI, and plugin-host formats.
- Follow TDD for new behavior: add a focused failing test, run it to confirm the expected failure, implement the minimum change, then rerun it.
- After implementation, run `npm run typecheck && npm test && npm run build` from the repository root and run the desktop Go/CMake test and build commands in this plan.

---

## File Map

```text
desktop/
├── go.mod, mygo.json, main.go
├── internal/
│   ├── app/       MyGo view, UI state, controller, and preset integration
│   ├── engine/    Engine interface, purego loader, C ABI bindings, Go tests
│   └── preset/    Versioned local preset schema and file persistence
├── native/
│   ├── CMakeLists.txt, CMakePresets.json
│   ├── external/  pinned NeuralAmpModelerCore submodule and its pinned dependencies
│   ├── include/   public C ABI and C++ engine declarations
│   ├── src/       JUCE host, model/IR chain, device state, C ABI definitions
│   └── tests/     offline DSP and C ABI tests
├── resources/darwin-arm64/AudioEngine.dylib  MyGo platform resource, generated locally
└── scripts/       local native-build and app-build entry points
```

The native C API is the only boundary between Go and C++. Implement these names and contracts once, then keep them stable across tasks:

```c
typedef struct guitar_engine guitar_engine;
enum guitar_engine_result {
    GE_OK = 0,
    GE_BUFFER_TOO_SMALL = 1,
    GE_INVALID_ARGUMENT = 2,
    GE_INVALID_PARAMETER = 3,
    GE_BLOCK_NOT_FOUND = 4,
    GE_DEVICE_OPEN_FAILED = 5,
    GE_MODEL_LOAD_FAILED = 6,
    GE_NOT_RUNNING = 7,
    GE_INTERNAL_ERROR = 8,
    GE_BUSY = 9
};

uint32_t guitar_engine_abi_version(void);  /* returns 1 */
guitar_engine *guitar_engine_create(void);  /* NULL on allocation/setup failure */
void guitar_engine_destroy(guitar_engine *engine);
int guitar_engine_list_devices(guitar_engine *engine,
                               char *json_out, size_t capacity, size_t *written);
int guitar_engine_start(guitar_engine *engine,
                        const char *input_device_id, int input_channel,
                        const char *output_device_id, int buffer_size);
int guitar_engine_stop(guitar_engine *engine);
int guitar_engine_set_input_gain(guitar_engine *engine, double gain_db);
int guitar_engine_set_master_gain(guitar_engine *engine, double gain_db);
int guitar_engine_add_file(guitar_engine *engine, const char *path,
                           char *block_id_out, size_t capacity, size_t *written);
int guitar_engine_remove_block(guitar_engine *engine, const char *block_id);
int guitar_engine_reorder(guitar_engine *engine, const char *block_ids_json);
int guitar_engine_set_param(guitar_engine *engine, const char *block_id,
                            const char *name, double value);
int guitar_engine_snapshot(guitar_engine *engine,
                           char *json_out, size_t capacity, size_t *written);
int guitar_engine_last_error(guitar_engine *engine,
                             char *text_out, size_t capacity, size_t *written);
```

All functions return `0` on success and a documented nonzero `EngineResult` code on failure. Buffer-writing calls set `written` to the bytes required including the terminating NUL and return `GE_BUFFER_TOO_SMALL` when `capacity` is insufficient. No exception crosses the C ABI. C++ strings and buffers are copied during each call; the engine never retains Go memory.

The Go engine interface is:

```go
package engine

import "errors"

var (
	ErrBlockNotFound    = errors.New("audio block not found")
	ErrInvalidParameter = errors.New("invalid audio parameter")
    ErrBusy             = errors.New("audio engine is busy")
)

type Engine interface {
    Devices() ([]Device, error)
    Start(AudioConfig) error
    Stop() error
    SetInputGain(gainDB float64) error
    SetMasterGain(gainDB float64) error
    AddFile(path string) (Block, error)
    RemoveBlock(id string) error
    Reorder(ids []string) error
    SetParam(id, name string, value float64) error
    Snapshot() (Snapshot, error)
    Close() error
}
```

The data types are:

```go
type Device struct {
	ID string `json:"id"`
	Name string `json:"name"`
	InputChannels int `json:"inputChannels"`
	OutputChannels int `json:"outputChannels"`
	SampleRates []int `json:"sampleRates"`
	BufferSizes []int `json:"bufferSizes"`
}

type AudioConfig struct {
	InputDeviceID string `json:"inputDeviceId"`
	InputChannel int `json:"inputChannel"`
	OutputDeviceID string `json:"outputDeviceId"`
	BufferSize int `json:"bufferSize"`
}

type Block struct {
	ID string `json:"id"`
	Kind string `json:"kind"`
	Path string `json:"path"`
	Bypassed bool `json:"bypassed"`
	InputGainDB float64 `json:"inputGainDb"`
	OutputGainDB float64 `json:"outputGainDb"`
	Mix float64 `json:"mix"`
}

type Snapshot struct {
	Running bool `json:"running"`
	InputDeviceID string `json:"inputDeviceId"`
	OutputDeviceID string `json:"outputDeviceId"`
	SampleRate int `json:"sampleRate"`
	BufferSize int `json:"bufferSize"`
	InputGainDB float64 `json:"inputGainDb"`
	OutputGainDB float64 `json:"outputGainDb"`
	Blocks []Block `json:"blocks"`
	InputMeterDB float64 `json:"inputMeterDb"`
	OutputMeterDB float64 `json:"outputMeterDb"`
	Underruns uint64 `json:"underruns"`
	LastError string `json:"lastError"`
}
```

`engine.go` also exports `ErrBlockNotFound` and `ErrInvalidParameter` so controllers and test fakes return the same errors.

## Task 1: Scaffold MyGo and Test the Idle UI

**Files:**

- Create: `desktop/go.mod`, `desktop/mygo.json`, `desktop/main.go`
- Create: `desktop/internal/app/model.go`, `desktop/internal/app/model_test.go`
- Create: `desktop/internal/engine/engine.go`
- Create: `desktop/.gitignore`
- Generated by MyGo: `desktop/resources/icon.png`

**Interfaces:**

- Produces a `desktop` Go module pinned to MyGo v0.6.2 and a testable native view.
- `internal/engine/engine.go` declares the `Engine`, `Device`, `AudioConfig`, `Block`, and `Snapshot` interfaces in the File Map. A native implementation follows in Task 4.
- Initial UI status is stopped. It must not claim the audio engine is ready before the native library is loaded.

- [ ] **Step 1: Generate the native MyGo project shell.**

Run from repository root:

```sh
go run github.com/egoist/mygo/cmd/mygo@v0.6.2 init -template native desktop
```

Expected: `desktop/main.go`, `desktop/main_test.go`, `desktop/go.mod`, `desktop/mygo.json`, and `desktop/resources/icon.png` exist. Set the module path to `github.com/damonrock/guitar-desktop` and keep MyGo's generated `go tool mygo` pin at v0.6.2.

- [ ] **Step 2: Add the engine interface and write the failing initial-view test.**

Create `internal/engine/engine.go` with the `Engine`, `Device`, `AudioConfig`, `Block`, and `Snapshot` declarations in the File Map. In `internal/app/model_test.go` (package `app`), create a `ui.NewTester` over the app view and assert that the first frame contains `NAM Effects`, `Stopped`, `Input`, `Output`, `Add NAM Model`, and `Add IR`, and does not contain `Monitoring`.

```go
func TestInitialViewShowsStoppedChain(t *testing.T) {
	app := New(nil)
	tester := ui.NewTester(app.View, 1280, 800)
	for _, label := range []string{"NAM Effects", "Stopped", "Input", "Output", "Add NAM Model", "Add IR"} {
		if !tester.HasText(label) {
			t.Errorf("initial view is missing %q; text=%q", label, tester.Texts())
		}
	}
	if tester.HasText("Monitoring") {
		t.Fatalf("new app must not claim that monitoring is active")
	}
}
```

Run from `desktop/`:

```sh
go test ./...
```

Expected before implementation: FAIL because `app.New` and its view are not implemented.

- [ ] **Step 3: Implement the idle app model and native view.**

Create `internal/app/model.go` with `type App struct { engine engine.Engine; status string; inputName string; outputName string; message string }`, `func New(engine.Engine) *App`, and `func (a *App) View(c *ui.Context)`. Initial status is `Stopped`; blank devices display `Choose input` and `Choose output`. Use MyGo `ui.Column`, `ui.Row`, `ui.Text`, and `ui.PrimaryButton`; start with the existing Signal Bench light palette through MyGo theme colors. `main.go` imports `internal/app`, creates `app.New(nil)`, creates the window inside `mygo.App.WhenReady`, and runs `mygo.App.Run()` on the main goroutine. Delete the generated root `main_test.go` after moving its view test to `internal/app/model_test.go`. Set `mygo.json` to `name: "Guitar Effects"`, `identifier: "com.damonrock.guitareffects"`, `version: "0.1.0"`, and `macos.infoPlist.NSMicrophoneUsageDescription: "Guitar Effects needs audio input access to process your instrument."`.

- [ ] **Step 4: Verify the view test passes.**

Run `go test ./...` from `desktop/`. Expected: the initial-view test passes and the native view test runs without opening a window.

- [ ] **Step 5: Ignore generated desktop outputs.**

Add these entries to `desktop/.gitignore`:

```gitignore
/build/
/.mygo/
/native/build/
/resources/darwin-arm64/AudioEngine.dylib
```

Run `git status --short`; only intended Go source/configuration files should be untracked, with generated build outputs absent.

- [ ] **Step 6: Commit the scaffold.**

```sh
git add desktop
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'feat(desktop): 建立 MyGo macOS 应用骨架'
```

## Task 2: Build and Test the NAM/IR Chain Core

**Files:**

- Create: `.gitmodules`
- Create: `desktop/native/CMakeLists.txt`, `desktop/native/CMakePresets.json`
- Create: `desktop/native/include/model_chain.hpp`, `desktop/native/src/model_chain.cpp`
- Create: `desktop/native/tests/model_chain_test.cpp`
- External source: `desktop/native/external/NeuralAmpModelerCore` at `1f42f88535884450104b8711d7595019afa0495b`

**Interfaces:**

- `BlockInfo` is `{ std::string id; std::string kind; std::filesystem::path path; bool bypassed; float inputGainDb; float outputGainDb; float mix; }`.
- `AudioBlock` is constructed with its ID, kind, and source path; it defines `Prepare(double sampleRate, int maxBlockSize)`, non-virtual `Process(juce::AudioBuffer<float>&)` and `SetParam(std::string_view, float) -> bool` for shared bypass/gain/mix behavior, `Info() const -> BlockInfo`, a protected virtual `ProcessWet(juce::AudioBuffer<float>&)`, and a virtual destructor.
- `ModelChain` defines `Prepare(double, int)`, `AddFile(path, error) -> std::optional<BlockInfo>`, `Append(std::unique_ptr<AudioBlock>)`, `RemoveBlock(id) -> bool`, `Reorder(ids) -> bool`, `SetParam(id, name, value) -> bool`, `SetBypassed(id, bool) -> bool`, `Process(buffer)`, and `Snapshot() -> std::vector<BlockInfo>`.
- `.nam` loading uses `nam::get_dsp(path)` and `DSP::Reset(48000.0, maxBlockSize)` off the audio thread. WAV IR uses `juce::dsp::Convolution` and retains only the original file path plus its prepared engine.

- [ ] **Step 1: Install native build tools and pin DSP dependencies.**

The current machine has Homebrew and Xcode Command Line Tools, but lacks CMake and Ninja. Run:

```sh
brew install cmake ninja
```

Add NeuralAmpModelerCore as a submodule and pin it to the reviewed commit. Its own `.gitmodules` pins AudioDSPTools to the exact dependency commit used by this design, so initialize dependencies recursively instead of adding a duplicate AudioDSPTools checkout:

```sh
git submodule add https://github.com/sdatkinson/NeuralAmpModelerCore.git desktop/native/external/NeuralAmpModelerCore
git -C desktop/native/external/NeuralAmpModelerCore checkout 1f42f88535884450104b8711d7595019afa0495b
git submodule update --init --recursive
```

Create `CMakePresets.json` with configure/build/test preset `macos-arm64`, binary directory `${sourceDir}/build/arm64`, Ninja, Debug mode, and `CMAKE_OSX_ARCHITECTURES=arm64`. Create `CMakeLists.txt` with CMake minimum 3.22.1 and C++20, and use FetchContent to pin JUCE 9.0.3 and GoogleTest 1.15.2. Define a static `NAM` target from all `.cpp` files at the pinned revision: `activations.cpp`, `container.cpp`, `conv1d.cpp`, `convnet.cpp`, `dsp.cpp`, `get_dsp.cpp`, `linear.cpp`, `lstm.cpp`, `ring_buffer.cpp`, `util.cpp`, `wavenet/a2_fast.cpp`, `wavenet/model.cpp`, and `wavenet/slimmable.cpp`. Define `NAM_ENABLE_A2_FAST` and `NAM_SAMPLE_FLOAT` for the NAM target and consumers, and expose include directories for `NAM`, `Dependencies/eigen`, `Dependencies/nlohmann`, and the recursively initialized `Dependencies/AudioDSPTools/dsp`. Use macOS `-Wl,-force_load,$<TARGET_FILE:NAM>` when linking the audio engine so NAM's model registrations survive static linking. The initial CMake file must configure before test targets are added.

- [ ] **Step 2: Write failing chain-order and bypass tests.**

Create `tests/model_chain_test.cpp` and register `ModelChainTests` in `CMakeLists.txt`. Define a test-only `GainBlock : AudioBlock` that multiplies each sample by a constructor-supplied gain. The test subclass is:

```cpp
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
  void Prepare(double, int) override {}
  void ProcessWet(juce::AudioBuffer<float>& buffer) override { buffer.applyGain(gain_); }

 private:
  float gain_;
};
```

The tests assert that a chain with gains 2 then 3 outputs 6 times the input, bypassing the first block leaves only the second block's gain, setting input gain and wet/dry mix changes output by the expected amount, and moving the blocks changes the ordered IDs. Build buffers directly with `juce::AudioBuffer<float>(1, n)` and `setSample`; no test-only production hook is added. `AudioBlock::Process` owns common bypass/input-gain/wet-dry/output-gain behavior and delegates only wet-signal calculation to `ProcessWet`, so the test block exercises the same common processing used by NAM and IR blocks.

```cpp
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
  ASSERT_TRUE(chain.SetBypassed("first", true));
  juce::AudioBuffer<float> buffer(1, 1);
  buffer.setSample(0, 0, 0.125f);
  chain.Prepare(48000.0, 128);
  chain.Process(buffer);
  EXPECT_FLOAT_EQ(buffer.getSample(0, 0), 0.125f);
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
  EXPECT_FALSE(chain.AddFile("/tmp/notes.txt", error).has_value());
  EXPECT_FALSE(chain.AddFile("/tmp/corrupt.wav", error).has_value());
  EXPECT_TRUE(chain.Snapshot().empty());
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
```

Add `ModelChainTests` to `CMakeLists.txt` and define `NAM_A2_TEST_FIXTURE` as the absolute source path `${CMAKE_CURRENT_SOURCE_DIR}/external/NeuralAmpModelerCore/example_models/A2.nam`. Run from `desktop/native/`:

```sh
cmake --preset macos-arm64 && cmake --build --preset macos-arm64 --target ModelChainTests && ctest --preset macos-arm64 -R ModelChainTests --output-on-failure
```

Expected before implementation: compilation fails because `model_chain.hpp` and `ModelChain` do not exist.

- [ ] **Step 3: Implement model blocks, parameters, and chain snapshots.**

Implement `AudioBlock`, `NamAudioBlock`, `IrAudioBlock`, `ModelChain`, and `BlockInfo` in the listed native files. Validate extensions and file readability before insertion; `.nam` must pass `nam::get_dsp`, use one input and one output channel, and call `DSP::Reset(48000.0, maxBlockSize)` off the audio thread. WAV IR must be mono, decoded by JUCE's basic audio formats on the control thread, then loaded into `juce::dsp::Convolution` through its prepared-buffer overload. Set the chain rate to 48000 Hz. `AudioBlock::Process` applies smoothed input gain, wet/dry mix, output gain, and bypass around `ProcessWet`; allocate its dry buffer in `Prepare`, initialize each smoother's current and target values from saved parameters, and ramp later parameter changes smoothly. Use a pair of the pinned AudioDSPTools `dsp::LanczosResampler<float, 1>` for device-rate-to-48-kHz input and 48-kHz-to-device-rate output, then duplicate the mono result to stereo. Allocate both resamplers, chain buffers, pointer arrays, and callback scratch buffers during device preparation. Do not use AudioDSPTools `ResamplingContainer`: its callback accepts `std::function` by value, which may allocate, and its underflow path writes to `std::cerr`; the lower-level Lanczos resampler avoids both on the audio thread. Keep the callback path free of Go, file I/O, blocking locks, logging, and heap allocation. Task 3 adds a focused allocation assertion around steady-state resampled block processing. Prepare new DSP/convolution objects on the control thread and hand them to the audio thread through a bounded SPSC swap queue; retire old graphs on a non-audio thread. The UI controller is the single writer to that queue. Link the JUCE DSP/audio modules and the static NAM library into `AudioEngine` in Task 3.

- [ ] **Step 4: Verify A2, WAV IR, and invalid-file tests pass.**

Run from `desktop/native/`:

```sh
cmake --build --preset macos-arm64 --target ModelChainTests && ctest --preset macos-arm64 -R ModelChainTests --output-on-failure
```

Expected: all chain, A2 fixture, WAV IR, and invalid-file tests pass.

- [ ] **Step 5: Commit the native chain core.**

```sh
git add .gitmodules desktop/native
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'feat(desktop): 增加 NAM 与 IR 串联处理核心'
```

## Task 3: Add the JUCE Audio Device Host and C ABI

**Files:**

- Create: `desktop/native/include/guitar_engine.h`
- Create: `desktop/native/src/audio_device_host.hpp`, `desktop/native/src/audio_device_host.cpp`
- Create: `desktop/native/src/realtime_processor.hpp`, `desktop/native/src/realtime_processor.cpp`
- Create: `desktop/native/src/guitar_engine.cpp`
- Create: `desktop/native/tests/guitar_engine_abi_test.cpp`
- Create: `desktop/native/tests/realtime_audio_test.cpp`
- Modify: `desktop/native/CMakeLists.txt`, `desktop/native/CMakePresets.json`

**Interfaces:**

- `AudioDeviceHost` wraps JUCE `AudioDeviceManager`; it lists device IDs, display names, channel counts, sample rates, and buffer sizes, and opens mono input / stereo output.
- `RealtimeProcessor` owns `ModelChain`, the AudioDSPTools resampler, and preallocated work buffers; `AudioDeviceHost` forwards JUCE callbacks to it.
- Before processing, `RealtimeProcessor::Process` checks the device frame count and derived 48 kHz frame count against prepared capacities. Oversized callbacks clear the stereo outputs, atomically increment `underruns`, and return without resizing or calling `ModelChain::Process`.
- The `AudioIODeviceCallback` runs `RealtimeProcessor::Process` against preallocated buffers; it does not call Go, wait on a blocking mutex, load files, log, or allocate.
- The host applies smoothed input gain before `ModelChain::Process` and smoothed master gain after it.
- `guitar_engine.h` implements the C ABI in the File Map. The library exports `guitar_engine_abi_version() == 1`; C++ exceptions become error codes and `lastError` strings.

- [ ] **Step 1: Write failing C ABI lifecycle tests.**

First add the `GuitarEngineAbiTests` executable to `CMakeLists.txt` with the test source and public include directory but without a production-library link; then create `guitar_engine_abi_test.cpp` before adding production ABI code. Add tests that `guitar_engine_abi_version()` returns 1, `guitar_engine_create()` returns a valid handle, and initial state JSON reports `running:false`, `sampleRate:48000`, `bufferSize:128`, and an empty `blocks` array. Call `guitar_engine_destroy(nullptr)` and verify the process continues; `guitar_engine_stop()` on a stopped engine must return `GE_OK`.

```cpp
#include <array>
#include <string>
#include <gtest/gtest.h>
#include "guitar_engine.h"

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
```

Run from `desktop/native/` after registering `GuitarEngineAbiTests` in CMake:

```sh
cmake --build --preset macos-arm64 --target GuitarEngineAbiTests && ctest --preset macos-arm64 -R GuitarEngineAbiTests --output-on-failure
```

Expected before implementation: compilation fails because `guitar_engine.h` and the ABI functions do not exist.

- [ ] **Step 2: Implement device enumeration and native host lifecycle.**

Use JUCE `AudioDeviceManager` and a custom `AudioIODeviceCallback`. `guitar_engine_list_devices` returns JSON in the supplied buffer. `guitar_engine_start` selects device IDs and channel masks, requests 128 samples by default and 48000 Hz when supported; otherwise it opens the device's preferred rate and resamples at the 48 kHz chain boundary. It reports the actual negotiated rate/buffer. `guitar_engine_stop` detaches the callback before releasing the device. Device failures update `lastError` and leave `running` false. Define the `AudioEngine` shared target from the chain, realtime processor, audio-device host, and C ABI sources; link `NAM`, JUCE `juce_audio_devices`, `juce_audio_formats`, `juce_audio_utils`, `juce_core`, and `juce_dsp`, and force-load the static NAM archive. Link `GuitarEngineAbiTests` to `AudioEngine` after the red test is recorded.

- [ ] **Step 3: Implement the versioned C ABI and meter snapshot.**

Add `guitar_engine_set_input_gain`, `guitar_engine_set_master_gain`, `guitar_engine_add_file`, `guitar_engine_remove_block`, `guitar_engine_reorder`, `guitar_engine_set_param`, `guitar_engine_snapshot`, and `guitar_engine_last_error`. `set_param` accepts only `bypassed`, `inputGainDb`, `outputGainDb`, and `mix`. Each API validates pointers, path length, block IDs, parameter names, finite numeric values, and output buffer capacity. Return `GE_BUFFER_TOO_SMALL` with the exact required byte count; never return a partially terminated JSON string. Return `GE_BUSY` for control-graph queue backpressure so callers can distinguish it from invalid input, missing blocks, and model load failures.

- [ ] **Step 4: Verify the realtime callback does not allocate.**

Add `RealtimeAudioTests` with `realtime_audio_test.cpp` and the pinned NAM Core `tools/test/allocation_tracking.cpp`. Build an A2 model and `RealtimeProcessor`, prepare 44.1 kHz device input with a 128-sample maximum before allocation tracking starts, and prefill fixed input/output arrays. Run at least 64 normal calls and one oversized 129-sample call to the same `RealtimeProcessor::Process` method used by the JUCE callback under `allocation_tracking::run_allocation_test_no_allocations`; perform all GoogleTest assertions after tracking is disabled. Assert the oversized call returns silence, increments the underrun count, and performs no allocation. Expected: zero allocations and zero deallocations while the model and both Lanczos resamplers process steady-state blocks and reject oversized input.

- [ ] **Step 5: Verify C++ tests and the shared library.**

Run from `desktop/native/`:

```sh
cmake --preset macos-arm64 && cmake --build --preset macos-arm64 && ctest --preset macos-arm64 --output-on-failure
```

Expected: all C++ tests pass and `desktop/native/build/arm64/libAudioEngine.dylib` is produced.

- [ ] **Step 6: Commit the JUCE host and C API.**

```sh
git add desktop/native
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'feat(desktop): 暴露 CoreAudio 引擎 C ABI'
```

## Task 4: Implement the Go purego Engine Adapter

**Files:**

- Create: `desktop/internal/engine/native_darwin.go`
- Create: `desktop/internal/engine/engine_test.go`
- Modify: `desktop/go.mod`, `desktop/go.sum`, `desktop/internal/engine/engine.go`

**Interfaces:**

- Implement the `Engine`, `Device`, `AudioConfig`, `Block`, and `Snapshot` definitions from the File Map.
- `NewNative(path string) (Engine, error)` loads the dylib with `purego.Dlopen`, resolves each C symbol, checks ABI version 1, creates the C handle, and closes the handle and dylib in `Close()`.
- Resolve the library path from `GUITAR_AUDIO_ENGINE_PATH` first. Otherwise call `mygo.App.Path(mygo.PathResources)`, try `AudioEngine.dylib` at the resource root, then try `darwin-arm64/AudioEngine.dylib` for tests running in the source tree.

- [ ] **Step 1: Write failing tests for JSON decoding and status mapping.**

Add table-driven tests for a valid two-device payload, a valid chain snapshot, unknown block kinds, malformed JSON, NaN/Inf gain rejection, and conversion of `GE_BUFFER_TOO_SMALL` into a retry with the returned required size.

```go
func TestDecodeSnapshotPreservesBlockOrder(t *testing.T) {
	data := []byte(`{"running":false,"sampleRate":48000,"bufferSize":128,"blocks":[{"id":"od","kind":"nam","path":"/models/od.nam"},{"id":"cab","kind":"ir","path":"/models/cab.wav"}]}`)
	snapshot, err := decodeSnapshot(data)
	if err != nil {
		t.Fatal(err)
	}
	if got := []string{snapshot.Blocks[0].ID, snapshot.Blocks[1].ID}; !reflect.DeepEqual(got, []string{"od", "cab"}) {
		t.Fatalf("block order = %v, want [od cab]", got)
	}
}
```

Run `cd desktop && go test ./internal/engine`. Expected before implementation: FAIL because the decoder and engine methods do not exist.

- [ ] **Step 2: Pin purego and implement C symbol registration and path resolution.**

Run `go get github.com/ebitengine/purego@v0.11.1` and `go mod tidy` from `desktop/`. Register C function pointers with purego once at engine construction; keep the dylib open for the engine lifetime. Do not create Go callbacks and never call Go from the native audio callback. Use `GUITAR_AUDIO_ENGINE_PATH` for tests/dev; otherwise load the library from MyGo `PathResources`, using the source-tree `darwin-arm64/` fallback when present.

- [ ] **Step 3: Implement Engine methods and safe buffers.**

Convert C error codes into typed Go errors. Grow caller-owned byte buffers when the C API returns `GE_BUFFER_TOO_SMALL`. Keep each Go byte slice alive through the C call with `runtime.KeepAlive`. Reject non-finite gain values and unknown parameter names before native calls.

- [ ] **Step 4: Run Go tests and native ABI smoke test.**

Run:

```sh
cd desktop
GUITAR_AUDIO_ENGINE_PATH=./native/build/arm64/libAudioEngine.dylib go test ./...
```

Expected: pure Go tests pass and the integration test reads ABI version 1 and the empty initial snapshot from the built dylib.

- [ ] **Step 5: Commit the purego adapter.**

```sh
git add desktop/go.mod desktop/go.sum desktop/internal/engine
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'feat(desktop): 连接 MyGo 与原生音频引擎'
```

## Task 5: Connect MyGo UI to Devices and Effect Blocks

**Files:**

- Create: `desktop/internal/app/view.go`, `desktop/internal/app/controller.go`, `desktop/internal/app/controller_test.go`
- Modify: `desktop/main.go`, `desktop/internal/app/model.go`, `desktop/internal/app/model_test.go`

**Interfaces:**

- `Controller.RefreshDevices()`, `StartMonitoring(AudioConfig)`, `StopMonitoring()`, `SetInputGain(float64)`, `SetMasterGain(float64)`, `AddFile(path)`, `RemoveBlock(id)`, `ReorderBlocks(ids)`, `SetBlockParam(id, name, value)`, and `RefreshSnapshot()` call the `engine.Engine` interface.
- `BlockItem` contains `Block engine.Block`. `AppState` contains `Running bool`, `Status string`, `Message string`, `Devices []engine.Device`, `SelectedInputID string`, `InputChannel int`, `SelectedOutputID string`, `BufferSize int`, `InputGainDB float64`, `OutputGainDB float64`, `Blocks []BlockItem`, `InputMeterDB float64`, and `OutputMeterDB float64`.
- The MyGo view reads app state on the UI thread. Slow file dialogs and engine operations run in goroutines; state changes return through `Window.Update`. Poll engine meters/status every 33 ms from a Go ticker and apply snapshots through `Window.Update`; never poll or call Go from the audio callback.

- [ ] **Step 1: Write failing controller tests.**

Use a fake Go `Engine` to test the state transitions: startup remains stopped, successful `StartMonitoring` changes status to running, failed start leaves it stopped and displays the engine error, `AddFile` appends the returned block in order, and `RemoveBlock` removes only the requested ID.

```go
func TestStartFailureKeepsMonitoringStopped(t *testing.T) {
	engine := &fakeEngine{startErr: errors.New("no input device")}
	controller := NewController(engine)
	if err := controller.StartMonitoring(AudioConfig{InputChannel: 0, BufferSize: 128}); err == nil {
		t.Fatal("StartMonitoring() error = nil, want no-device error")
	}
	state := controller.State()
	if state.Running || state.Status != "Stopped" || state.Message != "no input device" {
		t.Fatalf("state after failed start = %+v", state)
	}
}
```

Define this fake in the same test file; its state is plain Go data and it never touches CoreAudio:

```go
type fakeEngine struct {
	startErr     error
	running      bool
	inputGainDB  float64
	outputGainDB float64
	devices      []engine.Device
	blocks       []engine.Block
}

func (f *fakeEngine) Devices() ([]engine.Device, error) { return f.devices, nil }
func (f *fakeEngine) Start(engine.AudioConfig) error {
	if f.startErr == nil {
		f.running = true
	}
	return f.startErr
}
func (f *fakeEngine) Stop() error { f.running = false; return nil }
func (f *fakeEngine) SetInputGain(value float64) error { f.inputGainDB = value; return nil }
func (f *fakeEngine) SetMasterGain(value float64) error { f.outputGainDB = value; return nil }
func (f *fakeEngine) AddFile(path string) (engine.Block, error) {
	kind := "ir"
	if strings.EqualFold(filepath.Ext(path), ".nam") {
		kind = "nam"
	}
	block := engine.Block{ID: path, Kind: kind, Path: path, Mix: 1}
	f.blocks = append(f.blocks, block)
	return block, nil
}
func (f *fakeEngine) RemoveBlock(id string) error {
	for i := range f.blocks {
		if f.blocks[i].ID == id {
			f.blocks = append(f.blocks[:i], f.blocks[i+1:]...)
			return nil
		}
	}
	return engine.ErrBlockNotFound
}
func (f *fakeEngine) Reorder(ids []string) error {
	byID := make(map[string]engine.Block, len(f.blocks))
	for _, block := range f.blocks {
		byID[block.ID] = block
	}
	ordered := make([]engine.Block, 0, len(ids))
	for _, id := range ids {
		block, ok := byID[id]
		if !ok {
			return engine.ErrBlockNotFound
		}
		ordered = append(ordered, block)
	}
	f.blocks = ordered
	return nil
}
func (f *fakeEngine) SetParam(id, name string, value float64) error {
	for i := range f.blocks {
		if f.blocks[i].ID == id {
			switch name {
			case "bypassed": f.blocks[i].Bypassed = value != 0
			case "inputGainDb": f.blocks[i].InputGainDB = value
			case "outputGainDb": f.blocks[i].OutputGainDB = value
			case "mix": f.blocks[i].Mix = value
			default: return engine.ErrInvalidParameter
			}
			return nil
		}
	}
	return engine.ErrBlockNotFound
}
func (f *fakeEngine) Snapshot() (engine.Snapshot, error) {
	return engine.Snapshot{Running: f.running, InputGainDB: f.inputGainDB, OutputGainDB: f.outputGainDB, Blocks: append([]engine.Block(nil), f.blocks...)}, nil
}
func (f *fakeEngine) Close() error { return nil }
```

Run `cd desktop && go test ./internal/app`. Expected before implementation: FAIL because the controller and fake engine do not exist.

- [ ] **Step 2: Implement controller state updates.**

The controller owns the engine handle and app state. On each engine result, update a copied state value and call an injected `updateOnMain(func())` callback, implemented with `window.Update`. Never mutate UI state directly from a background goroutine.

- [ ] **Step 3: Implement device and transport controls.**

Use `ui.Select` for input/output device IDs, input channel, and supported buffer sizes 64/128/256. Add a Start/Stop button. Start is disabled until the user selects an input device, input channel, and output device; the status changes only after the engine confirms the device open. Add input and master gain sliders from -24 dB to +24 dB, initially 0 dB.

- [ ] **Step 4: Implement local NAM/IR import and chain controls.**

Use `mygo.Dialog.Open` with filters `{Name:"NAM models", Extensions:[]string{"nam"}}` and `{Name:"WAV impulse responses", Extensions:[]string{"wav"}}`. Add blocks from the chosen files using their original paths. Render ordered blocks in `ui.List`; use `ListState.Reorder` to reorder them. Each block has bypass, input gain, output gain, mix, and remove controls. Display meters, block-load errors, device errors, and clipping text. Do not copy imported files.

- [ ] **Step 5: Add MyGo interaction tests and build the app.**

Use `ui.NewTester` to click Start, Add NAM Model, bypass, reorder, adjust a block gain/mix, and Remove against a fake engine. Assert each action calls the expected engine method and the view updates its status. Run:

```sh
cd desktop && go test ./... && go tool mygo build
```

Expected: UI/controller tests pass and `desktop/build/darwin-arm64/` contains the `.app` bundle.

- [ ] **Step 6: Commit device and chain UI.**

```sh
git add desktop/internal/app desktop/main.go
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'feat(desktop): 增加声卡与 NAM 效果链界面'
```

## Task 6: Save and Restore Local Presets

**Files:**

- Create: `desktop/internal/preset/preset.go`, `desktop/internal/preset/preset_test.go`
- Modify: `desktop/internal/app/controller.go`, `desktop/internal/app/view.go`, `desktop/internal/app/controller_test.go`

**Interfaces:**

```go
type Preset struct {
	SchemaVersion int           `json:"schemaVersion"`
	EngineRate    int           `json:"engineSampleRate"`
	InputGainDB   float64       `json:"inputGainDb"`
	OutputGainDB  float64       `json:"outputGainDb"`
	Blocks        []PresetBlock `json:"blocks"`
}

type PresetBlock struct {
	Kind         string  `json:"kind"`
	Path         string  `json:"path"`
	Bypassed     bool    `json:"bypassed"`
	InputGainDB  float64 `json:"inputGainDb"`
	OutputGainDB float64 `json:"outputGainDb"`
	Mix          float64 `json:"mix"`
}
```

- `Controller.LoadPreset(preset.Preset) error` restores loaded blocks in preset order and keeps missing paths as unresolved `BlockItem`s. `Controller.RelinkBlock(placeholderID, path) error` loads a replacement file of the same block kind, reapplies the saved parameters, and reorders loaded engine blocks to the visible app order.
- `BlockItem` extends the Task 5 shape with `Missing bool` and `Message string`, so an unresolved path remains visible with a `Relink` action and an explanatory error.

- [ ] **Step 1: Write failing preset round-trip tests.**

Test round-tripping a NAM → IR chain with input/output gains and bypass, rejecting unknown schema versions, rejecting unsupported block kinds, and preserving a missing model path as an unresolved block rather than dropping it. Add a controller test that restores one existing file and one missing file, verifies both slots remain visible, relinks the missing slot to a real file through the fake engine, and checks that engine order and block parameters match the preset.

```go
func TestPresetRoundTripKeepsPathsAndOrder(t *testing.T) {
	want := Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6, Blocks: []PresetBlock{
		{Kind: "nam", Path: "/models/drive.nam", InputGainDB: 3, Mix: 1},
		{Kind: "ir", Path: "/models/cab.wav", Bypassed: true, InputGainDB: -2, OutputGainDB: -3, Mix: 0.8},
	}}
	got, err := Decode(Encode(want))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("preset round-trip = %#v, want %#v", got, want)
	}
}
```

Add this controller behavior test after the codec test:

```go
func TestMissingPresetBlockCanBeRelinkedInPlace(t *testing.T) {
	dir := t.TempDir()
	existing := filepath.Join(dir, "amp.nam")
	replacement := filepath.Join(dir, "replacement.wav")
	if err := os.WriteFile(existing, []byte("fixture"), 0o600); err != nil { t.Fatal(err) }
	if err := os.WriteFile(replacement, []byte("fixture"), 0o600); err != nil { t.Fatal(err) }
	fake := &fakeEngine{}
	controller := NewController(fake)
	preset := Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []PresetBlock{
		{Kind: "nam", Path: existing, Mix: 1},
		{Kind: "ir", Path: filepath.Join(dir, "moved.wav"), Bypassed: true, InputGainDB: 1, OutputGainDB: -2, Mix: 0.5},
	}}
	if err := controller.LoadPreset(preset); err != nil { t.Fatal(err) }
	if got := controller.State().Blocks[1].Block.Path; got != preset.Blocks[1].Path {
		t.Fatalf("missing block path = %q, want %q", got, preset.Blocks[1].Path)
	}
	if err := controller.RelinkBlock("missing:1", replacement); err != nil { t.Fatal(err) }
	state := controller.State()
	if state.Blocks[1].Missing || state.Blocks[1].Block.Path != replacement {
		t.Fatalf("relinked block = %+v", state.Blocks[1])
	}
	if len(fake.blocks) != 2 || fake.blocks[0].Path != existing || fake.blocks[1].Path != replacement {
		t.Fatalf("engine order after relink = %+v", fake.blocks)
	}
	block := fake.blocks[1]
	if !block.Bypassed || block.InputGainDB != 1 || block.OutputGainDB != -2 || block.Mix != 0.5 {
		t.Fatalf("relinked block parameters = %+v", block)
	}
}
```

Run `cd desktop && go test ./internal/preset`. Expected before implementation: FAIL because the preset schema and codec do not exist.

- [ ] **Step 2: Implement strict versioned JSON encode/decode.**

`Encode` writes indented JSON with schema version 1. `Decode` rejects malformed JSON, unknown schema versions, empty paths, unknown block kinds, NaN/Inf parameters, and mix values outside `[0,1]`. Do not read or write model bytes.

- [ ] **Step 3: Persist presets under MyGo user data.**

Save `.json` presets beneath `mygo.App.Path(mygo.PathUserData)/presets`. Use the save dialog to choose a filename; write to a sibling temporary file and rename atomically. On restore, validate the schema, report missing file paths, load existing blocks in saved order, then apply parameters. Preserve unresolved blocks so the user can relink them later, and add a `Relink` action for each unresolved row in the chain view.

- [ ] **Step 4: Verify preset and app tests.**

Run `cd desktop && go test ./...`. Expected: preset round-trip, missing-path, controller restore, and MyGo view tests pass.

- [ ] **Step 5: Commit preset support.**

```sh
git add desktop/internal/preset desktop/internal/app
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'feat(desktop): 保存与恢复本地效果链预设'
```

## Task 7: Package the macOS App and Verify the Full Chain

**Files:**

- Create: `desktop/scripts/build-native.sh`, `desktop/scripts/build-app.sh`, `desktop/README.md`
- Modify: `desktop/mygo.json`, `desktop/native/CMakePresets.json`
- Generated, ignored: `desktop/resources/darwin-arm64/AudioEngine.dylib`, `desktop/native/build/`, `desktop/build/`

- [ ] **Step 1: Build and copy the native library into MyGo resources.**

`build-native.sh` configures preset `macos-arm64` for macOS 13.0+, builds `AudioEngine`, runs CTest, and copies `native/build/arm64/libAudioEngine.dylib` to `resources/darwin-arm64/AudioEngine.dylib`. MyGo automatically packages resources from that platform directory into the app's top-level resources as `AudioEngine.dylib`; do not also list the file explicitly in `mygo.json`, which would package it twice. The script exits nonzero on any failed command.

The existing `desktop/.gitignore` excludes the generated app, native build, and platform resource dylib.

- [ ] **Step 2: Package the MyGo app.**

`build-app.sh` runs `build-native.sh`, `go test ./...`, then `go tool mygo build`. The MyGo app identity is `com.damonrock.guitareffects`; output is under `desktop/build/darwin-arm64/`. `desktop/README.md` documents local build/run steps, the C++/Go dependency pins, and license notices for JUCE, NAM Core, AudioDSPTools and its included resampler source; it states that TONE3000 source code and assets were not copied.

- [ ] **Step 3: Run all automatic gates.**

From `desktop/native/` run:

```sh
cmake --build --preset macos-arm64 && ctest --preset macos-arm64 --output-on-failure
```

From `desktop/` run:

```sh
go test ./... && go tool mygo build
```

From the repository root run:

```sh
npm run typecheck && npm test && npm run build
```

Expected: all 6 CTest cases, Go tests, root 38-file/412-test suite, typecheck, and 11-page static Next.js build pass.

- [ ] **Step 4: Perform real-device acceptance.**

Launch the built `.app`, grant macOS audio input access, select the connected interface input and headphone output, and verify: the input meter moves; Start begins monitoring; a local A2 NAM and WAV IR load in sequence; bypass and block reorder change the sound; Stop silences monitoring; the preset survives restart. Run continuously for 15 minutes at 48 kHz / 128 samples and record underruns or audible dropouts.

- [ ] **Step 5: Commit build scripts and desktop instructions.**

```sh
git add desktop/scripts desktop/README.md desktop/.gitignore desktop/native/CMakePresets.json
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' commit -m 'build(desktop): 打包 macOS NAM 效果器应用'
```

## Plan Self-Review

- Spec coverage: independent MyGo project, native device selection, 48 kHz NAM/IR chain, C ABI, purego bridge, bypass/gain/mix/reorder, local paths and presets, error states, packaging, automated tests, root regression gates, and real-interface acceptance are assigned to Tasks 1–7.
- Dependency check: the source list and A2 fixture path match the pinned NeuralAmpModelerCore revision; AudioDSPTools is used from its recursively pinned submodule, without a duplicate checkout.
- Placeholder scan: no `TBD`, `TODO`, or open-ended test tasks remain; every test command and expected result is named.
- Type consistency: the C ABI uses `guitar_engine_*`; the Go adapter maps it to `Engine`; the app controller consumes `Engine`; preset restore uses the same ordered `AddFile`, `Reorder`, and `SetParam` methods.
