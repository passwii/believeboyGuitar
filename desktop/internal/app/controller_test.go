package app

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/damonrock/guitar-desktop/internal/preset"
)

type fakeEngine struct {
	startErr         error
	running          bool
	inputGainDB      float64
	outputGainDB     float64
	devices          []engine.Device
	blocks           []engine.Block
	operations       []string
	calls            chan string
	inputGainEntered chan float64
	inputGainRelease chan struct{}
	inputGainApplied chan float64
	startEntered     chan struct{}
	startRelease     chan struct{}
	lastError        string
	snapshotErr      error
	snapshotInputID  string
	snapshotOutputID string
	snapshotBuffer   int
	removeErr        error
	removeErrByID    map[string]error
	inputGainErr     error
	masterGainErr    error
	setParamErr      error
	reorderErr       error
	paramEntered     chan float64
	paramRelease     chan struct{}
	paramBusyReplies int
}

func (f *fakeEngine) record(operation string) {
	f.operations = append(f.operations, operation)
	if f.calls != nil {
		f.calls <- operation
	}
}

func (f *fakeEngine) Devices() ([]engine.Device, error) { return f.devices, nil }
func (f *fakeEngine) Start(config engine.AudioConfig) error {
	f.record("start:" + config.InputDeviceID + ":" + config.OutputDeviceID)
	if f.startEntered != nil {
		f.startEntered <- struct{}{}
	}
	if f.startRelease != nil {
		<-f.startRelease
	}
	if f.startErr == nil {
		f.running = true
	}
	return f.startErr
}
func (f *fakeEngine) Stop() error {
	f.record("stop")
	f.running = false
	return nil
}
func (f *fakeEngine) SetInputGain(value float64) error {
	f.record("input-gain")
	if f.inputGainEntered != nil {
		f.inputGainEntered <- value
		<-f.inputGainRelease
	}
	if f.inputGainErr != nil {
		return f.inputGainErr
	}
	f.inputGainDB = value
	if f.inputGainApplied != nil {
		f.inputGainApplied <- value
	}
	return nil
}
func (f *fakeEngine) SetMasterGain(value float64) error {
	f.record("master-gain")
	if f.masterGainErr != nil {
		return f.masterGainErr
	}
	f.outputGainDB = value
	return nil
}
func (f *fakeEngine) AddFile(path string) (engine.Block, error) {
	f.record("add:" + path)
	kind := "ir"
	if strings.EqualFold(filepath.Ext(path), ".nam") {
		kind = "nam"
	}
	block := engine.Block{ID: path, Kind: kind, Path: path, Mix: 1}
	f.blocks = append(f.blocks, block)
	return block, nil
}
func (f *fakeEngine) RemoveBlock(id string) error {
	f.record("remove:" + id)
	if err := f.removeErrByID[id]; err != nil {
		return err
	}
	if f.removeErr != nil {
		return f.removeErr
	}
	for i := range f.blocks {
		if f.blocks[i].ID == id {
			f.blocks = append(f.blocks[:i], f.blocks[i+1:]...)
			return nil
		}
	}
	return engine.ErrBlockNotFound
}
func (f *fakeEngine) Reorder(ids []string) error {
	f.record("reorder")
	if f.reorderErr != nil {
		return f.reorderErr
	}
	if len(ids) != len(f.blocks) {
		return engine.ErrInvalidParameter
	}
	byID := make(map[string]engine.Block, len(f.blocks))
	for _, block := range f.blocks {
		byID[block.ID] = block
	}
	ordered := make([]engine.Block, 0, len(ids))
	for _, id := range ids {
		block, ok := byID[id]
		if !ok {
			return engine.ErrBlockNotFound
		}
		ordered = append(ordered, block)
	}
	f.blocks = ordered
	return nil
}
func (f *fakeEngine) SetParam(id, name string, value float64) error {
	f.record("param:" + id + ":" + name)
	if f.paramEntered != nil {
		f.paramEntered <- value
		<-f.paramRelease
	}
	if f.paramBusyReplies > 0 {
		f.paramBusyReplies--
		return engine.ErrBusy
	}
	if f.setParamErr != nil {
		return f.setParamErr
	}
	for i := range f.blocks {
		if f.blocks[i].ID == id {
			switch name {
			case "bypassed":
				f.blocks[i].Bypassed = value != 0
			case "inputGainDb":
				f.blocks[i].InputGainDB = value
			case "outputGainDb":
				f.blocks[i].OutputGainDB = value
			case "mix":
				f.blocks[i].Mix = value
			default:
				return engine.ErrInvalidParameter
			}
			return nil
		}
	}
	return engine.ErrBlockNotFound
}
func (f *fakeEngine) Snapshot() (engine.Snapshot, error) {
	if f.snapshotErr != nil {
		return engine.Snapshot{}, f.snapshotErr
	}
	return engine.Snapshot{
		Running: f.running, InputGainDB: f.inputGainDB, OutputGainDB: f.outputGainDB,
		Blocks: append([]engine.Block(nil), f.blocks...), LastError: f.lastError,
		InputDeviceID: f.snapshotInputID, OutputDeviceID: f.snapshotOutputID, BufferSize: f.snapshotBuffer,
	}, nil
}
func (f *fakeEngine) Close() error { return nil }

