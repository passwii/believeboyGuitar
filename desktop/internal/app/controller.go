package app

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/damonrock/guitar-desktop/internal/preset"
)

type Controller struct {
	engine           engine.Engine
	opMu             sync.Mutex
	startMu          sync.Mutex
	startInFlight    bool
	lifecycleRunning bool
	mu               sync.RWMutex
	state            AppState
	update           func(func())
	paramMu          sync.Mutex
	paramCond        *sync.Cond
	paramRevision    map[parameterKey]uint64
	paramEpoch       uint64
	paramPending     map[parameterKey]parameterCommand
	paramWorker      bool
	presetLoading    bool
	operationError   string
	snapshotError    string
}

type parameterKey struct {
	blockID string
	name    string
}

type parameterCommand struct {
	key      parameterKey
	revision uint64
	epoch    uint64
	apply    func() error
	update   func(*AppState)
}

const parameterBusyRetries = 8
const parameterBusyRetryDelay = 2 * time.Millisecond

func NewController(e engine.Engine) *Controller {
	c := &Controller{
		engine: e,
		state: AppState{
			Status: "Stopped", InputChannel: -1, BufferSize: 128,
			InputGainDB: 0, OutputGainDB: 0, InputMeterDB: -120, OutputMeterDB: -120,
		},
		update:        func(fn func()) { fn() },
		paramRevision: make(map[parameterKey]uint64),
		paramPending:  make(map[parameterKey]parameterCommand),
	}
	c.paramCond = sync.NewCond(&c.paramMu)
	return c
}

func (c *Controller) SetUpdateOnMain(update func(func())) {
	if update == nil {
		return
	}
	c.mu.Lock()
	c.update = update
	c.mu.Unlock()
}

func (c *Controller) State() AppState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	state := c.state
	state.Devices = append([]engine.Device(nil), c.state.Devices...)
	state.Blocks = append([]BlockItem(nil), c.state.Blocks...)
	return state
}

func (c *Controller) change(fn func(*AppState)) {
	c.mu.Lock()
	fn(&c.state)
	update := c.update
	c.mu.Unlock()
	// Keep controller state authoritative before scheduling the UI redraw.
	update(func() {})
}

func (c *Controller) engineReady() error {
	if c.engine == nil {
		return fmt.Errorf("audio engine is unavailable")
	}
	return nil
}

func (c *Controller) RefreshDevices() {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return
	}
	c.opMu.Lock()
	devices, err := c.engine.Devices()
	c.opMu.Unlock()
	if err != nil {
		c.fail(err)
		return
	}
	c.change(func(state *AppState) {
		state.Devices = append([]engine.Device(nil), devices...)
		c.operationError = ""
		c.updateMessage(state)
	})
}

func (c *Controller) StartMonitoring(config engine.AudioConfig) error {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return err
	}
	c.startMu.Lock()
	if c.startInFlight || c.lifecycleRunning {
		c.startMu.Unlock()
		return nil
	}
	c.startInFlight = true
	c.startMu.Unlock()
	c.change(func(state *AppState) {
		state.Starting = true
		state.Status = "Starting"
	})
	c.opMu.Lock()
	err := c.engine.Start(config)
	if err != nil {
		c.change(func(state *AppState) {
			state.Starting = false
			state.Running = false
			state.Status = "Stopped"
			c.operationError = err.Error()
			c.updateMessage(state)
			c.startMu.Lock()
			c.startInFlight = false
			c.lifecycleRunning = false
			c.startMu.Unlock()
		})
		c.opMu.Unlock()
		return err
	}
	c.change(func(state *AppState) {
		state.Starting = false
		state.Running = true
		state.Status = "Running"
		c.operationError = ""
		c.updateMessage(state)
		state.SelectedInputID = config.InputDeviceID
		state.SelectedOutputID = config.OutputDeviceID
		state.InputChannel = config.InputChannel
		state.BufferSize = config.BufferSize
		c.startMu.Lock()
		c.startInFlight = false
		c.lifecycleRunning = true
		c.startMu.Unlock()
	})
	c.opMu.Unlock()
	return nil
}

