package app

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/damonrock/guitar-desktop/internal/preset"
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

func waitForAppState(t *testing.T, a *App, updates <-chan struct{}, description string, ready func(AppState) bool) AppState {
	t.Helper()
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	for {
		if state := a.State(); ready(state) {
			return state
		}
		select {
		case <-updates:
		case <-timer.C:
			t.Fatalf("timed out waiting for %s: %+v", description, a.State())
		}
	}
}

func selectOption(t *testing.T, tester *ui.Tester, control, option string) {
	t.Helper()
	if err := tester.Click(control); err != nil {
		t.Fatal(err)
	}
	if err := tester.Click(option); err != nil {
		t.Fatal(err)
	}
}

func TestInitialViewShowsStoppedChain(t *testing.T) {
	app := New(nil)
	tester := ui.NewTester(app.View, 1280, 800)
	for _, label := range []string{"NAM Effects", "Stopped", "Input", "No input device", "Output", "No output device", "Input gain", "Master gain", "Effects chain", "Add NAM Model", "Add IR"} {
		if !tester.HasText(label) {
			t.Errorf("initial view is missing %q; text=%q", label, tester.Texts())
		}
	}
	if tester.HasText("Monitoring") {
		t.Fatalf("new app must not claim that monitoring is active")
	}
}

func TestDeviceControlsApplySelectionsInEventOrder(t *testing.T) {
	fake := &fakeEngine{devices: []engine.Device{
		{ID: "input-1", Name: "Interface In One", InputChannels: 2},
		{ID: "input-2", Name: "Interface In Two", InputChannels: 2},
		{ID: "output-1", Name: "Interface Out One", OutputChannels: 2},
		{ID: "output-2", Name: "Interface Out Two", OutputChannels: 2},
	}}
	a := New(fake)
	updates := make(chan struct{}, 16)
	a.controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })
	a.controller.RefreshDevices()
	<-updates
	tester := ui.NewTester(a.View, 1280, 800)

	selectOption(t, tester, "Input device", "Interface In Two · input-2")
	selectOption(t, tester, "Input device", "Interface In One · input-1")
	waitForAppState(t, a, updates, "latest input selection", func(state AppState) bool { return state.SelectedInputID == "input-1" })
	selectOption(t, tester, "Output device", "Interface Out One · output-1")
	selectOption(t, tester, "Output device", "Interface Out Two · output-2")
	waitForAppState(t, a, updates, "latest output selection", func(state AppState) bool { return state.SelectedOutputID == "output-2" })
	selectOption(t, tester, "Input channel", "Input 2")
	waitForAppState(t, a, updates, "input channel selection", func(state AppState) bool { return state.InputChannel == 1 })
	selectOption(t, tester, "Buffer size", "256")
	waitForAppState(t, a, updates, "buffer selection", func(state AppState) bool { return state.BufferSize == 256 })

	state := a.State()
	if state.SelectedInputID != "input-1" || state.SelectedOutputID != "output-2" || state.InputChannel != 1 || state.BufferSize != 256 {
		t.Fatalf("device controls state = %+v", state)
	}
}