func TestControllerStartsStopped(t *testing.T) {
	controller := NewController(&fakeEngine{})
	state := controller.State()
	if state.Running || state.Status != "Stopped" {
		t.Fatalf("initial state = %+v, want stopped", state)
	}
}

func TestControllerStateChangesBeforeQueuedRedraw(t *testing.T) {
	controller := NewController(&fakeEngine{})
	updates := make(chan func(), 1)
	controller.SetUpdateOnMain(func(fn func()) { updates <- fn })

	controller.SelectInput("input-1")
	if got := controller.State().SelectedInputID; got != "input-1" {
		t.Fatalf("controller state before redraw = %q, want input-1", got)
	}
	select {
	case update := <-updates:
		update()
	default:
		t.Fatal("state change did not schedule a UI redraw")
	}
}

func TestStartMonitoringUpdatesStateOnlyAfterEngineSucceeds(t *testing.T) {
	fake := &fakeEngine{}
	controller := NewController(fake)
	config := engine.AudioConfig{InputDeviceID: "in", InputChannel: 0, OutputDeviceID: "out", BufferSize: 128}
	if err := controller.StartMonitoring(config); err != nil {
		t.Fatal(err)
	}
	if state := controller.State(); !state.Running || state.Status != "Running" {
		t.Fatalf("state after successful start = %+v", state)
	}
}

func TestStartFailureKeepsMonitoringStopped(t *testing.T) {
	fake := &fakeEngine{startErr: errors.New("no input device")}
	controller := NewController(fake)
	if err := controller.StartMonitoring(engine.AudioConfig{InputChannel: 0, BufferSize: 128}); err == nil {
		t.Fatal("StartMonitoring() error = nil, want no-device error")
	}
	state := controller.State()
	if state.Running || state.Starting || state.Status != "Stopped" || state.Message != "no input device" {
		t.Fatalf("state after failed start = %+v", state)
	}
}

func TestStartMonitoringIgnoresDuplicateWhileOpening(t *testing.T) {
	fake := &fakeEngine{
		startEntered: make(chan struct{}, 2),
		startRelease: make(chan struct{}),
	}
	controller := NewController(fake)
	config := engine.AudioConfig{InputDeviceID: "in", OutputDeviceID: "out", InputChannel: 0, BufferSize: 128}
	released := false
	releaseEngine := func() {
		if !released {
			close(fake.startRelease)
			released = true
		}
	}
	defer releaseEngine()
	firstDone := make(chan error, 1)
	go func() { firstDone <- controller.StartMonitoring(config) }()
	select {
	case <-fake.startEntered:
	case <-time.After(time.Second):
		t.Fatal("initial Start did not reach the engine")
	}
	if state := controller.State(); !state.Starting || state.Running || state.Status != "Starting" {
		t.Fatalf("state while engine opens = %+v, want starting", state)
	}

	duplicateDone := make(chan error, 1)
	go func() { duplicateDone <- controller.StartMonitoring(config) }()
	select {
	case err := <-duplicateDone:
		if err != nil {
			t.Fatalf("duplicate Start() error = %v, want no-op", err)
		}
	case <-time.After(time.Second):
		releaseEngine()
		<-firstDone
		<-duplicateDone
		t.Fatal("duplicate Start did not return while the first open was pending")
	}

	starts := 0
	for _, operation := range fake.operations {
		if operation == "start:in:out" {
			starts++
		}
	}
	if starts != 1 {
		t.Fatalf("engine Start calls while opening = %d, want 1", starts)
	}
	releaseEngine()
	if err := <-firstDone; err != nil {
		t.Fatalf("initial Start() error = %v", err)
	}
	if err := controller.StartMonitoring(config); err != nil {
		t.Fatalf("Start() while already running error = %v", err)
	}
	starts = 0
	for _, operation := range fake.operations {
		if operation == "start:in:out" {
			starts++
		}
	}
	if state := controller.State(); !state.Running || state.Starting || state.Status != "Running" || starts != 1 {
		t.Fatalf("state after open = %+v, engine Start calls = %d, want running and one call", state, starts)
	}
}

func TestStartGuardSurvivesQueuedStatePublication(t *testing.T) {
	fake := &fakeEngine{
		startEntered: make(chan struct{}, 4),
		startRelease: make(chan struct{}),
	}
	controller := NewController(fake)
	queuedUpdates := make(chan func(), 8)
	controller.SetUpdateOnMain(func(fn func()) { queuedUpdates <- fn })
	config := engine.AudioConfig{InputDeviceID: "in", OutputDeviceID: "out", InputChannel: 0, BufferSize: 128}
	firstDone := make(chan error, 1)
	go func() { firstDone <- controller.StartMonitoring(config) }()
	select {
	case <-fake.startEntered:
	case <-time.After(time.Second):
		close(fake.startRelease)
		t.Fatal("initial Start did not reach the engine")
	}
	close(fake.startRelease)
	if err := <-firstDone; err != nil {
		t.Fatalf("initial Start() error = %v", err)
	}
	if err := controller.StartMonitoring(config); err != nil {
		t.Fatalf("duplicate Start() error = %v", err)
	}

	starts := 0
	for _, operation := range fake.operations {
		if operation == "start:in:out" {
			starts++
		}
	}
	for {
		select {
		case update := <-queuedUpdates:
			update()
		default:
			goto updatesDrained
		}
	}

updatesDrained:
	if starts != 1 {
		t.Fatalf("engine Start calls before queued UI updates applied = %d, want 1", starts)
	}
	if err := controller.StartMonitoring(config); err != nil {
		t.Fatalf("Start() while running error = %v", err)
	}
	starts = 0
	for _, operation := range fake.operations {
		if operation == "start:in:out" {
			starts++
		}
	}
	if state := controller.State(); !state.Running || state.Starting {
		t.Fatalf("state after queued UI updates = %+v, want running", state)
	}
	if starts != 1 {
		t.Fatalf("engine Start calls after running state = %d, want 1", starts)
	}
}