func (c *Controller) StopMonitoring() {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return
	}
	c.opMu.Lock()
	err := c.engine.Stop()
	if err != nil {
		c.opMu.Unlock()
		c.fail(err)
		return
	}
	c.change(func(state *AppState) {
		state.Running = false
		state.Status = "Stopped"
		c.operationError = ""
		c.updateMessage(state)
		c.startMu.Lock()
		c.lifecycleRunning = false
		c.startMu.Unlock()
	})
	c.opMu.Unlock()
}

func (c *Controller) SetInputGain(value float64) {
	c.SubmitInputGain(value)
}

func (c *Controller) SetMasterGain(value float64) {
	c.SubmitMasterGain(value)
}

func (c *Controller) SubmitInputGain(value float64) {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return
	}
	c.submitParameter(parameterKey{name: "inputGain"}, func() error {
		return c.engine.SetInputGain(value)
	}, func(state *AppState) {
		state.InputGainDB = value
	})
}

func (c *Controller) SubmitMasterGain(value float64) {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return
	}
	c.submitParameter(parameterKey{name: "masterGain"}, func() error {
		return c.engine.SetMasterGain(value)
	}, func(state *AppState) {
		state.OutputGainDB = value
	})
}

func (c *Controller) AddFile(path string) error {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return err
	}
	c.opMu.Lock()
	block, err := c.engine.AddFile(path)
	if err != nil {
		c.opMu.Unlock()
		c.fail(err)
		return err
	}
	c.change(func(state *AppState) {
		state.Blocks = append(state.Blocks, BlockItem{Block: block})
		c.operationError = ""
		c.updateMessage(state)
	})
	c.opMu.Unlock()
	return nil
}

func (c *Controller) RemoveBlock(id string) error {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return err
	}
	c.opMu.Lock()
	state := c.State()
	found := false
	missing := false
	orphaned := false
	for _, item := range state.Blocks {
		if item.Block.ID == id {
			found = true
			missing = item.Missing
			orphaned = item.Orphaned
			break
		}
	}
	if !found {
		c.opMu.Unlock()
		c.fail(engine.ErrBlockNotFound)
		return engine.ErrBlockNotFound
	}
	if missing {
		c.change(func(state *AppState) {
			for i, item := range state.Blocks {
				if item.Block.ID == id {
					state.Blocks = append(state.Blocks[:i], state.Blocks[i+1:]...)
					break
				}
			}
			c.operationError = ""
			c.updateMessage(state)
		})
		c.opMu.Unlock()
		return nil
	}
	err := c.engine.RemoveBlock(id)
	if err != nil {
		if orphaned && errors.Is(err, engine.ErrBlockNotFound) {
			c.change(func(state *AppState) {
				for i, item := range state.Blocks {
					if item.Block.ID == id {
						state.Blocks = append(state.Blocks[:i], state.Blocks[i+1:]...)
						break
					}
				}
				c.operationError = ""
				c.updateMessage(state)
			})
			c.opMu.Unlock()
			return nil
		}
		c.opMu.Unlock()
		c.fail(err)
		return err
	}
	c.change(func(state *AppState) {
		for i, item := range state.Blocks {
			if item.Block.ID == id {
				state.Blocks = append(state.Blocks[:i], state.Blocks[i+1:]...)
				break
			}
		}
		c.operationError = ""
		c.updateMessage(state)
	})
	c.opMu.Unlock()
	return nil
}

