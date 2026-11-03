package engine

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// nativeLibraryPath returns the native audio engine library used by the
// integration test. A relative path is resolved against the desktop
// directory, because the test runs in the package directory, and the
// resolved path is exported so that the engine loads the same library.
func nativeLibraryPath(t *testing.T) string {
	t.Helper()
	path, err := resolveLibraryPath("")
	if err != nil {
		t.Skipf("no native audio engine library: %v", err)
	}
	if !filepath.IsAbs(path) {
		root, ok := sourceTreeRoot()
		if !ok {
			t.Skipf("cannot resolve the relative library path %q", path)
		}
		path = filepath.Join(root, path)
	}
	if !isRegularFile(path) {
		t.Skipf("the native audio engine library %q is not built", path)
	}
	t.Setenv(libraryEnvVar, path)
	return path
}

func TestBundledLibraryPathUsesConfiguredResourceName(t *testing.T) {
	resources := t.TempDir()
	want := filepath.Join(resources, "libAudioEngine.dylib")
	if err := os.WriteFile(want, []byte("test library"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := bundledLibraryPath(resources); got != want {
		t.Fatalf("bundledLibraryPath() = %q, want %q", got, want)
	}
}

func TestNativeEngineReadsABIAndInitialSnapshot(t *testing.T) {
	library := nativeLibraryPath(t)
	engine, err := NewNative(library)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := engine.Close(); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	}()

	native, ok := engine.(*nativeEngine)
	if !ok {
		t.Fatalf("engine type = %T, want *nativeEngine", engine)
	}
	if version := native.abiVersion(); version != abiVersion {
		t.Fatalf("ABI version = %d, want %d", version, abiVersion)
	}

	snapshot, err := engine.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Running {
		t.Fatal("running = true, want false for a fresh engine")
	}
	if len(snapshot.Blocks) != 0 {
		t.Fatalf("block count = %d, want 0", len(snapshot.Blocks))
	}
	if snapshot.SampleRate != 48000 || snapshot.BufferSize != 128 {
		t.Fatalf("sample rate / buffer size = %d / %d, want 48000 / 128",
			snapshot.SampleRate, snapshot.BufferSize)
	}
	if snapshot.LastError != "" {
		t.Fatalf("last error = %q, want an empty message", snapshot.LastError)
	}
}

func TestNativeEngineRejectsInvalidInputBeforeCallingNative(t *testing.T) {
	library := nativeLibraryPath(t)
	engine, err := NewNative(library)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := engine.Close(); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	}()

	if err := engine.SetInputGain(math.NaN()); err == nil {
		t.Fatal("SetInputGain(NaN) error = nil, want an error")
	}
	if err := engine.SetParam("nam-1", "drive", 1); err == nil {
		t.Fatal("SetParam() with an unknown parameter error = nil, want an error")
	}
	if err := engine.Start(AudioConfig{}); err == nil {
		t.Fatal("Start() without devices error = nil, want an error")
	}
}

func TestNativeEngineAddsAndRemovesABlock(t *testing.T) {
	library := nativeLibraryPath(t)
	engine, err := NewNative(library)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := engine.Close(); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	}()

	path := filepath.Join(t.TempDir(), "cabinet.wav")
	writeSilentWav(t, path)
	block, err := engine.AddFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if block.ID == "" {
		t.Fatal("block id is empty")
	}
	if block.Kind != "ir" {
		t.Fatalf("block kind = %q, want %q", block.Kind, "ir")
	}
	if block.Path != path {
		t.Fatalf("block path = %q, want %q", block.Path, path)
	}

	snapshot, err := engine.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Blocks) != 1 || snapshot.Blocks[0].ID != block.ID {
		t.Fatalf("snapshot blocks = %+v", snapshot.Blocks)
	}

	if err := engine.SetParam(block.ID, "mix", 0.5); err != nil {
		t.Fatal(err)
	}
	if err := engine.RemoveBlock(block.ID); err != nil {
		t.Fatal(err)
	}
	snapshot, err = engine.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Blocks) != 0 {
		t.Fatalf("snapshot blocks after removal = %+v", snapshot.Blocks)
	}
	if err := engine.RemoveBlock(block.ID); !errors.Is(err, ErrBlockNotFound) {
		t.Fatalf("RemoveBlock() of a missing block error = %v, want ErrBlockNotFound", err)
	}
}

func TestNativeEngineListsDevices(t *testing.T) {
	library := nativeLibraryPath(t)
	engine, err := NewNative(library)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := engine.Close(); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	}()

	// The audio devices of the machine are not part of the contract, so the
	// test only checks that the list is decoded and every entry is complete.
	devices, err := engine.Devices()
	if err != nil {
		t.Fatal(err)
	}
	for _, device := range devices {
		if device.ID == "" || device.Name == "" {
			t.Fatalf("device = %+v, want an id and a name", device)
		}
	}
}

