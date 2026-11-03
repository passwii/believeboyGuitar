# Guitar Effects for macOS

A native MyGo desktop app for monitoring a guitar through a local NAM model and WAV impulse-response chain. The audio engine runs at 48 kHz, accepts a mono input, and sends stereo output to the selected CoreAudio device.

## Requirements

- macOS 13.0 or later on Apple Silicon
- Xcode Command Line Tools
- Go 1.27.3
- CMake 3.22.1 or later and Ninja

The first launch may request microphone access. In the app, choose the guitar interface input and a headphone output, then start monitoring. Use headphones to avoid feedback. Add `.nam` models and mono WAV IRs from their existing locations; presets store paths and effect parameters without copying model files.

## Build

For a checkout cloned without submodules, initialize the pinned NAM source and its
nested dependencies once:

```sh
git submodule update --init --recursive
```

From any directory in the checkout:

```sh
./desktop/scripts/build-app.sh
```

The script configures and builds the native engine, runs CTest, copies the dylib to the MyGo platform resources, runs the Go test suite, and packages the app. Outputs are in `desktop/build/darwin-arm64/`.

To build only the native library and run its tests:

```sh
./desktop/scripts/build-native.sh
```

To run the Go app during development after building the native library:

```sh
cd desktop
go run .
```

To run the full repository checks:

```sh
npm run typecheck && npm test && npm run build
```

The CMake presets live under `desktop/native/`. Run CMake and CTest from that directory, and run Go commands from `desktop/`.

## Pinned dependencies and notices

- MyGo v0.6.2 — MIT; purego v0.11.1 — Apache-2.0; Go 1.27.3.
- JUCE 9.0.3 — AGPL-3.0 or a separate commercial JUCE licence. The upstream `LICENSE.md` and SPDX inventory are retained in the fetched JUCE source tree.
- NeuralAmpModelerCore commit `1f42f88535884450104b8711d7595019afa0495b` — MIT, copyright Steven Atkinson.
- AudioDSPTools commit `0827c6c2fc0deced568536142ea86f189e0b98a1` — MIT, copyright Steven Atkinson.
- Eigen commit `bc3b39870ecb690a623a3f49149a358b95c5781d` — primarily MPL-2.0, with third-party notices in its `COPYING.*` files.
- GoogleTest v1.15.2 — BSD-3-Clause.
- AudioDSPTools' `LanczosResampler.h` retains its upstream iPlug2 notice and the sst-basic-blocks GPL-3.0-or-later exception specific to that file. The included WDL headers retain Cockos notices. Keep these source notices intact when updating dependencies.

The desktop app is implemented independently. No TONE3000 source code, assets, model files, or branding were copied, and the app does not call the TONE3000 API.