func (c *Controller) CurrentPreset() (preset.Preset, error) {
	for {
		c.paramMu.Lock()
		if c.presetLoading {
			c.paramMu.Unlock()
			return preset.Preset{}, errors.New("a preset is still loading")
		}
		for c.paramWorker || len(c.paramPending) > 0 {
			c.paramCond.Wait()
			if c.presetLoading {
				c.paramMu.Unlock()
				return preset.Preset{}, errors.New("a preset is still loading")
			}
		}
		c.paramMu.Unlock()

		c.opMu.Lock()
		c.paramMu.Lock()
		if c.presetLoading {
			c.paramMu.Unlock()
			c.opMu.Unlock()
			return preset.Preset{}, errors.New("a preset is still loading")
		}
		if c.paramWorker || len(c.paramPending) > 0 {
			c.paramMu.Unlock()
			c.opMu.Unlock()
			continue
		}
		c.paramMu.Unlock()

		state := c.State()
		saved := preset.Preset{
			SchemaVersion: preset.SchemaVersion,
			EngineRate:    preset.EngineSampleRate,
			InputGainDB:   state.InputGainDB,
			OutputGainDB:  state.OutputGainDB,
			Blocks:        make([]preset.PresetBlock, 0, len(state.Blocks)),
		}
		for _, item := range state.Blocks {
			block := item.Block
			saved.Blocks = append(saved.Blocks, preset.PresetBlock{
				Kind: block.Kind, Path: block.Path, Bypassed: block.Bypassed,
				InputGainDB: block.InputGainDB, OutputGainDB: block.OutputGainDB, Mix: block.Mix,
			})
		}
		if err := preset.Validate(saved); err != nil {
			c.opMu.Unlock()
			return preset.Preset{}, err
		}
		c.opMu.Unlock()
		return saved, nil
	}
}

func (c *Controller) ReorderBlocks(ids []string) {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return
	}
	c.opMu.Lock()
	err := c.engine.Reorder(ids)
	if err != nil {
		c.opMu.Unlock()
		c.fail(err)
		return
	}
	c.change(func(state *AppState) {
		byID := make(map[string]BlockItem, len(state.Blocks))
		for _, item := range state.Blocks {
			byID[item.Block.ID] = item
		}
		ordered := make([]BlockItem, 0, len(ids))
		for _, id := range ids {
			if item, ok := byID[id]; ok {
				ordered = append(ordered, item)
			}
		}
		state.Blocks = ordered
		c.operationError = ""
		c.updateMessage(state)
	})
	c.opMu.Unlock()
}

func (c *Controller) SetBlockParam(id, name string, value float64) {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return
	}
	c.submitParameter(parameterKey{blockID: id, name: name}, func() error {
		return c.engine.SetParam(id, name, value)
	}, func(state *AppState) {
		for i := range state.Blocks {
			block := &state.Blocks[i].Block
			if block.ID != id {
				continue
			}
			switch name {
			case "bypassed":
				block.Bypassed = value != 0
			case "inputGainDb":
				block.InputGainDB = value
			case "outputGainDb":
				block.OutputGainDB = value
			case "mix":
				block.Mix = value
			}
		}
	})
}

func (c *Controller) submitParameter(key parameterKey, apply func() error, update func(*AppState)) {
	c.paramMu.Lock()
	if c.presetLoading {
		c.paramMu.Unlock()
		return
	}
	c.paramRevision[key]++
	command := parameterCommand{key: key, revision: c.paramRevision[key], epoch: c.paramEpoch, apply: apply, update: update}
	c.paramPending[key] = command
	if !c.paramWorker {
		c.paramWorker = true
		go c.runParameterQueue()
	}
	c.paramMu.Unlock()
}

func (c *Controller) runParameterQueue() {
	for {
		c.paramMu.Lock()
		var command parameterCommand
		found := false
		for key, pending := range c.paramPending {
			command = pending
			delete(c.paramPending, key)
			found = true
			break
		}
		if !found {
			c.paramWorker = false
			c.paramCond.Broadcast()
			c.paramMu.Unlock()
			return
		}
		c.paramMu.Unlock()

		for attempt := 0; ; attempt++ {
			c.opMu.Lock()
			if !c.isCurrentParameter(command) {
				c.opMu.Unlock()
				break
			}
			err := command.apply()
			if errors.Is(err, engine.ErrBusy) && attempt < parameterBusyRetries && c.isCurrentParameter(command) {
				c.opMu.Unlock()
				time.Sleep(parameterBusyRetryDelay)
				continue
			}

			c.change(func(state *AppState) {
				if !c.isCurrentParameter(command) {
					return
				}
				if err != nil {
					c.operationError = err.Error()
					c.updateMessage(state)
					return
				}
				command.update(state)
				c.operationError = ""
				c.updateMessage(state)
			})
			c.opMu.Unlock()
			break
		}
		c.paramMu.Lock()
		c.paramCond.Broadcast()
		c.paramMu.Unlock()
	}
}