func TestSnapshotStateChangesBeforeQueuedRedraw(t *testing.T) {
	fake := &fakeEngine{
		running:          true,
		snapshotInputID:  "input-1",
		snapshotOutputID: "output-1",
		snapshotBuffer:   256,
	}
	controller := NewController(fake)
	queuedUpdates := make(chan func(), 1)
	controller.SetUpdateOnMain(func(fn func()) { queuedUpdates <- fn })

	controller.RefreshSnapshot()
	state := controller.State()
	if !state.Running || state.Status != "Running" || state.SelectedInputID != "input-1" || state.SelectedOutputID != "output-1" || state.BufferSize != 256 {
		t.Fatalf("controller state before queued redraw = %+v", state)
	}
	select {
	case update := <-queuedUpdates:
		update()
	default:
		t.Fatal("snapshot did not schedule a UI redraw")
	}
}

func TestStoppedSnapshotPreservesDeviceAndBufferSelections(t *testing.T) {
	fake := &fakeEngine{
		snapshotInputID:  "old-input",
		snapshotOutputID: "old-output",
		snapshotBuffer:   128,
	}
	controller := NewController(fake)
	controller.SelectInput("chosen-input")
	controller.SelectOutput("chosen-output")
	controller.SelectInputChannel(1)
	controller.SelectBufferSize(256)

	controller.RefreshSnapshot()
	state := controller.State()
	if state.SelectedInputID != "chosen-input" || state.SelectedOutputID != "chosen-output" || state.InputChannel != 1 || state.BufferSize != 256 {
		t.Fatalf("selections after stopped snapshot = %+v", state)
	}
}

func TestSnapshotErrorSurvivesSuccessfulParameterUpdateAndClears(t *testing.T) {
	fake := &fakeEngine{
		lastError:        "audio device disconnected",
		inputGainApplied: make(chan float64, 1),
	}
	controller := NewController(fake)
	updates := make(chan struct{}, 4)
	controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })

	controller.RefreshSnapshot()
	<-updates
	if got := controller.State().Message; got != fake.lastError {
		t.Fatalf("message from native snapshot = %q, want %q", got, fake.lastError)
	}

	controller.SetInputGain(1)
	select {
	case <-fake.inputGainApplied:
	case <-time.After(time.Second):
		t.Fatal("gain update did not reach the engine")
	}
	select {
	case <-updates:
	case <-time.After(time.Second):
		t.Fatal("gain update did not publish state")
	}
	if got := controller.State().Message; got != fake.lastError {
		t.Fatalf("message after successful gain update = %q, want native error %q", got, fake.lastError)
	}

	fake.lastError = ""
	controller.RefreshSnapshot()
	<-updates
	if got := controller.State().Message; got != "" {
		t.Fatalf("message after native error cleared = %q, want empty", got)
	}
}

func TestClearingSnapshotErrorPreservesControllerError(t *testing.T) {
	fake := &fakeEngine{
		startErr:  errors.New("device open failed"),
		lastError: "device disconnected",
	}
	controller := NewController(fake)
	if err := controller.StartMonitoring(engine.AudioConfig{}); err == nil {
		t.Fatal("StartMonitoring() error = nil, want device error")
	}
	controller.RefreshSnapshot()
	if got := controller.State().Message; got != "device open failed" {
		t.Fatalf("message with controller and snapshot errors = %q, want controller error", got)
	}

	fake.lastError = ""
	controller.RefreshSnapshot()
	if got := controller.State().Message; got != "device open failed" {
		t.Fatalf("message after snapshot error cleared = %q, want controller error", got)
	}
}

func TestSnapshotCallErrorSurvivesSuccessfulParameterUpdateAndClears(t *testing.T) {
	fake := &fakeEngine{
		snapshotErr:      errors.New("snapshot unavailable"),
		inputGainApplied: make(chan float64, 1),
	}
	controller := NewController(fake)
	updates := make(chan struct{}, 4)
	controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })

	controller.RefreshSnapshot()
	<-updates
	controller.SetInputGain(1)
	select {
	case <-fake.inputGainApplied:
	case <-time.After(time.Second):
		t.Fatal("gain update did not reach the engine")
	}
	select {
	case <-updates:
	case <-time.After(time.Second):
		t.Fatal("gain update did not publish state")
	}
	if got := controller.State().Message; got != "snapshot unavailable" {
		t.Fatalf("message after successful gain update = %q, want snapshot error", got)
	}

	fake.snapshotErr = nil
	controller.RefreshSnapshot()
	<-updates
	if got := controller.State().Message; got != "" {
		t.Fatalf("message after successful snapshot = %q, want empty", got)
	}
}

