package engine

// The file name restricts this adapter to macOS, which is the only platform
// the MyGo desktop app ships on.

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/ebitengine/purego"
	"github.com/egoist/mygo"
)

const (
	// libraryEnvVar overrides the location of the native audio engine. It is
	// used by the tests and by local development.
	libraryEnvVar = "GUITAR_AUDIO_ENGINE_PATH"
	// libraryFileName is the name of the native audio engine inside the
	// application resources.
	libraryFileName = "AudioEngine.dylib"
	// platformResourceDir holds the resources of the macOS arm64 build.
	platformResourceDir = "darwin-arm64"
	// abiVersion is the version of the C ABI this adapter speaks.
	abiVersion = 1
)

// nativeEngine drives the native audio engine through its C ABI.
//
// Every method holds the mutex for the whole native exchange, including the
// read of the last error message. The native side serializes the control
// calls themselves, but the status code of a call and the message that
// explains it are two separate native calls: without the mutex, a second
// call could overwrite the message between them and the first caller would
// report the failure of an unrelated operation.
//
// The mutex also keeps Close safe, because guitar_engine_destroy must not
// overlap with any other call on the handle.
type nativeEngine struct {
	mu     sync.Mutex
	lib    uintptr
	handle uintptr
	closed bool

	abiVersion    func() uint32
	create        func() uintptr
	destroy       func(engine uintptr)
	listDevices   func(engine uintptr, jsonOut []byte, capacity uintptr, written *uintptr) int
	start         func(engine uintptr, inputDeviceID string, inputChannel int, outputDeviceID string, bufferSize int) int
	stop          func(engine uintptr) int
	setInputGain  func(engine uintptr, gainDB float64) int
	setMasterGain func(engine uintptr, gainDB float64) int
	addFile       func(engine uintptr, path string, blockIDOut []byte, capacity uintptr, written *uintptr) int
	removeBlock   func(engine uintptr, blockID string) int
	reorder       func(engine uintptr, blockIDsJSON string) int
	setParam      func(engine uintptr, blockID string, name string, value float64) int
	snapshot      func(engine uintptr, jsonOut []byte, capacity uintptr, written *uintptr) int
	lastError     func(engine uintptr, textOut []byte, capacity uintptr, written *uintptr) int
}

// NewNative loads the native audio engine and returns an Engine that talks
// to it over the C ABI. The library is taken from the environment, from the
// given path or from the MyGo resources, in that order.
func NewNative(path string) (Engine, error) {
	library, err := resolveLibraryPath(path)
	if err != nil {
		return nil, err
	}
	lib, err := purego.Dlopen(library, purego.RTLD_NOW|purego.RTLD_LOCAL)
	if err != nil {
		return nil, fmt.Errorf("open audio engine library %s: %w", library, err)
	}
	engine := &nativeEngine{lib: lib}
	if err := engine.bind(); err != nil {
		_ = purego.Dlclose(lib)
		return nil, err
	}
	if version := engine.abiVersion(); version != abiVersion {
		_ = purego.Dlclose(lib)
		return nil, fmt.Errorf("unsupported audio engine ABI version %d, want %d", version, abiVersion)
	}
	handle := engine.create()
	if handle == 0 {
		_ = purego.Dlclose(lib)
		return nil, errors.New("create audio engine: the native engine returned no handle")
	}
	engine.handle = handle
	return engine, nil
}