func (c *Controller) isCurrentParameter(command parameterCommand) bool {
	c.paramMu.Lock()
	defer c.paramMu.Unlock()
	return c.paramEpoch == command.epoch && c.paramRevision[command.key] == command.revision
}

func (c *Controller) beginPresetLoad() bool {
	c.paramMu.Lock()
	if c.presetLoading {
		c.paramMu.Unlock()
		return false
	}
	c.presetLoading = true
	c.paramEpoch++
	for key := range c.paramPending {
		c.paramRevision[key]++
	}
	c.paramMu.Unlock()
	c.change(func(state *AppState) { state.PresetLoading = true })
	return true
}

func (c *Controller) finishPresetLoad() {
	c.mu.RLock()
	update := c.update
	c.mu.RUnlock()
	update(func() {
		c.mu.Lock()
		c.state.PresetLoading = false
		c.paramMu.Lock()
		c.presetLoading = false
		c.paramEpoch++
		for key := range c.paramPending {
			c.paramRevision[key]++
		}
		c.paramMu.Unlock()
		c.mu.Unlock()
	})
}

// LoadPreset replaces the chain with the saved order. Missing files remain as
// unresolved slots so they can be relinked without losing their position.
func (c *Controller) LoadPreset(p preset.Preset) error {
	if err := preset.Validate(p); err != nil {
		c.fail(err)
		return err
	}
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return err
	}
	if !c.beginPresetLoad() {
		err := errors.New("another preset is still loading")
		c.fail(err)
		return err
	}
	defer c.finishPresetLoad()

	var loadErrors []error
	items := make([]BlockItem, len(p.Blocks))
	orphanedByIndex := make(map[int]BlockItem)

	c.opMu.Lock()
	state := c.State()
	removedIDs := make(map[string]bool, len(state.Blocks))
	for _, item := range state.Blocks {
		if item.Missing {
			continue
		}
		if err := c.engine.RemoveBlock(item.Block.ID); err != nil {
			if errors.Is(err, engine.ErrBlockNotFound) {
				removedIDs[item.Block.ID] = true
				continue
			}
			loadErr := fmt.Errorf("remove existing block %s before loading preset: %w", item.Block.ID, err)
			visible := append([]BlockItem(nil), state.Blocks...)
			for i, old := range state.Blocks {
				if removedIDs[old.Block.ID] || (old.Block.ID == item.Block.ID && errors.Is(err, engine.ErrBlockNotFound)) {
					visible[i].Missing = true
					visible[i].Message = fmt.Sprintf("Could not retain this block while loading the preset: %v. Relink it to restore the slot.", loadErr)
				}
			}
			c.change(func(state *AppState) {
				state.Blocks = visible
				c.operationError = loadErr.Error()
				c.updateMessage(state)
			})
			c.opMu.Unlock()
			return loadErr
		}
		removedIDs[item.Block.ID] = true
	}

	for i, spec := range p.Blocks {
		if message := presetFileProblem(spec.Path); message != "" {
			items[i] = unresolvedPresetBlock(i, spec, message)
			continue
		}
		block, err := c.engine.AddFile(spec.Path)
		if err != nil {
			items[i] = unresolvedPresetBlock(i, spec, fmt.Sprintf("Could not load %s: %v. Relink this block.", spec.Path, err))
			loadErrors = append(loadErrors, fmt.Errorf("load preset block %d: %w", i, err))
			continue
		}
		if block.Kind != spec.Kind {
			removeErr := c.engine.RemoveBlock(block.ID)
			reason := fmt.Sprintf("File %s is a %s block, but this slot needs %s. Relink with a %s file.", spec.Path, block.Kind, spec.Kind, spec.Kind)
			items[i] = unresolvedPresetBlock(i, spec, reason)
			err := fmt.Errorf("load preset block %d: expected kind %s, got %s", i, spec.Kind, block.Kind)
			if removeErr != nil {
				err = errors.Join(err, fmt.Errorf("remove mismatched block: %w", removeErr))
				if !errors.Is(removeErr, engine.ErrBlockNotFound) {
					orphanedByIndex[i] = BlockItem{
						Block: block, Orphaned: true,
						Message: fmt.Sprintf("This engine block could not be removed after a preset kind mismatch: %v. Remove it before loading another preset.", removeErr),
					}
				}
			}
			loadErrors = append(loadErrors, err)
			continue
		}
		if err := c.applyPresetBlockParameters(block.ID, spec); err != nil {
			removeErr := c.engine.RemoveBlock(block.ID)
			items[i] = unresolvedPresetBlock(i, spec, fmt.Sprintf("Could not restore parameters for %s: %v. Relink this block.", spec.Path, err))
			loadErr := fmt.Errorf("restore preset block %d parameters: %w", i, err)
			if removeErr != nil {
				loadErr = errors.Join(loadErr, fmt.Errorf("remove block with invalid parameters: %w", removeErr))
				if !errors.Is(removeErr, engine.ErrBlockNotFound) {
					orphanedByIndex[i] = BlockItem{
						Block: block, Orphaned: true,
						Message: fmt.Sprintf("Preset parameters could not be restored and this engine block could not be removed: %v. Remove it before loading another preset.", removeErr),
					}
				}
			}
			loadErrors = append(loadErrors, loadErr)
			continue
		}
		block.Bypassed = spec.Bypassed
		block.InputGainDB = spec.InputGainDB
		block.OutputGainDB = spec.OutputGainDB
		block.Mix = spec.Mix
		items[i] = BlockItem{Block: block}
	}

	inputGainErr := c.engine.SetInputGain(p.InputGainDB)
	if inputGainErr != nil {
		loadErrors = append(loadErrors, fmt.Errorf("restore input gain: %w", inputGainErr))
	}
	masterGainErr := c.engine.SetMasterGain(p.OutputGainDB)
	if masterGainErr != nil {
		loadErrors = append(loadErrors, fmt.Errorf("restore output gain: %w", masterGainErr))
	}
	loadErr := errors.Join(loadErrors...)
	visibleItems := make([]BlockItem, 0, len(items)+len(orphanedByIndex))
	for i, item := range items {
		visibleItems = append(visibleItems, item)
		if orphan, ok := orphanedByIndex[i]; ok {
			visibleItems = append(visibleItems, orphan)
		}
	}
	c.change(func(state *AppState) {
		state.Blocks = visibleItems
		if inputGainErr == nil {
			state.InputGainDB = p.InputGainDB
		}
		if masterGainErr == nil {
			state.OutputGainDB = p.OutputGainDB
		}
		c.operationError = ""
		if loadErr != nil {
			c.operationError = loadErr.Error()
		}
		c.updateMessage(state)
	})
	c.opMu.Unlock()
	return loadErr
}

