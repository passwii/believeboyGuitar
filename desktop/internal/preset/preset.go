package preset

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"path/filepath"
	"strings"
)

const SchemaVersion = 1
const EngineSampleRate = 48000

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

type presetDocument struct {
	SchemaVersion *int                   `json:"schemaVersion"`
	EngineRate    *int                   `json:"engineSampleRate"`
	InputGainDB   *float64               `json:"inputGainDb"`
	OutputGainDB  *float64               `json:"outputGainDb"`
	Blocks        *[]presetBlockDocument `json:"blocks"`
}

type presetBlockDocument struct {
	Kind         *string  `json:"kind"`
	Path         *string  `json:"path"`
	Bypassed     *bool    `json:"bypassed"`
	InputGainDB  *float64 `json:"inputGainDb"`
	OutputGainDB *float64 `json:"outputGainDb"`
	Mix          *float64 `json:"mix"`
}

// Encode serializes a validated schema-1 preset as indented JSON. Invalid
// presets return nil so non-finite values can never reach a preset file.
func Encode(p Preset) []byte {
	p.SchemaVersion = SchemaVersion
	if p.Blocks == nil {
		p.Blocks = []PresetBlock{}
	}
	if err := Validate(p); err != nil {
		return nil
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return nil
	}
	return append(data, '\n')
}

// Decode strictly parses and validates a schema-1 preset.
func Decode(data []byte) (Preset, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var document presetDocument
	if err := decoder.Decode(&document); err != nil {
		return Preset{}, fmt.Errorf("decode preset: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return Preset{}, errors.New("decode preset: trailing data")
		}
		return Preset{}, fmt.Errorf("decode preset: trailing data: %w", err)
	}
	if document.SchemaVersion == nil {
		return Preset{}, errors.New("decode preset: schemaVersion is required")
	}
	if document.EngineRate == nil {
		return Preset{}, errors.New("decode preset: engineSampleRate is required")
	}
	if document.InputGainDB == nil {
		return Preset{}, errors.New("decode preset: inputGainDb is required")
	}
	if document.OutputGainDB == nil {
		return Preset{}, errors.New("decode preset: outputGainDb is required")
	}
	if document.Blocks == nil {
		return Preset{}, errors.New("decode preset: blocks is required")
	}
	p := Preset{
		SchemaVersion: *document.SchemaVersion,
		EngineRate:    *document.EngineRate,
		InputGainDB:   *document.InputGainDB,
		OutputGainDB:  *document.OutputGainDB,
		Blocks:        make([]PresetBlock, len(*document.Blocks)),
	}
	for i, block := range *document.Blocks {
		prefix := fmt.Sprintf("decode preset: block %d ", i)
		if block.Kind == nil {
			return Preset{}, errors.New(prefix + "kind is required")
		}
		if block.Path == nil {
			return Preset{}, errors.New(prefix + "path is required")
		}
		if block.Bypassed == nil {
			return Preset{}, errors.New(prefix + "bypassed is required")
		}
		if block.InputGainDB == nil {
			return Preset{}, errors.New(prefix + "inputGainDb is required")
		}
		if block.OutputGainDB == nil {
			return Preset{}, errors.New(prefix + "outputGainDb is required")
		}
		if block.Mix == nil {
			return Preset{}, errors.New(prefix + "mix is required")
		}
		p.Blocks[i] = PresetBlock{
			Kind: *block.Kind, Path: *block.Path, Bypassed: *block.Bypassed,
			InputGainDB: *block.InputGainDB, OutputGainDB: *block.OutputGainDB, Mix: *block.Mix,
		}
	}
	if err := Validate(p); err != nil {
		return Preset{}, err
	}
	return p, nil
}

func Validate(p Preset) error {
	if p.SchemaVersion != SchemaVersion {
		return fmt.Errorf("unsupported preset schema version %d", p.SchemaVersion)
	}
	if p.EngineRate != EngineSampleRate {
		return fmt.Errorf("unsupported engine sample rate %d", p.EngineRate)
	}
	if err := validateFinite("input gain", p.InputGainDB); err != nil {
		return err
	}
	if err := validateFinite("output gain", p.OutputGainDB); err != nil {
		return err
	}
	for i, block := range p.Blocks {
		switch block.Kind {
		case "nam", "ir":
		default:
			return fmt.Errorf("block %d: unsupported block kind %q", i, block.Kind)
		}
		if strings.TrimSpace(block.Path) == "" {
			return fmt.Errorf("block %d: path is required", i)
		}
		if !filepath.IsAbs(block.Path) {
			return fmt.Errorf("block %d: path must be an absolute local path", i)
		}
		if err := validateFinite(fmt.Sprintf("block %d input gain", i), block.InputGainDB); err != nil {
			return err
		}
		if err := validateFinite(fmt.Sprintf("block %d output gain", i), block.OutputGainDB); err != nil {
			return err
		}
		if err := validateFinite(fmt.Sprintf("block %d mix", i), block.Mix); err != nil {
			return err
		}
		if block.Mix < 0 || block.Mix > 1 {
			return fmt.Errorf("block %d mix %v is outside [0,1]", i, block.Mix)
		}
	}
	return nil
}

func validateFinite(name string, value float64) error {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return fmt.Errorf("%s must be a finite number", name)
	}
	return nil
}