// bind resolves every C symbol of the ABI and registers it with purego.
func (e *nativeEngine) bind() error {
	symbols := []struct {
		name   string
		target any
	}{
		{"guitar_engine_abi_version", &e.abiVersion},
		{"guitar_engine_create", &e.create},
		{"guitar_engine_destroy", &e.destroy},
		{"guitar_engine_list_devices", &e.listDevices},
		{"guitar_engine_start", &e.start},
		{"guitar_engine_stop", &e.stop},
		{"guitar_engine_set_input_gain", &e.setInputGain},
		{"guitar_engine_set_master_gain", &e.setMasterGain},
		{"guitar_engine_add_file", &e.addFile},
		{"guitar_engine_remove_block", &e.removeBlock},
		{"guitar_engine_reorder", &e.reorder},
		{"guitar_engine_set_param", &e.setParam},
		{"guitar_engine_snapshot", &e.snapshot},
		{"guitar_engine_last_error", &e.lastError},
	}
	for _, symbol := range symbols {
		address, err := purego.Dlsym(e.lib, symbol.name)
		if err != nil {
			return fmt.Errorf("resolve %s: %w", symbol.name, err)
		}
		purego.RegisterFunc(symbol.target, address)
	}
	return nil
}

func (e *nativeEngine) Devices() ([]Device, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return nil, err
	}
	data, err := e.readBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		return e.listDevices(e.handle, buf, capacity, written)
	})
	if err != nil {
		return nil, err
	}
	return decodeDevices(data)
}

func (e *nativeEngine) Start(config AudioConfig) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if config.InputDeviceID == "" || config.OutputDeviceID == "" {
		return fmt.Errorf("%w: an input and an output device are required", ErrInvalidParameter)
	}
	if config.InputChannel < 0 || config.BufferSize < 0 {
		return fmt.Errorf("%w: the input channel and the buffer size must not be negative", ErrInvalidParameter)
	}
	code := e.start(e.handle, config.InputDeviceID, config.InputChannel, config.OutputDeviceID, config.BufferSize)
	if code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if code := e.stop(e.handle); code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) SetInputGain(gainDB float64) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if err := validateGain(gainDB); err != nil {
		return err
	}
	if code := e.setInputGain(e.handle, gainDB); code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) SetMasterGain(gainDB float64) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if err := validateGain(gainDB); err != nil {
		return err
	}
	if code := e.setMasterGain(e.handle, gainDB); code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) AddFile(path string) (Block, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return Block{}, err
	}
	if path == "" {
		return Block{}, fmt.Errorf("%w: a model file path is required", ErrInvalidParameter)
	}
	data, err := e.readBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		return e.addFile(e.handle, path, buf, capacity, written)
	})
	if err != nil {
		return Block{}, err
	}
	id := string(data)
	snapshot, err := e.snapshotLocked()
	if err != nil {
		return Block{}, err
	}
	for _, block := range snapshot.Blocks {
		if block.ID == id {
			return block, nil
		}
	}
	return Block{}, fmt.Errorf("audio block %q is missing from the engine snapshot", id)
}

func (e *nativeEngine) RemoveBlock(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if id == "" {
		return fmt.Errorf("%w: an audio block id is required", ErrInvalidParameter)
	}
	if code := e.removeBlock(e.handle, id); code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) Reorder(ids []string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if ids == nil {
		ids = []string{}
	}
	payload, err := json.Marshal(ids)
	if err != nil {
		return fmt.Errorf("encode audio block ids: %w", err)
	}
	if code := e.reorder(e.handle, string(payload)); code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) SetParam(id, name string, value float64) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return err
	}
	if id == "" {
		return fmt.Errorf("%w: an audio block id is required", ErrInvalidParameter)
	}
	if err := validateParam(name, value); err != nil {
		return err
	}
	if code := e.setParam(e.handle, id, name, value); code != statusOK {
		return e.errorFromCode(code)
	}
	return nil
}

func (e *nativeEngine) Snapshot() (Snapshot, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.checkOpen(); err != nil {
		return Snapshot{}, err
	}
	return e.snapshotLocked()
}

// Close destroys the native engine and releases the library. It is safe to
// call more than once.
func (e *nativeEngine) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.closed {
		return nil
	}
	e.closed = true
	if e.handle != 0 {
		e.destroy(e.handle)
		e.handle = 0
	}
	if e.lib != 0 {
		err := purego.Dlclose(e.lib)
		e.lib = 0
		return err
	}
	return nil
}