// RelinkBlock replaces one unresolved preset slot without changing its
// position, then restores the engine order to the visible chain order.
func (c *Controller) RelinkBlock(placeholderID, path string) error {
	if err := c.engineReady(); err != nil {
		c.fail(err)
		return err
	}
	if strings.TrimSpace(path) == "" {
		err := errors.New("replacement path is required")
		c.fail(err)
		return err
	}
	if message := presetFileProblem(path); message != "" {
		err := errors.New(message)
		c.fail(err)
		return err
	}

	c.opMu.Lock()
	state := c.State()
	slot := -1
	for i, item := range state.Blocks {
		if item.Block.ID == placeholderID && item.Missing {
			slot = i
			break
		}
	}
	if slot < 0 {
		c.opMu.Unlock()
		err := fmt.Errorf("unresolved preset block %q not found", placeholderID)
		c.fail(err)
		return err
	}
	expected := state.Blocks[slot].Block

	block, err := c.engine.AddFile(path)
	if err != nil {
		c.opMu.Unlock()
		c.fail(err)
		return err
	}
	if block.Kind != expected.Kind {
		removeErr := c.engine.RemoveBlock(block.ID)
		err := fmt.Errorf("replacement kind %s does not match block kind %s", block.Kind, expected.Kind)
		if removeErr != nil {
			err = errors.Join(err, fmt.Errorf("remove mismatched replacement: %w", removeErr))
			if !errors.Is(removeErr, engine.ErrBlockNotFound) {
				orphaned := BlockItem{
					Block: block, Orphaned: true,
					Message: fmt.Sprintf("This engine block could not be removed after a relink kind mismatch: %v. Remove it before relinking again.", removeErr),
				}
				c.change(func(state *AppState) {
					state.Blocks = append(state.Blocks, orphaned)
				})
			}
		}
		c.opMu.Unlock()
		c.fail(err)
		return err
	}
	spec := preset.PresetBlock{
		Kind: expected.Kind, Path: path, Bypassed: expected.Bypassed,
		InputGainDB: expected.InputGainDB, OutputGainDB: expected.OutputGainDB, Mix: expected.Mix,
	}
	if err := c.applyPresetBlockParameters(block.ID, spec); err != nil {
		removeErr := c.engine.RemoveBlock(block.ID)
		if removeErr != nil {
			err = errors.Join(err, fmt.Errorf("remove replacement: %w", removeErr))
			if !errors.Is(removeErr, engine.ErrBlockNotFound) {
				orphaned := BlockItem{
					Block: block, Orphaned: true,
					Message: fmt.Sprintf("Preset parameters could not be restored and this engine block could not be removed: %v. Remove it before relinking again.", removeErr),
				}
				c.change(func(state *AppState) {
					state.Blocks = append(state.Blocks, orphaned)
				})
			}
		}
		c.opMu.Unlock()
		c.fail(err)
		return err
	}
	block.Bypassed = spec.Bypassed
	block.InputGainDB = spec.InputGainDB
	block.OutputGainDB = spec.OutputGainDB
	block.Mix = spec.Mix

	ids := make([]string, 0, len(state.Blocks))
	for i, item := range state.Blocks {
		switch {
		case i == slot:
			ids = append(ids, block.ID)
		case item.Missing:
			continue
		default:
			ids = append(ids, item.Block.ID)
		}
	}
	if err := c.engine.Reorder(ids); err != nil {
		removeErr := c.engine.RemoveBlock(block.ID)
		if removeErr != nil {
			err = errors.Join(err, fmt.Errorf("remove replacement: %w", removeErr))
			if !errors.Is(removeErr, engine.ErrBlockNotFound) {
				orphaned := BlockItem{
					Block: block, Orphaned: true,
					Message: fmt.Sprintf("This engine block could not be removed after a relink ordering failure: %v. Remove it before relinking again.", removeErr),
				}
				c.change(func(state *AppState) {
					state.Blocks = append(state.Blocks, orphaned)
				})
			}
		}
		c.opMu.Unlock()
		c.fail(err)
		return err
	}
	c.change(func(state *AppState) {
		state.Blocks[slot] = BlockItem{Block: block}
		c.operationError = ""
		c.updateMessage(state)
	})
	c.opMu.Unlock()
	return nil
}