func TestStartButtonShowsStartingAndIgnoresSecondClick(t *testing.T) {
	fake := &fakeEngine{
		startEntered: make(chan struct{}, 1),
		startRelease: make(chan struct{}),
	}
	a := New(fake)
	a.controller.SelectInput("input-1")
	a.controller.SelectOutput("output-1")
	a.controller.SelectInputChannel(0)
	updates := make(chan struct{}, 4)
	a.controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })
	tester := ui.NewTester(a.View, 1280, 800)

	released := false
	releaseEngine := func() {
		if !released {
			close(fake.startRelease)
			released = true
		}
	}
	defer releaseEngine()

	if err := tester.Click("Start"); err != nil {
		t.Fatal(err)
	}
	select {
	case <-fake.startEntered:
	case <-time.After(time.Second):
		t.Fatal("Start button did not reach the engine")
	}
	tester.Frame()
	if state := a.State(); !state.Starting || state.Running || !tester.HasText("Starting...") {
		t.Fatalf("view while engine opens: state=%+v text=%q", state, tester.Texts())
	}
	if err := tester.Click("Starting..."); err != nil {
		t.Fatal(err)
	}
	starts := 0
	for _, operation := range fake.operations {
		if operation == "start:input-1:output-1" {
			starts++
		}
	}
	if starts != 1 {
		t.Fatalf("engine Start calls while button is disabled = %d, want 1", starts)
	}

	releaseEngine()
	waitForAppState(t, a, updates, "monitoring to start", func(state AppState) bool { return state.Running })
	tester.Frame()
	if state := a.State(); state.Starting || !tester.HasText("Stop") {
		t.Fatalf("view after open: state=%+v text=%q", state, tester.Texts())
	}
}