// snapshotLocked reads the engine snapshot. The caller holds the lock.
func (e *nativeEngine) snapshotLocked() (Snapshot, error) {
	data, err := e.readBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		return e.snapshot(e.handle, buf, capacity, written)
	})
	if err != nil {
		return Snapshot{}, err
	}
	return decodeSnapshot(data)
}

// readBuffer runs a native buffer-writing call and grows the destination
// buffer until the call succeeds.
func (e *nativeEngine) readBuffer(call bufferCall) ([]byte, error) {
	data, err := fillBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		code := call(buf, capacity, written)
		// The native side copies the payload during the call, but the
		// destination buffer must stay alive until the call returns.
		runtime.KeepAlive(buf)
		return code
	}, initialBufferCapacity)
	if err != nil {
		var status *statusError
		if errors.As(err, &status) {
			return nil, e.errorFromCode(status.code)
		}
		return nil, err
	}
	return data, nil
}

// errorFromCode turns a native status code into a typed error and attaches
// the last error message of the engine.
func (e *nativeEngine) errorFromCode(code int) error {
	return &Error{Code: code, Message: e.lastErrorMessage()}
}

// lastErrorMessage reads the last error message of the engine. It is empty
// when the message cannot be read.
func (e *nativeEngine) lastErrorMessage() string {
	if e.handle == 0 {
		return ""
	}
	data, err := fillBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		code := e.lastError(e.handle, buf, capacity, written)
		runtime.KeepAlive(buf)
		return code
	}, initialBufferCapacity)
	if err != nil {
		return ""
	}
	return string(data)
}

// checkOpen reports whether the engine can still be used.
func (e *nativeEngine) checkOpen() error {
	if e.closed {
		return errors.New("audio engine is closed")
	}
	return nil
}

// resolveLibraryPath finds the native audio engine library. The environment
// variable wins, because it is how the tests and the local development point
// the app at a specific build of the engine. Then the explicit path is used,
// then the MyGo resources, and finally the source tree, where the local
// build keeps the library.
func resolveLibraryPath(explicit string) (string, error) {
	if fromEnv := strings.TrimSpace(os.Getenv(libraryEnvVar)); fromEnv != "" {
		return fromEnv, nil
	}
	if explicit != "" {
		return explicit, nil
	}
	var tried []string
	if root, err := mygo.App.Path(mygo.PathResources); err == nil {
		candidates := []string{bundledLibraryPath(root)}
		tried = append(tried, candidates...)
		for _, candidate := range candidates {
			if isRegularFile(candidate) {
				return candidate, nil
			}
		}
	}
	if root, ok := sourceTreeRoot(); ok {
		candidates := []string{
			filepath.Join(root, "resources", platformResourceDir, libraryFileName),
			filepath.Join(root, "native", "build", "arm64", "lib"+libraryFileName),
			filepath.Join(root, "native", "build", "arm64", libraryFileName),
		}
		tried = append(tried, candidates...)
		for _, candidate := range candidates {
			if isRegularFile(candidate) {
				return candidate, nil
			}
		}
	}
	return "", fmt.Errorf("audio engine library not found, set %s (tried %s)",
		libraryEnvVar, strings.Join(tried, ", "))
}

func bundledLibraryPath(root string) string {
	for _, candidate := range []string{
		filepath.Join(root, libraryFileName),
		filepath.Join(root, platformResourceDir, libraryFileName),
		filepath.Join(root, "lib"+libraryFileName),
	} {
		if isRegularFile(candidate) {
			return candidate
		}
	}
	return filepath.Join(root, "lib"+libraryFileName)
}

// sourceTreeRoot returns the desktop directory of the source tree, which
// holds the native build output and the platform resources.
func sourceTreeRoot() (string, bool) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "", false
	}
	// The caller is desktop/internal/engine/native_darwin.go.
	dir := filepath.Dir(file)
	return filepath.Dir(filepath.Dir(dir)), true
}

// isRegularFile reports whether path is an existing regular file.
func isRegularFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}