func TestNativeEngineReportsTheLoadFailureOfEachFile(t *testing.T) {
	library := nativeLibraryPath(t)
	engine, err := NewNative(library)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := engine.Close(); err != nil {
			t.Errorf("Close() error = %v", err)
		}
	}()

	// Every worker loads a different missing file, so every error message
	// has to name its own path. The calls run at the same time, which
	// interleaves the status code of one call with the last error message
	// of another one unless the adapter keeps both together.
	const workers = 16
	paths := make([]string, workers)
	for index := range paths {
		paths[index] = filepath.Join(t.TempDir(), fmt.Sprintf("missing-%d.wav", index))
	}

	results := make([]error, workers)
	start := make(chan struct{})
	var group sync.WaitGroup
	for index := range paths {
		group.Add(1)
		go func(index int) {
			defer group.Done()
			<-start
			_, results[index] = engine.AddFile(paths[index])
		}(index)
	}
	close(start)
	group.Wait()

	for index, err := range results {
		var engineError *Error
		if !errors.As(err, &engineError) {
			t.Fatalf("AddFile(%s) error = %v, want an *engine.Error", paths[index], err)
		}
		if engineError.Code != statusModelLoadFailed {
			t.Fatalf("AddFile(%s) code = %d, want %d",
				paths[index], engineError.Code, statusModelLoadFailed)
		}
		if !strings.Contains(engineError.Message, paths[index]) {
			t.Fatalf("AddFile(%s) message = %q, want it to name its own file",
				paths[index], engineError.Message)
		}
	}
}

func TestNativeEngineCloseReleasesTheEngine(t *testing.T) {
	library := nativeLibraryPath(t)
	engine, err := NewNative(library)
	if err != nil {
		t.Fatal(err)
	}
	if err := engine.Close(); err != nil {
		t.Fatal(err)
	}
	if err := engine.Close(); err != nil {
		t.Fatalf("second Close() error = %v, want nil", err)
	}
	if _, err := engine.Snapshot(); err == nil {
		t.Fatal("Snapshot() after Close() error = nil, want an error")
	}
}

func TestNativeEngineResolvesTheLibraryFromTheEnvironment(t *testing.T) {
	library := nativeLibraryPath(t)
	t.Setenv(libraryEnvVar, library)
	resolved, err := resolveLibraryPath("")
	if err != nil {
		t.Fatal(err)
	}
	if resolved != library {
		t.Fatalf("resolved path = %q, want %q", resolved, library)
	}
	if os.Getenv(libraryEnvVar) != library {
		t.Fatalf("environment variable = %q, want %q", os.Getenv(libraryEnvVar), library)
	}
}

func TestResolveLibraryPathPrefersTheEnvironment(t *testing.T) {
	t.Setenv(libraryEnvVar, "/tmp/from-environment.dylib")
	resolved, err := resolveLibraryPath("/tmp/from-argument.dylib")
	if err != nil {
		t.Fatal(err)
	}
	if resolved != "/tmp/from-environment.dylib" {
		t.Fatalf("resolved path = %q, want the environment path", resolved)
	}
}

func TestResolveLibraryPathUsesTheArgumentWithoutTheEnvironment(t *testing.T) {
	t.Setenv(libraryEnvVar, "")
	resolved, err := resolveLibraryPath("/tmp/from-argument.dylib")
	if err != nil {
		t.Fatal(err)
	}
	if resolved != "/tmp/from-argument.dylib" {
		t.Fatalf("resolved path = %q, want the argument path", resolved)
	}
}

// writeSilentWav writes a short mono PCM wave file that the native engine
// can load as an impulse response.
func writeSilentWav(t *testing.T, path string) {
	t.Helper()
	const sampleRate = 48000
	const samples = 480
	dataLength := samples * 2

	wave := make([]byte, 0, 44+dataLength)
	wave = append(wave, "RIFF"...)
	wave = binary.LittleEndian.AppendUint32(wave, uint32(36+dataLength))
	wave = append(wave, "WAVEfmt "...)
	wave = binary.LittleEndian.AppendUint32(wave, 16)
	wave = binary.LittleEndian.AppendUint16(wave, 1)
	wave = binary.LittleEndian.AppendUint16(wave, 1)
	wave = binary.LittleEndian.AppendUint32(wave, sampleRate)
	wave = binary.LittleEndian.AppendUint32(wave, sampleRate*2)
	wave = binary.LittleEndian.AppendUint16(wave, 2)
	wave = binary.LittleEndian.AppendUint16(wave, 16)
	wave = append(wave, "data"...)
	wave = binary.LittleEndian.AppendUint32(wave, uint32(dataLength))
	for range samples {
		wave = binary.LittleEndian.AppendUint16(wave, 0)
	}
	if err := os.WriteFile(path, wave, 0o644); err != nil {
		t.Fatal(err)
	}
}
