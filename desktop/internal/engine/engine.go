package engine

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
)

var (
	ErrBlockNotFound    = errors.New("audio block not found")
	ErrInvalidParameter = errors.New("invalid audio parameter")
	ErrBusy             = errors.New("audio engine is busy")
)

// Status codes returned by the native audio engine C ABI.
const (
	statusOK               = 0
	statusBufferTooSmall   = 1
	statusInvalidArgument  = 2
	statusInvalidParameter = 3
	statusBlockNotFound    = 4
	statusDeviceOpenFailed = 5
	statusModelLoadFailed  = 6
	statusNotRunning       = 7
	statusInternalError    = 8
	statusBusy             = 9
)

// initialBufferCapacity is the size of the first destination buffer handed to
// a native buffer-writing call. The native side reports the exact size it
// needs when the buffer is too small.
const initialBufferCapacity = 64 * 1024

// maxBufferRetries bounds how often a buffer-writing call is retried with a
// grown buffer before the engine gives up.
const maxBufferRetries = 4

// Error reports a failure of the native audio engine. Its Code is the status
// code of the C ABI, so callers can tell a busy engine from a missing block
// or an invalid parameter.
type Error struct {
	Code    int
	Message string
}

func (e *Error) Error() string {
	if e.Message == "" {
		return "audio engine error " + strconv.Itoa(e.Code)
	}
	return "audio engine error " + strconv.Itoa(e.Code) + ": " + e.Message
}

// Unwrap maps the native status code onto the sentinel errors of this
// package, so errors.Is reports ErrBlockNotFound, ErrInvalidParameter or
// ErrBusy for the matching status code.
func (e *Error) Unwrap() error {
	switch e.Code {
	case statusInvalidParameter:
		return ErrInvalidParameter
	case statusBlockNotFound:
		return ErrBlockNotFound
	case statusBusy:
		return ErrBusy
	}
	return nil
}

// statusError carries a native status code out of the buffer helpers.
type statusError struct {
	code int
}

func (e *statusError) Error() string {
	return "audio engine status " + strconv.Itoa(e.code)
}

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

type Device struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	InputChannels  int    `json:"inputChannels"`
	OutputChannels int    `json:"outputChannels"`
	SampleRates    []int  `json:"sampleRates"`
	BufferSizes    []int  `json:"bufferSizes"`
}

type AudioConfig struct {
	InputDeviceID  string `json:"inputDeviceId"`
	InputChannel   int    `json:"inputChannel"`
	OutputDeviceID string `json:"outputDeviceId"`
	BufferSize     int    `json:"bufferSize"`
}

type Block struct {
	ID           string  `json:"id"`
	Kind         string  `json:"kind"`
	Path         string  `json:"path"`
	Bypassed     bool    `json:"bypassed"`
	InputGainDB  float64 `json:"inputGainDb"`
	OutputGainDB float64 `json:"outputGainDb"`
	Mix          float64 `json:"mix"`
}

type Snapshot struct {
	Running        bool    `json:"running"`
	InputDeviceID  string  `json:"inputDeviceId"`
	OutputDeviceID string  `json:"outputDeviceId"`
	SampleRate     int     `json:"sampleRate"`
	BufferSize     int     `json:"bufferSize"`
	InputGainDB    float64 `json:"inputGainDb"`
	OutputGainDB   float64 `json:"outputGainDb"`
	Blocks         []Block `json:"blocks"`
	InputMeterDB   float64 `json:"inputMeterDb"`
	OutputMeterDB  float64 `json:"outputMeterDb"`
	Underruns      uint64  `json:"underruns"`
	LastError      string  `json:"lastError"`
}

// decodeDevices decodes the JSON device list of the native engine. Unknown
// fields are ignored so that a newer native engine can add device details
// without breaking the desktop app.
func decodeDevices(data []byte) ([]Device, error) {
	var devices []Device
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("decode audio devices: %w", err)
	}
	if devices == nil {
		devices = []Device{}
	}
	return devices, nil
}

// decodeSnapshot decodes the JSON snapshot of the native engine. Block kinds
// are passed through unchanged: the native engine owns the chain semantics,
// so an unknown kind is reported to the caller instead of being rejected.
func decodeSnapshot(data []byte) (Snapshot, error) {
	var snapshot Snapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return Snapshot{}, fmt.Errorf("decode engine snapshot: %w", err)
	}
	if snapshot.Blocks == nil {
		snapshot.Blocks = []Block{}
	}
	return snapshot, nil
}

// validateGain rejects gain values that the native engine cannot use.
func validateGain(gainDB float64) error {
	if math.IsNaN(gainDB) || math.IsInf(gainDB, 0) {
		return fmt.Errorf("%w: gain must be a finite number", ErrInvalidParameter)
	}
	return nil
}

// validateParam rejects parameter names the native engine does not know and
// values it cannot apply.
func validateParam(name string, value float64) error {
	switch name {
	case "bypassed":
		if value != 0 && value != 1 {
			return fmt.Errorf("%w: parameter %q must be 0 or 1", ErrInvalidParameter, name)
		}
	case "inputGainDb", "outputGainDb", "mix":
	default:
		return fmt.Errorf("%w: unknown parameter %q", ErrInvalidParameter, name)
	}
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return fmt.Errorf("%w: parameter %q must be a finite number", ErrInvalidParameter, name)
	}
	return nil
}

// bufferCall is a native call that writes a NUL terminated string into the
// destination buffer and reports the number of bytes it needs.
type bufferCall func(buf []byte, capacity uintptr, written *uintptr) int

// fillBuffer calls a native buffer-writing function and grows the
// destination buffer until the call succeeds. The returned bytes exclude the
// terminating NUL.
func fillBuffer(call bufferCall, initialCapacity int) ([]byte, error) {
	size := initialCapacity
	for attempt := 0; attempt < maxBufferRetries; attempt++ {
		buf := make([]byte, size)
		var written uintptr
		switch code := call(buf, uintptr(size), &written); code {
		case statusOK:
			length := int(written)
			if length > len(buf) {
				length = len(buf)
			}
			if length > 0 {
				length--
			}
			return buf[:length], nil
		case statusBufferTooSmall:
			needed := int(written)
			if needed <= size {
				needed = size * 2
			}
			size = needed
		default:
			return nil, &statusError{code: code}
		}
	}
	return nil, &statusError{code: statusInternalError}
}
