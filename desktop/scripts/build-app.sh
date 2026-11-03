#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
desktop_dir="$(cd -- "$script_dir/.." && pwd)"

"$script_dir/build-native.sh"
cd "$desktop_dir"
go test ./...
go tool mygo build