func TestSuccessfulEmptySnapshotPreservesControllerError(t *testing.T) {
	fake := &fakeEngine{startErr: errors.New("device unavailable")}
	controller := NewController(fake)
	if err := controller.StartMonitoring(engine.AudioConfig{}); err == nil {
		t.Fatal("StartMonitoring() error = nil, want device error")
	}
	fake.startErr = nil
	controller.RefreshSnapshot()
	if got := controller.State().Message; got != "device unavailable" {
		t.Fatalf("message after empty-error snapshot = %q, want controller error to persist", got)
	}
}

func TestAddFileAppendsAndRemoveBlockRemovesOnlyRequestedID(t *testing.T) {
	fake := &fakeEngine{}
	controller := NewController(fake)
	for _, path := range []string{"/models/first.nam", "/ir/second.wav"} {
		if err := controller.AddFile(path); err != nil {
			t.Fatal(err)
		}
	}
	if err := controller.RemoveBlock("/models/first.nam"); err != nil {
		t.Fatal(err)
	}
	state := controller.State()
	if len(state.Blocks) != 1 || state.Blocks[0].Block.ID != "/ir/second.wav" || state.Blocks[0].Block.Kind != "ir" {
		t.Fatalf("blocks after add/remove = %+v", state.Blocks)
	}
}

func TestInputGainCoalescesToLatestSubmission(t *testing.T) {
	fake := &fakeEngine{
		inputGainEntered: make(chan float64),
		inputGainRelease: make(chan struct{}),
		inputGainApplied: make(chan float64, 2),
	}
	controller := NewController(fake)
	updates := make(chan struct{}, 2)
	controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })

	controller.SubmitInputGain(1)
	if got := <-fake.inputGainEntered; got != 1 {
		t.Fatalf("first engine gain = %v, want 1", got)
	}
	controller.SubmitInputGain(2)
	controller.SubmitInputGain(3)
	fake.inputGainRelease <- struct{}{}
	if got := <-fake.inputGainApplied; got != 1 {
		t.Fatalf("first applied gain = %v, want 1", got)
	}
	if got := <-fake.inputGainEntered; got != 3 {
		t.Fatalf("coalesced engine gain = %v, want latest value 3", got)
	}
	fake.inputGainRelease <- struct{}{}
	if got := <-fake.inputGainApplied; got != 3 {
		t.Fatalf("final applied gain = %v, want 3", got)
	}
	<-updates
	<-updates

	if fake.inputGainDB != 3 || controller.State().InputGainDB != 3 {
		t.Fatalf("final engine/state gain = %v/%v, want 3/3", fake.inputGainDB, controller.State().InputGainDB)
	}
}

func TestCurrentPresetWaitsForInFlightSliderParameter(t *testing.T) {
	fake := &fakeEngine{
		paramEntered: make(chan float64, 1),
		paramRelease: make(chan struct{}),
	}
	controller := NewController(fake)
	if err := controller.AddFile("/models/amp.nam"); err != nil {
		t.Fatal(err)
	}
	controller.SetBlockParam("/models/amp.nam", "mix", 0.25)
	if got := <-fake.paramEntered; got != 0.25 {
		t.Fatalf("engine mix command = %v, want 0.25", got)
	}

	started := make(chan struct{})
	done := make(chan preset.Preset, 1)
	go func() {
		close(started)
		p, err := controller.CurrentPreset()
		if err != nil {
			done <- preset.Preset{}
			return
		}
		done <- p
	}()
	<-started
	select {
	case p := <-done:
		fake.paramRelease <- struct{}{}
		t.Fatalf("CurrentPreset returned before the engine parameter completed: %+v", p.Blocks)
	case <-time.After(100 * time.Millisecond):
	}
	fake.paramRelease <- struct{}{}
	p := <-done
	if len(p.Blocks) != 1 || p.Blocks[0].Mix != 0.25 {
		t.Fatalf("saved preset mix = %+v, want 0.25", p.Blocks)
	}
}

func TestCurrentPresetWaitsForPendingSliderCommand(t *testing.T) {
	fake := &fakeEngine{}
	controller := NewController(fake)
	if err := controller.AddFile("/models/amp.nam"); err != nil {
		t.Fatal(err)
	}
	updates := make(chan struct{}, 2)
	controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })

	key := parameterKey{blockID: "/models/amp.nam", name: "mix"}
	controller.paramMu.Lock()
	controller.paramRevision[key] = 1
	controller.paramPending[key] = parameterCommand{
		key: key, revision: 1,
		apply:  func() error { return fake.SetParam(key.blockID, key.name, 0.25) },
		update: func(state *AppState) { state.Blocks[0].Block.Mix = 0.25 },
	}
	controller.paramWorker = true
	controller.paramMu.Unlock()

	presetReady := make(chan preset.Preset, 1)
	go func() {
		p, _ := controller.CurrentPreset()
		presetReady <- p
	}()
	select {
	case stale := <-presetReady:
		go controller.runParameterQueue()
		<-updates
		t.Fatalf("CurrentPreset returned before pending slider update: mix=%v", stale.Blocks[0].Mix)
	case <-time.After(100 * time.Millisecond):
	}
	go controller.runParameterQueue()
	select {
	case saved := <-presetReady:
		if len(saved.Blocks) != 1 || saved.Blocks[0].Mix != 0.25 {
			t.Fatalf("CurrentPreset mix = %+v, want 0.25", saved.Blocks)
		}
	case <-time.After(time.Second):
		t.Fatal("CurrentPreset did not resume after the parameter queue drained")
	}
}