func TestNativeControlsDriveFakeEngine(t *testing.T) {
	fake := &fakeEngine{devices: []engine.Device{
		{ID: "input-1", Name: "Interface In", InputChannels: 2},
		{ID: "output-1", Name: "Interface Out", OutputChannels: 2},
	}}
	a := New(fake)
	updates := make(chan struct{}, 32)
	a.controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })
	a.controller.RefreshDevices()
	<-updates
	a.controller.SelectInput("input-1")
	a.controller.SelectOutput("output-1")
	a.controller.SelectInputChannel(0)
	a.controller.SelectBufferSize(128)
	for range 4 {
		<-updates
	}
	a.openDialog = func(filters []mygo.FileFilter) ([]string, error) {
		if len(filters) != 1 || !reflect.DeepEqual(filters[0].Extensions, []string{"nam"}) {
			t.Errorf("NAM dialog filters = %+v", filters)
		}
		return []string{"/models/clean.nam"}, nil
	}
	tester := ui.NewTester(a.View, 1280, 900)

	if err := tester.Click("Start"); err != nil {
		t.Fatal(err)
	}
	waitForAppState(t, a, updates, "monitoring to start", func(state AppState) bool { return state.Running })
	tester.Frame()
	if !tester.HasText("Running") || !fake.running {
		t.Fatalf("after Start: status=%+v text=%q", a.State(), tester.Texts())
	}

	if err := tester.Click("Add NAM Model"); err != nil {
		t.Fatal(err)
	}
	waitForAppState(t, a, updates, "NAM model to load", func(state AppState) bool {
		return len(state.Blocks) == 1 && state.Blocks[0].Block.ID == "/models/clean.nam"
	})
	tester.Frame()
	if !tester.HasText("clean.nam") || len(a.State().Blocks) != 1 {
		t.Fatalf("after import: state=%+v text=%q", a.State(), tester.Texts())
	}

	if err := tester.Click("Bypass"); err != nil {
		t.Fatal(err)
	}
	waitForAppState(t, a, updates, "bypass to update", func(state AppState) bool {
		return len(state.Blocks) == 1 && state.Blocks[0].Block.Bypassed
	})
	tester.Frame()
	if !a.State().Blocks[0].Block.Bypassed || !fake.blocks[0].Bypassed || !tester.HasText("Enable") {
		t.Fatalf("after bypass: state=%+v text=%q", a.State(), tester.Texts())
	}

	if err := tester.Click("Block input gain"); err != nil {
		t.Fatal(err)
	}
	tester.Key(0, ui.KeyRight)
	waitForAppState(t, a, updates, "block input gain to update", func(state AppState) bool {
		return len(state.Blocks) == 1 && state.Blocks[0].Block.InputGainDB != 0 && fake.blocks[0].InputGainDB == state.Blocks[0].Block.InputGainDB
	})
	tester.Frame()
	if a.State().Blocks[0].Block.InputGainDB == 0 {
		t.Fatalf("block input gain did not change: %+v", a.State().Blocks[0].Block)
	}
	if err := tester.Click("Block mix"); err != nil {
		t.Fatal(err)
	}
	tester.Key(0, ui.KeyLeft)
	waitForAppState(t, a, updates, "block mix to update", func(state AppState) bool {
		return len(state.Blocks) == 1 && state.Blocks[0].Block.Mix != 1 && fake.blocks[0].Mix == state.Blocks[0].Block.Mix
	})
	tester.Frame()
	if a.State().Blocks[0].Block.Mix == 1 {
		t.Fatalf("block mix did not change: %+v", a.State().Blocks[0].Block)
	}
	if fake.blocks[0].InputGainDB != a.State().Blocks[0].Block.InputGainDB || fake.blocks[0].Mix != a.State().Blocks[0].Block.Mix {
		t.Fatalf("fake engine parameters = input %v, mix %v; state parameters = input %v, mix %v", fake.blocks[0].InputGainDB, fake.blocks[0].Mix, a.State().Blocks[0].Block.InputGainDB, a.State().Blocks[0].Block.Mix)
	}

	a.openDialog = func(filters []mygo.FileFilter) ([]string, error) {
		if len(filters) != 1 || !reflect.DeepEqual(filters[0].Extensions, []string{"wav"}) {
			t.Errorf("IR dialog filters = %+v", filters)
		}
		return []string{"/impulses/room.wav"}, nil
	}
	if err := tester.Click("Add IR"); err != nil {
		t.Fatal(err)
	}
	waitForAppState(t, a, updates, "IR to load", func(state AppState) bool {
		return len(state.Blocks) == 2 && state.Blocks[1].Block.ID == "/impulses/room.wav"
	})
	tester.Frame()
	if err := tester.Click("Move down"); err != nil {
		t.Fatal(err)
	}
	waitForAppState(t, a, updates, "chain order to update", func(state AppState) bool {
		return len(state.Blocks) == 2 && state.Blocks[0].Block.ID == "/impulses/room.wav" && fake.blocks[0].ID == "/impulses/room.wav"
	})
	if got := []string{a.State().Blocks[0].Block.ID, a.State().Blocks[1].Block.ID}; !reflect.DeepEqual(got, []string{"/impulses/room.wav", "/models/clean.nam"}) {
		t.Fatalf("reordered IDs = %v", got)
	}
	if got := []string{fake.blocks[0].ID, fake.blocks[1].ID}; !reflect.DeepEqual(got, []string{"/impulses/room.wav", "/models/clean.nam"}) {
		t.Fatalf("fake engine reordered IDs = %v", got)
	}

	if err := tester.Click("Remove"); err != nil {
		t.Fatal(err)
	}
	waitForAppState(t, a, updates, "IR to be removed", func(state AppState) bool {
		return len(state.Blocks) == 1 && state.Blocks[0].Block.ID == "/models/clean.nam" && len(fake.blocks) == 1
	})
	tester.Frame()
	if len(a.State().Blocks) != 1 || a.State().Blocks[0].Block.ID != "/models/clean.nam" {
		t.Fatalf("after remove: %+v", a.State().Blocks)
	}
	requiredCalls := []string{
		"start:input-1:output-1",
		"add:/models/clean.nam",
		"param:/models/clean.nam:bypassed",
		"param:/models/clean.nam:inputGainDb",
		"param:/models/clean.nam:mix",
		"add:/impulses/room.wav",
		"reorder",
		"remove:/impulses/room.wav",
	}
	for _, want := range requiredCalls {
		found := false
		for _, got := range fake.operations {
			if got == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("fake engine did not receive %q; calls = %v", want, fake.operations)
		}
	}
}

