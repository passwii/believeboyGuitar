package engine

import (
	"errors"
	"math"
	"reflect"
	"testing"
)

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

func TestDecodeDevices(t *testing.T) {
	data := []byte(`[{"id":"in-1","name":"Scarlett 2i2","inputChannels":2,"outputChannels":0,"sampleRates":[44100,48000],"bufferSizes":[128,256]},{"id":"out-1","name":"Built-in Output","inputChannels":0,"outputChannels":2,"sampleRates":[48000],"bufferSizes":[512]}]`)
	devices, err := decodeDevices(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(devices) != 2 {
		t.Fatalf("device count = %d, want 2", len(devices))
	}
	if devices[0].ID != "in-1" || devices[0].Name != "Scarlett 2i2" {
		t.Fatalf("first device = %+v", devices[0])
	}
	if !reflect.DeepEqual(devices[0].SampleRates, []int{44100, 48000}) {
		t.Fatalf("sample rates = %v", devices[0].SampleRates)
	}
	if devices[1].OutputChannels != 2 {
		t.Fatalf("second device = %+v", devices[1])
	}
}

func TestDecodeSnapshot(t *testing.T) {
	tests := []struct {
		name    string
		data    string
		wantErr bool
		check   func(t *testing.T, snapshot Snapshot)
	}{
		{
			name: "valid chain snapshot",
			data: `{"running":true,"inputDeviceId":"in-1","outputDeviceId":"out-1","sampleRate":48000,"bufferSize":128,"inputGainDb":-3,"outputGainDb":-1.5,"blocks":[{"id":"nam-1","kind":"nam","path":"/models/od.nam","bypassed":false,"inputGainDb":0,"outputGainDb":-2,"mix":1}],"inputMeterDb":-12.5,"outputMeterDb":-18,"underruns":3,"lastError":""}`,
			check: func(t *testing.T, snapshot Snapshot) {
				if !snapshot.Running {
					t.Fatal("running = false, want true")
				}
				if snapshot.SampleRate != 48000 || snapshot.BufferSize != 128 {
					t.Fatalf("sample rate / buffer size = %d / %d", snapshot.SampleRate, snapshot.BufferSize)
				}
				if snapshot.Underruns != 3 {
					t.Fatalf("underruns = %d, want 3", snapshot.Underruns)
				}
				if len(snapshot.Blocks) != 1 {
					t.Fatalf("block count = %d, want 1", len(snapshot.Blocks))
				}
				if snapshot.Blocks[0].Kind != "nam" || snapshot.Blocks[0].OutputGainDB != -2 {
					t.Fatalf("block = %+v", snapshot.Blocks[0])
				}
			},
		},
		{
			name: "unknown block kind is preserved",
			data: `{"running":false,"blocks":[{"id":"fx-1","kind":"reverb","path":"/models/reverb"}]}`,
			check: func(t *testing.T, snapshot Snapshot) {
				if len(snapshot.Blocks) != 1 {
					t.Fatalf("block count = %d, want 1", len(snapshot.Blocks))
				}
				if snapshot.Blocks[0].Kind != "reverb" {
					t.Fatalf("block kind = %q, want %q", snapshot.Blocks[0].Kind, "reverb")
				}
			},
		},
		{
			name:    "malformed json",
			data:    `{"running":false,"blocks":[`,
			wantErr: true,
		},
		{
			name:    "non finite gain in payload",
			data:    `{"running":false,"inputGainDb":1e999}`,
			wantErr: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			snapshot, err := decodeSnapshot([]byte(test.data))
			if test.wantErr {
				if err == nil {
					t.Fatalf("decodeSnapshot() error = nil, want an error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if test.check != nil {
				test.check(t, snapshot)
			}
		})
	}
}

func TestValidateGainRejectsNonFiniteValues(t *testing.T) {
	for _, gain := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		if err := validateGain(gain); !errors.Is(err, ErrInvalidParameter) {
			t.Fatalf("validateGain(%v) error = %v, want ErrInvalidParameter", gain, err)
		}
	}
	if err := validateGain(-6.5); err != nil {
		t.Fatalf("validateGain(-6.5) error = %v, want nil", err)
	}
}

func TestValidateParam(t *testing.T) {
	tests := []struct {
		name    string
		param   string
		value   float64
		wantErr bool
	}{
		{name: "known parameter", param: "mix", value: 0.5},
		{name: "bypass enabled", param: "bypassed", value: 1},
		{name: "unknown parameter", param: "drive", value: 1, wantErr: true},
		{name: "non finite value", param: "inputGainDb", value: math.NaN(), wantErr: true},
		{name: "infinite value", param: "mix", value: math.Inf(1), wantErr: true},
		{name: "bypass is not a flag", param: "bypassed", value: 0.5, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateParam(test.param, test.value)
			if test.wantErr {
				if !errors.Is(err, ErrInvalidParameter) {
					t.Fatalf("validateParam(%q, %v) error = %v, want ErrInvalidParameter", test.param, test.value, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateParam(%q, %v) error = %v, want nil", test.param, test.value, err)
			}
		})
	}
}

func TestFillBufferGrowsToTheRequiredSize(t *testing.T) {
	const required = 32
	var capacities []uintptr
	data, err := fillBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		capacities = append(capacities, capacity)
		if capacity < required {
			*written = required
			return statusBufferTooSmall
		}
		copy(buf, "audio-engine")
		*written = uintptr(len("audio-engine") + 1)
		return statusOK
	}, 8)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "audio-engine" {
		t.Fatalf("data = %q, want %q", data, "audio-engine")
	}
	if len(capacities) != 2 {
		t.Fatalf("call count = %d, want 2", len(capacities))
	}
	if capacities[0] != 8 {
		t.Fatalf("first capacity = %d, want 8", capacities[0])
	}
	if capacities[1] != required {
		t.Fatalf("retry capacity = %d, want %d", capacities[1], required)
	}
}

func TestFillBufferReportsTheStatusCode(t *testing.T) {
	_, err := fillBuffer(func(buf []byte, capacity uintptr, written *uintptr) int {
		return statusDeviceOpenFailed
	}, 16)
	var status *statusError
	if !errors.As(err, &status) {
		t.Fatalf("error = %v, want a status error", err)
	}
	if status.code != statusDeviceOpenFailed {
		t.Fatalf("status code = %d, want %d", status.code, statusDeviceOpenFailed)
	}
}

func TestErrorUnwrapsToThePackageErrors(t *testing.T) {
	tests := []struct {
		code int
		want error
	}{
		{code: statusBlockNotFound, want: ErrBlockNotFound},
		{code: statusInvalidParameter, want: ErrInvalidParameter},
		{code: statusBusy, want: ErrBusy},
	}
	for _, test := range tests {
		err := &Error{Code: test.code, Message: "boom"}
		if !errors.Is(err, test.want) {
			t.Fatalf("errors.Is(%v, %v) = false, want true", err, test.want)
		}
	}

	other := &Error{Code: statusDeviceOpenFailed, Message: "boom"}
	if errors.Is(other, ErrBusy) {
		t.Fatalf("errors.Is(%v, ErrBusy) = true, want false", other)
	}
	if other.Error() != "audio engine error 5: boom" {
		t.Fatalf("Error() = %q", other.Error())
	}
}