func TestBlockParameterRetriesTemporaryEngineBusy(t *testing.T) {
	fake := &fakeEngine{paramBusyReplies: 2}
	controller := NewController(fake)
	if err := controller.AddFile("/models/amp.nam"); err != nil {
		t.Fatal(err)
	}

	controller.SetBlockParam("/models/amp.nam", "mix", 0.25)
	saved, err := controller.CurrentPreset()
	if err != nil {
		t.Fatal(err)
	}
	if len(saved.Blocks) != 1 || saved.Blocks[0].Mix != 0.25 {
		t.Fatalf("preset after temporary busy responses = %+v, want mix 0.25", saved.Blocks)
	}
	if got := len(fake.operations); got != 4 {
		t.Fatalf("engine operation count = %d, want add plus three parameter attempts", got)
	}
}

func TestPresetRestoreRetriesTemporaryParameterBusy(t *testing.T) {
	dir := t.TempDir()
	modelPath := filepath.Join(dir, "amp.nam")
	if err := os.WriteFile(modelPath, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{paramBusyReplies: 2}
	controller := NewController(fake)
	p := preset.Preset{
		SchemaVersion: preset.SchemaVersion,
		EngineRate:    preset.EngineSampleRate,
		Blocks:        []preset.PresetBlock{{Kind: "nam", Path: modelPath, Mix: 0.75}},
	}

	if err := controller.LoadPreset(p); err != nil {
		t.Fatalf("LoadPreset() with temporary busy responses = %v", err)
	}
	state := controller.State()
	if len(state.Blocks) != 1 || state.Blocks[0].Missing || state.Blocks[0].Block.Mix != 0.75 {
		t.Fatalf("restored blocks = %+v, want one loaded NAM block with mix 0.75", state.Blocks)
	}
}

func TestMissingPresetBlockCanBeRelinkedInPlace(t *testing.T) {
	dir := t.TempDir()
	existing := filepath.Join(dir, "amp.nam")
	replacement := filepath.Join(dir, "replacement.wav")
	if err := os.WriteFile(existing, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{}
	controller := NewController(fake)
	preset := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: existing, Mix: 1},
		{Kind: "ir", Path: filepath.Join(dir, "moved.wav"), Bypassed: true, InputGainDB: 1, OutputGainDB: -2, Mix: 0.5},
	}}
	if err := controller.LoadPreset(preset); err != nil {
		t.Fatal(err)
	}
	state := controller.State()
	if len(state.Blocks) != 2 || !state.Blocks[1].Missing || state.Blocks[1].Block.Path != preset.Blocks[1].Path {
		t.Fatalf("missing preset state = %+v, want both slots with unresolved second slot", state.Blocks)
	}
	if state.InputGainDB != preset.InputGainDB || state.OutputGainDB != preset.OutputGainDB {
		t.Fatalf("preset master gains = %v/%v, want %v/%v", state.InputGainDB, state.OutputGainDB, preset.InputGainDB, preset.OutputGainDB)
	}
	if err := controller.RelinkBlock("missing:1", replacement); err != nil {
		t.Fatal(err)
	}
	state = controller.State()
	if state.Blocks[1].Missing || state.Blocks[1].Message != "" || state.Blocks[1].Block.Path != replacement {
		t.Fatalf("relinked block = %+v", state.Blocks[1])
	}
	if len(fake.blocks) != 2 || fake.blocks[0].Path != existing || fake.blocks[1].Path != replacement {
		t.Fatalf("engine order after relink = %+v", fake.blocks)
	}
	block := fake.blocks[1]
	if !block.Bypassed || block.InputGainDB != 1 || block.OutputGainDB != -2 || block.Mix != 0.5 {
		t.Fatalf("relinked block parameters = %+v", block)
	}
}

func TestLoadPresetPreservesCurrentChainWhenRemovalFails(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "current.nam")
	replacement := filepath.Join(dir, "replacement.nam")
	for _, path := range []string{current, replacement} {
		if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	fake := &fakeEngine{}
	controller := NewController(fake)
	if err := controller.AddFile(current); err != nil {
		t.Fatal(err)
	}
	fake.removeErr = errors.New("engine busy")
	err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: replacement, Mix: 1},
	}})
	if err == nil {
		t.Fatal("LoadPreset() error = nil, want old-block removal failure")
	}
	state := controller.State()
	if len(state.Blocks) != 1 || state.Blocks[0].Block.Path != current || state.Blocks[0].Missing {
		t.Fatalf("visible chain after removal failure = %+v, want current block retained", state.Blocks)
	}
	if len(fake.blocks) != 1 || fake.blocks[0].Path != current {
		t.Fatalf("engine chain after removal failure = %+v, want current block retained", fake.blocks)
	}
}

