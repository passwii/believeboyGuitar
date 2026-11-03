package preset

import (
	"math"
	"reflect"
	"strings"
	"testing"
)

func TestPresetRoundTripKeepsPathsAndOrder(t *testing.T) {
	want := Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6, Blocks: []PresetBlock{
		{Kind: "nam", Path: "/models/drive.nam", InputGainDB: 3, Mix: 1},
		{Kind: "ir", Path: "/models/cab.wav", Bypassed: true, InputGainDB: -2, OutputGainDB: -3, Mix: 0.8},
	}}
	encoded := Encode(want)
	if !strings.Contains(string(encoded), "\n  \"schemaVersion\": 1") {
		t.Fatalf("Encode() is not indented schema-1 JSON:\n%s", encoded)
	}
	got, err := Decode(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("preset round-trip = %#v, want %#v", got, want)
	}
}

func TestEncodeNormalizesNilBlocksToEmptyArray(t *testing.T) {
	encoded := Encode(Preset{EngineRate: EngineSampleRate})
	if !strings.Contains(string(encoded), `"blocks": []`) {
		t.Fatalf("Encode() blocks field = %s, want empty array", encoded)
	}
	decoded, err := Decode(encoded)
	if err != nil {
		t.Fatalf("Decode(Encode(empty preset)) error = %v", err)
	}
	if decoded.Blocks == nil || len(decoded.Blocks) != 0 {
		t.Fatalf("decoded empty blocks = %#v, want non-nil empty slice", decoded.Blocks)
	}
}

func TestDecodeRejectsInvalidPresetJSON(t *testing.T) {
	valid := `{"schemaVersion":1,"engineSampleRate":48000,"inputGainDb":0,"outputGainDb":0,"blocks":[{"kind":"nam","path":"/models/amp.nam","bypassed":false,"inputGainDb":0,"outputGainDb":0,"mix":1}]}`
	tests := []struct {
		name string
		data string
		want string
	}{
		{name: "malformed", data: `{"schemaVersion":`, want: "decode preset"},
		{name: "unknown version", data: strings.Replace(valid, `"schemaVersion":1`, `"schemaVersion":2`, 1), want: "schema version"},
		{name: "missing schema version", data: strings.Replace(valid, `"schemaVersion":1,`, ``, 1), want: "schemaVersion is required"},
		{name: "missing sample rate", data: strings.Replace(valid, `"engineSampleRate":48000,`, ``, 1), want: "engineSampleRate is required"},
		{name: "unsupported sample rate", data: strings.Replace(valid, `"engineSampleRate":48000`, `"engineSampleRate":44100`, 1), want: "sample rate"},
		{name: "null top-level gain", data: strings.Replace(valid, `"inputGainDb":0`, `"inputGainDb":null`, 1), want: "inputGainDb is required"},
		{name: "missing top-level output gain", data: strings.Replace(valid, `,"outputGainDb":0,"blocks"`, `,"blocks"`, 1), want: "outputGainDb is required"},
		{name: "missing blocks", data: `{"schemaVersion":1,"engineSampleRate":48000,"inputGainDb":0,"outputGainDb":0}`, want: "blocks is required"},
		{name: "unknown kind", data: strings.Replace(valid, `"kind":"nam"`, `"kind":"delay"`, 1), want: "unsupported block kind"},
		{name: "missing block kind", data: strings.Replace(valid, `"kind":"nam",`, ``, 1), want: "kind is required"},
		{name: "empty path", data: strings.Replace(valid, `"/models/amp.nam"`, `"  "`, 1), want: "path is required"},
		{name: "missing block path", data: strings.Replace(valid, `,"path":"/models/amp.nam"`, ``, 1), want: "path is required"},
		{name: "remote URL path", data: strings.Replace(valid, `"/models/amp.nam"`, `"https://example.com/amp.nam"`, 1), want: "absolute local path"},
		{name: "relative path", data: strings.Replace(valid, `"/models/amp.nam"`, `"amp.nam"`, 1), want: "absolute local path"},
		{name: "null mix", data: strings.Replace(valid, `"mix":1`, `"mix":null`, 1), want: "mix is required"},
		{name: "missing mix", data: strings.Replace(valid, `,"mix":1`, ``, 1), want: "mix is required"},
		{name: "null bypass", data: strings.Replace(valid, `"bypassed":false`, `"bypassed":null`, 1), want: "bypassed is required"},
		{name: "missing input gain", data: strings.Replace(valid, `,"inputGainDb":0`, ``, 1), want: "inputGainDb is required"},
		{name: "missing block input gain", data: strings.Replace(valid, `,"inputGainDb":0,"outputGainDb":0,"mix"`, `,"outputGainDb":0,"mix"`, 1), want: "inputGainDb is required"},
		{name: "null output gain", data: strings.Replace(valid, `"outputGainDb":0`, `"outputGainDb":null`, 1), want: "outputGainDb is required"},
		{name: "missing block output gain", data: strings.Replace(valid, `,"outputGainDb":0,"mix":1`, `,"mix":1`, 1), want: "outputGainDb is required"},
		{name: "mix below range", data: strings.Replace(valid, `"mix":1`, `"mix":-0.01`, 1), want: "mix"},
		{name: "mix above range", data: strings.Replace(valid, `"mix":1`, `"mix":1.01`, 1), want: "mix"},
		{name: "non-finite gain", data: strings.Replace(valid, `"inputGainDb":0`, `"inputGainDb":NaN`, 1), want: "decode preset"},
		{name: "unknown field", data: strings.Replace(valid, `"blocks":`, `"futureField":true,"blocks":`, 1), want: "unknown field"},
		{name: "trailing data", data: valid + `{}`, want: "trailing data"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := Decode([]byte(tt.data)); err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("Decode() error = %v, want containing %q", err, tt.want)
			}
		})
	}
}

func TestValidateRejectsNonFiniteParameters(t *testing.T) {
	base := Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []PresetBlock{{Kind: "nam", Path: "/models/amp.nam", Mix: 1}}}
	tests := []struct {
		name   string
		change func(*Preset)
	}{
		{name: "input gain NaN", change: func(p *Preset) { p.InputGainDB = math.NaN() }},
		{name: "output gain Inf", change: func(p *Preset) { p.OutputGainDB = math.Inf(1) }},
		{name: "block input NaN", change: func(p *Preset) { p.Blocks[0].InputGainDB = math.NaN() }},
		{name: "block output Inf", change: func(p *Preset) { p.Blocks[0].OutputGainDB = math.Inf(-1) }},
		{name: "block mix NaN", change: func(p *Preset) { p.Blocks[0].Mix = math.NaN() }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := base
			got.Blocks = append([]PresetBlock(nil), base.Blocks...)
			tt.change(&got)
			if err := Validate(got); err == nil {
				t.Fatal("Validate() error = nil, want non-finite parameter error")
			}
			if encoded := Encode(got); len(encoded) != 0 {
				t.Fatalf("Encode() = %s, want empty output for invalid preset", encoded)
			}
		})
	}
}
