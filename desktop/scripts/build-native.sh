#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
desktop_dir="$(cd -- "$script_dir/.." && pwd)"
native_dir="$desktop_dir/native"
resource_dir="$desktop_dir/resources/darwin-arm64"

if [[ ! -f "$native_dir/external/NeuralAmpModelerCore/NAM/get_dsp.cpp" ]]; then
	printf '%s\n' "NAM sources are missing. Run: git submodule update --init --recursive" >&2
	exit 1
fi

(
	cd "$native_dir"
	cmake --preset macos-arm64
	cmake --build --preset macos-arm64
	ctest --preset macos-arm64 --output-on-failure
)

mkdir -p "$resource_dir"
cp "$native_dir/build/arm64/libAudioEngine.dylib" "$resource_dir/AudioEngine.dylib"