func TestLoadPresetMarksPreviouslyRemovedBlocksAsVisibleRecoverySlots(t *testing.T) {
	dir := t.TempDir()
	first := filepath.Join(dir, "first.nam")
	second := filepath.Join(dir, "second.nam")
	for _, path := range []string{first, second} {
		if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	fake := &fakeEngine{removeErrByID: map[string]error{second: errors.New("engine busy")}}
	controller := NewController(fake)
	for _, path := range []string{first, second} {
		if err := controller.AddFile(path); err != nil {
			t.Fatal(err)
		}
	}
	err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000})
	if err == nil {
		t.Fatal("LoadPreset() error = nil, want old-block removal failure")
	}
	state := controller.State()
	if len(state.Blocks) != 2 || !state.Blocks[0].Missing || state.Blocks[0].Block.Path != first || state.Blocks[1].Missing || state.Blocks[1].Block.Path != second {
		t.Fatalf("visible chain after partial removal = %+v", state.Blocks)
	}
	if len(fake.blocks) != 1 || fake.blocks[0].Path != second {
		t.Fatalf("engine chain after partial removal = %+v", fake.blocks)
	}
}

func TestLoadPresetShowsBlockWhoseRollbackRemovalFails(t *testing.T) {
	dir := t.TempDir()
	mismatch := filepath.Join(dir, "cab.wav")
	if err := os.WriteFile(mismatch, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{removeErrByID: map[string]error{mismatch: errors.New("cleanup failed")}}
	controller := NewController(fake)
	err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: mismatch, Mix: 1},
	}})
	if err == nil {
		t.Fatal("LoadPreset() error = nil, want kind mismatch and failed cleanup")
	}
	state := controller.State()
	if len(state.Blocks) != 2 || !state.Blocks[0].Missing || !state.Blocks[1].Orphaned || state.Blocks[1].Block.ID != mismatch {
		t.Fatalf("visible chain after failed cleanup = %+v, want placeholder and visible engine orphan", state.Blocks)
	}
	if len(fake.blocks) != 1 || fake.blocks[0].ID != mismatch {
		t.Fatalf("engine chain after failed cleanup = %+v", fake.blocks)
	}
}

func TestLoadPresetShowsBlockWhenParameterRollbackRemovalFails(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "amp.nam")
	if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{
		removeErrByID: map[string]error{path: errors.New("cleanup failed")},
		setParamErr:   errors.New("parameter rejected"),
	}
	controller := NewController(fake)
	err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: path, Mix: 1},
	}})
	if err == nil {
		t.Fatal("LoadPreset() error = nil, want parameter failure")
	}
	state := controller.State()
	if len(state.Blocks) != 2 || !state.Blocks[0].Missing || !state.Blocks[1].Orphaned || state.Blocks[1].Block.ID != path {
		t.Fatalf("visible chain after parameter rollback failure = %+v", state.Blocks)
	}
	if len(fake.blocks) != 1 || fake.blocks[0].ID != path {
		t.Fatalf("engine chain after parameter rollback failure = %+v", fake.blocks)
	}
}

func TestRelinkShowsBlockWhenOrderingRollbackRemovalFails(t *testing.T) {
	dir := t.TempDir()
	missing := filepath.Join(dir, "amp.nam")
	replacement := filepath.Join(dir, "replacement.nam")
	if err := os.WriteFile(replacement, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{
		removeErrByID: map[string]error{replacement: errors.New("cleanup failed")},
		reorderErr:    errors.New("reorder failed"),
	}
	controller := NewController(fake)
	if err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: missing, Mix: 1},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := controller.RelinkBlock("missing:0", replacement); err == nil {
		t.Fatal("RelinkBlock() error = nil, want reorder failure")
	}
	state := controller.State()
	if len(state.Blocks) != 2 || !state.Blocks[0].Missing || !state.Blocks[1].Orphaned {
		t.Fatalf("visible chain after ordering rollback failure = %+v", state.Blocks)
	}
	if len(fake.blocks) != 1 || fake.blocks[0].ID != replacement {
		t.Fatalf("engine chain after ordering rollback failure = %+v", fake.blocks)
	}
}

func TestRelinkRollbackOrphanMatchesEngineTailOrder(t *testing.T) {
	dir := t.TempDir()
	missing := filepath.Join(dir, "moved.nam")
	validIR := filepath.Join(dir, "cab.wav")
	replacement := filepath.Join(dir, "replacement.nam")
	for _, path := range []string{validIR, replacement} {
		if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	fake := &fakeEngine{
		removeErrByID: map[string]error{replacement: errors.New("cleanup failed")},
		reorderErr:    errors.New("reorder failed"),
	}
	controller := NewController(fake)
	if err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: missing, Mix: 1},
		{Kind: "ir", Path: validIR, Mix: 1},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := controller.RelinkBlock("missing:0", replacement); err == nil {
		t.Fatal("RelinkBlock() error = nil, want reorder and cleanup failure")
	}
	state := controller.State()
	if len(state.Blocks) != 3 || !state.Blocks[0].Missing || state.Blocks[1].Block.Path != validIR || !state.Blocks[2].Orphaned || state.Blocks[2].Block.Path != replacement {
		t.Fatalf("visible chain after relink rollback = %+v, want orphan at engine tail", state.Blocks)
	}
	if len(fake.blocks) != 2 || fake.blocks[0].Path != validIR || fake.blocks[1].Path != replacement {
		t.Fatalf("engine chain after relink rollback = %+v", fake.blocks)
	}
}