func (c *Controller) applyPresetBlockParameters(id string, spec preset.PresetBlock) error {
	bypassed := 0.0
	if spec.Bypassed {
		bypassed = 1
	}
	parameters := []struct {
		name  string
		value float64
	}{
		{name: "bypassed", value: bypassed},
		{name: "inputGainDb", value: spec.InputGainDB},
		{name: "outputGainDb", value: spec.OutputGainDB},
		{name: "mix", value: spec.Mix},
	}
	for _, parameter := range parameters {
		if err := c.setParamWithBusyRetry(id, parameter.name, parameter.value); err != nil {
			return fmt.Errorf("set %s: %w", parameter.name, err)
		}
	}
	return nil
}

func (c *Controller) setParamWithBusyRetry(id, name string, value float64) error {
	for attempt := 0; ; attempt++ {
		err := c.engine.SetParam(id, name, value)
		if !errors.Is(err, engine.ErrBusy) || attempt >= parameterBusyRetries {
			return err
		}
		time.Sleep(parameterBusyRetryDelay)
	}
}

func unresolvedPresetBlock(index int, spec preset.PresetBlock, message string) BlockItem {
	return BlockItem{
		Block: engine.Block{
			ID: fmt.Sprintf("missing:%d", index), Kind: spec.Kind, Path: spec.Path,
			Bypassed: spec.Bypassed, InputGainDB: spec.InputGainDB,
			OutputGainDB: spec.OutputGainDB, Mix: spec.Mix,
		},
		Missing: true,
		Message: message,
	}
}