func TestOpenPresetRestoresMissingBlockAndRelinkAction(t *testing.T) {
	dir := t.TempDir()
	existing := filepath.Join(dir, "amp.nam")
	missing := filepath.Join(dir, "moved.wav")
	replacement := filepath.Join(dir, "cab.wav")
	for _, path := range []string{existing, replacement} {
		if err := os.WriteFile(path, []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	saved := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: existing, Mix: 1},
		{Kind: "ir", Path: missing, Bypassed: true, InputGainDB: 1, OutputGainDB: -2, Mix: 0.5},
	}}
	presetPath := filepath.Join(dir, "studio.json")
	if err := os.WriteFile(presetPath, preset.Encode(saved), 0o600); err != nil {
		t.Fatal(err)
	}

	fake := &fakeEngine{}
	a := New(fake)
	updates := make(chan struct{}, 32)
	a.controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })
	a.openPresetDialog = func(options mygo.OpenDialogOptions) ([]string, error) {
		if len(options.Filters) != 1 || !reflect.DeepEqual(options.Filters[0].Extensions, []string{"json"}) {
			t.Errorf("preset dialog filters = %+v", options.Filters)
		}
		return []string{presetPath}, nil
	}
	tester := ui.NewTester(a.View, 1280, 900)

	if err := tester.Click("Open Preset"); err != nil {
		t.Fatal(err)
	}
	state := waitForAppState(t, a, updates, "preset to load", func(state AppState) bool {
		return len(state.Blocks) == 2 && state.Blocks[1].Missing
	})
	if state.Blocks[0].Block.Path != existing || state.Blocks[0].Missing {
		t.Fatalf("first restored block = %+v", state.Blocks[0])
	}
	// The virtualized list measures newly loaded rows before placing them.
	tester.Frame()
	tester.Frame()
	if !tester.HasText("File not found") || !tester.HasText("Relink") {
		t.Fatalf("missing preset row is not actionable; text=%q", tester.Texts())
	}

	relinkOpened := make(chan struct{}, 1)
	a.openDialog = func(filters []mygo.FileFilter) ([]string, error) {
		if len(filters) != 1 || !reflect.DeepEqual(filters[0].Extensions, []string{"wav"}) {
			t.Errorf("relink filters = %+v", filters)
		}
		relinkOpened <- struct{}{}
		return []string{replacement}, nil
	}
	if err := tester.Click("Relink"); err != nil {
		t.Fatal(err)
	}
	select {
	case <-relinkOpened:
	case <-time.After(time.Second):
		t.Fatalf("Relink click did not open the replacement dialog; calls=%v", fake.operations)
	}
	state = waitForAppState(t, a, updates, "missing block to relink", func(state AppState) bool {
		return len(state.Blocks) == 2 && !state.Blocks[1].Missing
	})
	if len(fake.blocks) != 2 || fake.blocks[0].Path != existing || fake.blocks[1].Path != replacement {
		t.Fatalf("engine order after relink = %+v", fake.blocks)
	}
	if state.Blocks[1].Block.InputGainDB != 1 || state.Blocks[1].Block.OutputGainDB != -2 || state.Blocks[1].Block.Mix != 0.5 || !state.Blocks[1].Block.Bypassed {
		t.Fatalf("relinked saved parameters = %+v", state.Blocks[1].Block)
	}
}

