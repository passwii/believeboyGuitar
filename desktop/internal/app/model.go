package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/damonrock/guitar-desktop/internal/preset"
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

type BlockItem struct {
	Block    engine.Block
	Missing  bool
	Orphaned bool
	Message  string
}

type AppState struct {
	Running          bool
	Starting         bool
	PresetLoading    bool
	Status           string
	Message          string
	Devices          []engine.Device
	SelectedInputID  string
	InputChannel     int
	SelectedOutputID string
	BufferSize       int
	InputGainDB      float64
	OutputGainDB     float64
	Blocks           []BlockItem
	InputMeterDB     float64
	OutputMeterDB    float64
}

type App struct {
	controller       *Controller
	list             ui.ListState
	window           *mygo.Window
	openDialog       func([]mygo.FileFilter) ([]string, error)
	saveDialog       func(mygo.SaveDialogOptions) (string, error)
	openPresetDialog func(mygo.OpenDialogOptions) ([]string, error)
	dataDir          func() (string, error)
}

func New(engine engine.Engine) *App {
	a := &App{}
	a.openDialog = func(filters []mygo.FileFilter) ([]string, error) {
		return mygo.Dialog.Open(mygo.OpenDialogOptions{Parent: a.window, Title: "Add audio file", Filters: filters})
	}
	a.saveDialog = mygo.Dialog.Save
	a.openPresetDialog = mygo.Dialog.Open
	a.dataDir = func() (string, error) {
		return mygo.App.Path(mygo.PathUserData)
	}
	a.controller = NewController(engine)
	return a
}

func (a *App) SetWindow(window *mygo.Window) {
	a.window = window
	a.controller.SetUpdateOnMain(window.Update)
}

func (a *App) View(c *ui.Context) {
	view(c, a)
}

func (a *App) State() AppState { return a.controller.State() }

func (a *App) StartPolling(done <-chan struct{}) {
	go func() {
		a.controller.RefreshDevices()
		ticker := time.NewTicker(33 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				a.controller.RefreshSnapshot()
			}
		}
	}()
}

func (a *App) savePreset() {
	saved, err := a.controller.CurrentPreset()
	if err != nil {
		a.controller.fail(err)
		return
	}
	presetsDir, err := a.presetsDir()
	if err != nil {
		a.controller.fail(err)
		return
	}
	path, err := a.saveDialog(mygo.SaveDialogOptions{
		Parent:      a.window,
		Title:       "Save preset",
		DefaultPath: filepath.Join(presetsDir, "preset.json"),
		Filters:     presetFilters(),
	})
	if err != nil {
		a.controller.fail(err)
		return
	}
	if path == "" {
		return
	}
	path, err = resolvePresetPath(presetsDir, path)
	if err != nil {
		a.controller.fail(err)
		return
	}
	if !strings.EqualFold(filepath.Ext(path), ".json") {
		path += ".json"
	}
	if err := writePresetFile(path, saved); err != nil {
		a.controller.fail(err)
		return
	}
	a.controller.clearOperationError()
}

func (a *App) openPresetFile() {
	presetsDir, err := a.presetsDir()
	if err != nil {
		a.controller.fail(err)
		return
	}
	paths, err := a.openPresetDialog(mygo.OpenDialogOptions{
		Parent:      a.window,
		Title:       "Open preset",
		DefaultPath: presetsDir,
		Filters:     presetFilters(),
	})
	if err != nil {
		a.controller.fail(err)
		return
	}
	if len(paths) == 0 {
		return
	}
	data, err := os.ReadFile(paths[0])
	if err != nil {
		a.controller.fail(err)
		return
	}
	saved, err := preset.Decode(data)
	if err != nil {
		a.controller.fail(err)
		return
	}
	if err := a.controller.LoadPreset(saved); err != nil {
		return
	}
}

func (a *App) presetsDir() (string, error) {
	root, err := a.dataDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(root, "presets")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func presetFilters() []mygo.FileFilter {
	return []mygo.FileFilter{{Name: "Presets", Extensions: []string{"json"}}}
}

func resolvePresetPath(presetsDir, path string) (string, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(presetsDir, path)
	}
	dir, err := filepath.EvalSymlinks(presetsDir)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(resolved))
	if err != nil || parent != dir || filepath.Base(resolved) == "." || filepath.Base(resolved) == ".." {
		return "", fmt.Errorf("presets must be saved under %s", dir)
	}
	return filepath.Join(dir, filepath.Base(resolved)), nil
}

func writePresetFile(path string, saved preset.Preset) error {
	data := preset.Encode(saved)
	if data == nil {
		return fmt.Errorf("preset contains invalid parameters")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	cleanup := func() {
		_ = temp.Close()
		_ = os.Remove(tempPath)
	}
	if err := temp.Chmod(0o600); err != nil {
		cleanup()
		return err
	}
	if _, err := temp.Write(data); err != nil {
		cleanup()
		return err
	}
	if err := temp.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := temp.Close(); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	return nil
}