func presetFileProblem(path string) string {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return fmt.Sprintf("File not found: %s. Relink it to restore this block.", path)
	}
	if err != nil {
		return fmt.Sprintf("Could not access %s: %v. Relink it to restore this block.", path, err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Sprintf("Not a regular file: %s. Choose a model or WAV file to relink this block.", path)
	}
	return ""
}

func (c *Controller) RefreshSnapshot() {
	if err := c.engineReady(); err != nil {
		return
	}
	c.opMu.Lock()
	snapshot, err := c.engine.Snapshot()
	if err != nil {
		c.change(func(state *AppState) {
			c.snapshotError = err.Error()
			c.updateMessage(state)
		})
		c.opMu.Unlock()
		return
	}
	c.change(func(state *AppState) {
		state.InputMeterDB = snapshot.InputMeterDB
		state.OutputMeterDB = snapshot.OutputMeterDB
		c.startMu.Lock()
		starting := c.startInFlight
		if !starting {
			c.lifecycleRunning = snapshot.Running
		}
		c.startMu.Unlock()
		if !starting {
			state.Running = snapshot.Running
			if snapshot.Running {
				state.Status = "Running"
				if snapshot.InputDeviceID != "" {
					state.SelectedInputID = snapshot.InputDeviceID
				}
				if snapshot.OutputDeviceID != "" {
					state.SelectedOutputID = snapshot.OutputDeviceID
				}
				if snapshot.BufferSize != 0 {
					state.BufferSize = snapshot.BufferSize
				}
			} else {
				state.Status = "Stopped"
			}
		}
		c.snapshotError = snapshot.LastError
		c.updateMessage(state)
	})
	c.opMu.Unlock()
}

func (c *Controller) SelectInput(id string) {
	c.change(func(state *AppState) { state.SelectedInputID = id; state.InputChannel = -1 })
}

func (c *Controller) SelectOutput(id string) {
	c.change(func(state *AppState) { state.SelectedOutputID = id })
}

func (c *Controller) SelectInputChannel(channel int) {
	c.change(func(state *AppState) { state.InputChannel = channel })
}

func (c *Controller) SelectBufferSize(size int) {
	c.change(func(state *AppState) { state.BufferSize = size })
}

func (c *Controller) fail(err error) {
	if err == nil {
		return
	}
	c.change(func(state *AppState) {
		c.operationError = err.Error()
		c.updateMessage(state)
	})
}

func (c *Controller) clearOperationError() {
	c.change(func(state *AppState) {
		c.operationError = ""
		c.updateMessage(state)
	})
}

func (c *Controller) updateMessage(state *AppState) {
	state.Message = c.operationError
	if state.Message == "" {
		state.Message = c.snapshotError
	}
}

func blockKindName(block engine.Block) string {
	if block.Kind == "nam" {
		return "NAM"
	}
	if block.Kind == "ir" {
		return "IR"
	}
	return strings.ToUpper(filepath.Ext(block.Path))
}