func TestOrphanedBlockCanBeRemovedFromEngine(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cab.wav")
	if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{removeErrByID: map[string]error{path: errors.New("cleanup failed")}}
	controller := NewController(fake)
	_ = controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: path, Mix: 1},
	}})
	fake.removeErrByID = nil
	if err := controller.RemoveBlock(path); err != nil {
		t.Fatal(err)
	}
	if len(fake.blocks) != 0 {
		t.Fatalf("engine blocks after orphan removal = %+v, want none", fake.blocks)
	}
	if state := controller.State(); len(state.Blocks) != 1 || !state.Blocks[0].Missing {
		t.Fatalf("visible slots after orphan removal = %+v, want the unresolved preset slot", state.Blocks)
	}
}

func TestOrphanAlreadyMissingFromEngineCanBeDismissed(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cab.wav")
	if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{removeErrByID: map[string]error{path: errors.New("temporary failure")}}
	controller := NewController(fake)
	_ = controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: path, Mix: 1},
	}})
	fake.blocks = nil
	fake.removeErrByID = nil
	if err := controller.RemoveBlock(path); err != nil {
		t.Fatalf("RemoveBlock() for missing orphan error = %v, want success", err)
	}
	state := controller.State()
	if len(state.Blocks) != 1 || !state.Blocks[0].Missing {
		t.Fatalf("visible chain after dismissing orphan = %+v", state.Blocks)
	}
}

func TestLoadPresetTreatsPreviouslyRemovedBlockAsAlreadyGone(t *testing.T) {
	dir := t.TempDir()
	old := filepath.Join(dir, "old.nam")
	newPath := filepath.Join(dir, "new.nam")
	for _, path := range []string{old, newPath} {
		if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	fake := &fakeEngine{}
	controller := NewController(fake)
	if err := controller.AddFile(old); err != nil {
		t.Fatal(err)
	}
	fake.blocks = nil
	if err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: newPath, Mix: 1},
	}}); err != nil {
		t.Fatalf("LoadPreset() when old block is already gone error = %v", err)
	}
	state := controller.State()
	if len(state.Blocks) != 1 || state.Blocks[0].Block.Path != newPath || state.Blocks[0].Missing {
		t.Fatalf("visible chain after loading over stale state = %+v", state.Blocks)
	}
}

func TestLoadPresetKeepsValidBlocksWhenReorderIncludesRollbackOrphan(t *testing.T) {
	dir := t.TempDir()
	mismatch := filepath.Join(dir, "cab.wav")
	valid := filepath.Join(dir, "amp.nam")
	for _, path := range []string{mismatch, valid} {
		if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	fake := &fakeEngine{removeErrByID: map[string]error{mismatch: errors.New("cleanup failed")}}
	controller := NewController(fake)
	err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: mismatch, Mix: 1},
		{Kind: "nam", Path: valid, Mix: 1},
	}})
	if err == nil {
		t.Fatal("LoadPreset() error = nil, want mismatched-file error")
	}
	state := controller.State()
	if len(state.Blocks) != 3 || !state.Blocks[0].Missing || !state.Blocks[1].Orphaned || state.Blocks[2].Block.Path != valid {
		t.Fatalf("visible chain with orphan and valid block = %+v", state.Blocks)
	}
	if len(fake.blocks) != 2 || fake.blocks[0].Path != mismatch || fake.blocks[1].Path != valid {
		t.Fatalf("engine order after partial preset load = %+v", fake.blocks)
	}
}

func TestRelinkShowsBlockWhoseRollbackRemovalFails(t *testing.T) {
	dir := t.TempDir()
	missing := filepath.Join(dir, "amp.nam")
	replacement := filepath.Join(dir, "cab.wav")
	if err := os.WriteFile(replacement, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{removeErrByID: map[string]error{replacement: errors.New("cleanup failed")}}
	controller := NewController(fake)
	if err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: missing, Mix: 1},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := controller.RelinkBlock("missing:0", replacement); err == nil {
		t.Fatal("RelinkBlock() error = nil, want kind mismatch and failed cleanup")
	}
	state := controller.State()
	if len(state.Blocks) != 2 || !state.Blocks[0].Missing || !state.Blocks[1].Orphaned || state.Blocks[1].Block.ID != replacement {
		t.Fatalf("visible chain after failed relink cleanup = %+v", state.Blocks)
	}
	if len(fake.blocks) != 1 || fake.blocks[0].ID != replacement {
		t.Fatalf("engine chain after failed relink cleanup = %+v", fake.blocks)
	}
}

func TestLoadPresetKeepsGainStateWhenEngineRejectsGain(t *testing.T) {
	fake := &fakeEngine{
		inputGainErr: errors.New("input gain rejected"),
	}
	controller := NewController(fake)
	p := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6}
	err := controller.LoadPreset(p)
	if err == nil || !strings.Contains(err.Error(), "input gain rejected") {
		t.Fatalf("LoadPreset() error = %v, want input gain failure", err)
	}
	state := controller.State()
	if state.InputGainDB != 0 || state.OutputGainDB != -6 || fake.inputGainDB != 0 || fake.outputGainDB != -6 {
		t.Fatalf("gain state after partial apply = state %v/%v engine %v/%v", state.InputGainDB, state.OutputGainDB, fake.inputGainDB, fake.outputGainDB)
	}
	if !strings.Contains(state.Message, "input gain rejected") {
		t.Fatalf("preset gain error not displayed: %q", state.Message)
	}
}