func TestSavePresetWritesJSONUnderUserDataWithDetectedParameters(t *testing.T) {
	dir := t.TempDir()
	modelPath := filepath.Join(dir, "amp.nam")
	if err := os.WriteFile(modelPath, []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	userData := t.TempDir()
	fake := &fakeEngine{}
	a := New(fake)
	a.dataDir = func() (string, error) { return userData, nil }
	updates := make(chan struct{}, 32)
	a.controller.SetUpdateOnMain(func(fn func()) { fn(); updates <- struct{}{} })
	if err := a.controller.LoadPreset(preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: modelPath, Bypassed: true, InputGainDB: 2, OutputGainDB: -1, Mix: 0.75},
	}}); err != nil {
		t.Fatal(err)
	}
	<-updates
	a.controller.fail(errors.New("previous preset error"))
	<-updates

	a.saveDialog = func(options mygo.SaveDialogOptions) (string, error) {
		presetsDir := filepath.Join(userData, "presets")
		if filepath.Dir(options.DefaultPath) != presetsDir {
			t.Errorf("save dialog default path = %q, want inside %q", options.DefaultPath, presetsDir)
		}
		if len(options.Filters) != 1 || !reflect.DeepEqual(options.Filters[0].Extensions, []string{"json"}) {
			t.Errorf("save dialog filters = %+v", options.Filters)
		}
		return "studio", nil
	}
	tester := ui.NewTester(a.View, 1280, 900)
	if err := tester.Click("Save Preset"); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(userData, "presets", "studio.json")
	deadline := time.Now().Add(time.Second)
	for {
		if _, err := os.Stat(path); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("saved preset %q was not created; state=%+v", path, a.State())
		}
		time.Sleep(10 * time.Millisecond)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got, err := preset.Decode(data)
	if err != nil {
		t.Fatal(err)
	}
	want := preset.Preset{SchemaVersion: 1, EngineRate: 48000, InputGainDB: -4, OutputGainDB: -6, Blocks: []preset.PresetBlock{
		{Kind: "nam", Path: modelPath, Bypassed: true, InputGainDB: 2, OutputGainDB: -1, Mix: 0.75},
	}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("saved preset = %#v, want %#v", got, want)
	}
	waitForAppState(t, a, updates, "save success to clear old error", func(state AppState) bool { return state.Message == "" })
	temps, err := filepath.Glob(filepath.Join(filepath.Dir(path), ".studio.json.tmp-*"))
	if err != nil {
		t.Fatal(err)
	}
	if len(temps) != 0 {
		t.Fatalf("atomic save left temporary files: %v", temps)
	}
}

func TestResolvePresetPathKeepsFilesInsidePresetDirectory(t *testing.T) {
	root := t.TempDir()
	presetsDir := filepath.Join(root, "presets")
	if err := os.MkdirAll(presetsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	inside, err := resolvePresetPath(presetsDir, "studio.json")
	if err != nil {
		t.Fatal(err)
	}
	resolvedDir, err := filepath.EvalSymlinks(presetsDir)
	if err != nil {
		t.Fatal(err)
	}
	if inside != filepath.Join(resolvedDir, "studio.json") {
		t.Fatalf("relative preset path = %q, want inside %q", inside, presetsDir)
	}
	outside := filepath.Join(root, "outside.json")
	if _, err := resolvePresetPath(presetsDir, outside); err == nil {
		t.Fatal("resolvePresetPath() error = nil for path outside the preset directory")
	}
	if _, err := resolvePresetPath(presetsDir, presetsDir); err == nil {
		t.Fatal("resolvePresetPath() error = nil for a directory path")
	}
	if _, err := resolvePresetPath(presetsDir, filepath.Join("..", "outside.json")); err == nil {
		t.Fatal("resolvePresetPath() error = nil for relative path outside the preset directory")
	}
	link := filepath.Join(presetsDir, "escape")
	if err := os.Symlink(root, link); err != nil {
		t.Skipf("create symlink: %v", err)
	}
	if _, err := resolvePresetPath(presetsDir, filepath.Join(link, "outside.json")); err == nil {
		t.Fatal("resolvePresetPath() error = nil for a symlinked directory outside the preset directory")
	}
}

func TestPresetFileProblemDistinguishesMissingAndNonFilePaths(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.nam")
	if message := presetFileProblem(missing); !strings.Contains(message, "File not found") {
		t.Fatalf("missing path message = %q", message)
	}
	if message := presetFileProblem(t.TempDir()); !strings.Contains(message, "Not a regular file") {
		t.Fatalf("directory path message = %q", message)
	}
}