func TestRelinkRejectsDifferentBlockKindWithoutChangingChain(t *testing.T) {
	dir := t.TempDir()
	missing := filepath.Join(dir, "moved.nam")
	replacementWAV := filepath.Join(dir, "cab.wav")
	if err := os.WriteFile(replacementWAV, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	fake := &fakeEngine{}
	controller := NewController(fake)
	if err := controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: missing, Mix: 1},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := controller.RelinkBlock("missing:0", replacementWAV); err == nil {
		t.Fatal("RelinkBlock() error = nil, want block-kind mismatch")
	}
	state := controller.State()
	if len(state.Blocks) != 1 || !state.Blocks[0].Missing || state.Blocks[0].Block.Path != missing {
		t.Fatalf("chain after rejected relink = %+v", state.Blocks)
	}
	if len(fake.blocks) != 0 {
		t.Fatalf("engine blocks after rejected relink = %+v, want none", fake.blocks)
	}
}

func TestLoadingPresetInvalidatesPendingParameterCommands(t *testing.T) {
	fake := &fakeEngine{
		inputGainEntered: make(chan float64, 2),
		inputGainRelease: make(chan struct{}, 2),
	}
	controller := NewController(fake)

	controller.SubmitInputGain(9)
	select {
	case <-fake.inputGainEntered:
	case <-time.After(time.Second):
		t.Fatal("old gain command did not reach the engine")
	}
	controller.SubmitInputGain(8)

	loadDone := make(chan error, 1)
	go func() {
		loadDone <- controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: 2, OutputGainDB: -3})
	}()
	fake.inputGainRelease <- struct{}{}
	for {
		select {
		case <-fake.inputGainEntered:
			fake.inputGainRelease <- struct{}{}
		case err := <-loadDone:
			if err != nil {
				t.Fatal(err)
			}
			goto loaded
		case <-time.After(time.Second):
			t.Fatal("LoadPreset did not finish after the pending parameter command")
		}
	}

loaded:
	if fake.inputGainDB != 2 || controller.State().InputGainDB != 2 {
		t.Fatalf("gain after preset load = engine %v, state %v; want 2", fake.inputGainDB, controller.State().InputGainDB)
	}
}

func TestPresetLoadSuppressesSliderChangesUntilRedraw(t *testing.T) {
	fake := &fakeEngine{
		inputGainEntered: make(chan float64, 4),
		inputGainRelease: make(chan struct{}, 4),
		inputGainApplied: make(chan float64, 4),
	}
	fake.inputGainRelease <- struct{}{}
	controller := NewController(fake)
	queuedUpdates := make(chan func(), 8)
	controller.SetUpdateOnMain(func(fn func()) { queuedUpdates <- fn })
	p := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6}
	if err := controller.LoadPreset(p); err != nil {
		t.Fatal(err)
	}
	if got := <-fake.inputGainEntered; got != -4 {
		t.Fatalf("preset input gain sent to engine = %v, want -4", got)
	}
	<-fake.inputGainApplied
	if !controller.State().PresetLoading {
		t.Fatal("preset loading should remain active until the queued redraw applies")
	}
	if _, err := controller.CurrentPreset(); err == nil {
		t.Fatal("CurrentPreset() error = nil while preset is still loading")
	}

	controller.SetInputGain(8)
	select {
	case value := <-fake.inputGainEntered:
		fake.inputGainRelease <- struct{}{}
		<-fake.inputGainApplied
		t.Fatalf("slider update during preset load reached engine with value %v", value)
	case <-time.After(100 * time.Millisecond):
	}

	for len(queuedUpdates) > 0 {
		(<-queuedUpdates)()
	}
	if controller.State().PresetLoading {
		t.Fatal("preset loading flag remained after its queued redraw")
	}
	loaded, err := controller.CurrentPreset()
	if err != nil {
		t.Fatalf("CurrentPreset() after load = %v", err)
	}
	if loaded.InputGainDB != -4 || loaded.OutputGainDB != -6 {
		t.Fatalf("CurrentPreset() after load = gains %v/%v, want -4/-6", loaded.InputGainDB, loaded.OutputGainDB)
	}
}

func TestOverlappingPresetLoadCannotClearActiveBusyState(t *testing.T) {
	fake := &fakeEngine{}
	controller := NewController(fake)
	queuedUpdates := make(chan func(), 16)
	controller.SetUpdateOnMain(func(fn func()) { queuedUpdates <- fn })
	first := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6}
	second := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: 7, OutputGainDB: 3}
	if err := controller.LoadPreset(first); err != nil {
		t.Fatal(err)
	}
	if !controller.State().PresetLoading {
		t.Fatal("preset loading should remain active until redraw")
	}
	if err := controller.LoadPreset(second); err == nil {
		t.Fatal("overlapping LoadPreset() error = nil, want busy error")
	}
	if fake.inputGainDB != -4 || controller.State().InputGainDB != -4 {
		t.Fatalf("overlapping load changed gains to engine %v, state %v", fake.inputGainDB, controller.State().InputGainDB)
	}

	for len(queuedUpdates) > 0 {
		(<-queuedUpdates)()
	}
	if controller.State().PresetLoading {
		t.Fatal("first load's redraw did not clear the busy state")
	}
	if saved, err := controller.CurrentPreset(); err != nil || saved.InputGainDB != -4 {
		t.Fatalf("current preset after overlapping load = %v / %v", saved.InputGainDB, err)
	}
}
