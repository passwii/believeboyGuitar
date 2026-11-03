package app

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

func view(c *ui.Context, a *App) {
	state := a.State()
	t := *c.Theme()
	t.Dark = false
	t.Background = ui.Hex("#F1F2EC")
	t.Surface = ui.Hex("#FBFCF8")
	t.SurfaceHover = ui.Hex("#E4E9E1")
	t.SurfacePressed = ui.Hex("#DDE3DC")
	t.Border = ui.Hex("#C9D1C8")
	t.Text = ui.Hex("#1D2520")
	t.TextMuted = ui.Hex("#5C6A61")
	t.Accent = ui.Hex("#267B55")
	t.AccentHover = ui.Hex("#2E8C62")
	t.AccentPressed = ui.Hex("#1D6344")
	t.AccentText = ui.Hex("#FFFFFF")
	t.Focus = ui.Hex("#267B55")
	c.SetTheme(&t)

	ui.Column(c).Fill().Gap(18).Padding(28).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(12).Children(func() {
			ui.Text(c, "NAM Effects").FontSize(28).Bold()
			ui.Text(c, state.Status).TextColor(t.TextMuted).FontSize(14)
			if state.Message != "" {
				ui.Text(c, state.Message).TextColor(t.Accent).FontSize(13)
			}
		})

		deviceControls(c, a, state, &t)
		gainControls(c, a, state, &t)
		chainControls(c, a, state, &t)
		meters(c, state, &t)
	})
}

func deviceControls(c *ui.Context, a *App, state AppState, theme *ui.Theme) {
	deviceLocked := state.Running || state.Starting
	inputOptions, inputValues := deviceOptions(state.Devices, true)
	outputOptions, outputValues := deviceOptions(state.Devices, false)
	inputValue := selectionForID(inputValues, state.SelectedInputID)
	outputValue := selectionForID(outputValues, state.SelectedOutputID)
	inputChannels := selectedInputChannels(state.Devices, state.SelectedInputID)
	channelOptions := make([]string, inputChannels)
	for i := range channelOptions {
		channelOptions[i] = fmt.Sprintf("Input %d", i+1)
	}
	channelValue := ""
	if state.InputChannel >= 0 && state.InputChannel < len(channelOptions) {
		channelValue = channelOptions[state.InputChannel]
	}
	channelOptions = append([]string{"Choose input channel"}, channelOptions...)
	if channelValue == "" {
		channelValue = channelOptions[0]
	}
	bufferOptions := []string{"64", "128", "256"}
	bufferValue := strconv.Itoa(state.BufferSize)
	if state.BufferSize != 64 && state.BufferSize != 128 && state.BufferSize != 256 {
		bufferValue = "128"
	}

	ui.Row(c).Gap(12).Children(func() {
		ui.Column(c).Grow(1).Gap(8).Padding(14).Background(theme.Surface).Border(1, theme.Border).Radius(10).Children(func() {
			ui.Text(c, "Input").FontSize(13).TextColor(theme.TextMuted)
			if len(inputOptions) == 0 {
				ui.Text(c, "No input device").FontSize(15).Bold()
			} else {
				if ui.Select(c, &inputValue, inputOptions).Disabled(deviceLocked).Label("Input device").Changed() {
					if id := selectedID(inputValues, inputValue); id != "" {
						a.controller.SelectInput(id)
					}
				}
			}
			if ui.Select(c, &channelValue, channelOptions).Disabled(deviceLocked).Label("Input channel").Changed() && channelValue != channelOptions[0] {
				a.controller.SelectInputChannel(indexOf(channelOptions[1:], channelValue))
			}
		})
		ui.Column(c).Grow(1).Gap(8).Padding(14).Background(theme.Surface).Border(1, theme.Border).Radius(10).Children(func() {
			ui.Text(c, "Output").FontSize(13).TextColor(theme.TextMuted)
			if len(outputOptions) == 0 {
				ui.Text(c, "No output device").FontSize(15).Bold()
			} else if ui.Select(c, &outputValue, outputOptions).Disabled(deviceLocked).Label("Output device").Changed() {
				if id := selectedID(outputValues, outputValue); id != "" {
					a.controller.SelectOutput(id)
				}
			}
			if ui.Select(c, &bufferValue, bufferOptions).Disabled(deviceLocked).Label("Buffer size").Changed() {
				if size, err := strconv.Atoi(bufferValue); err == nil {
					a.controller.SelectBufferSize(size)
				}
			}
		})
	})

	config := engine.AudioConfig{
		InputDeviceID: state.SelectedInputID, InputChannel: state.InputChannel,
		OutputDeviceID: state.SelectedOutputID, BufferSize: state.BufferSize,
	}
	startDisabled := state.SelectedInputID == "" || state.SelectedOutputID == "" || state.InputChannel < 0
	label := "Start"
	if state.Starting {
		label = "Starting..."
	} else if state.Running {
		label = "Stop"
	}
	if ui.PrimaryButton(c, label).Disabled(state.Starting || (!state.Running && (startDisabled || state.PresetLoading))).Clicked() {
		if state.Running {
			go a.controller.StopMonitoring()
		} else {
			go a.controller.StartMonitoring(config)
		}
	}
}

func gainControls(c *ui.Context, a *App, state AppState, theme *ui.Theme) {
	input := state.InputGainDB
	master := state.OutputGainDB
	ui.Row(c).Gap(20).Children(func() {
		ui.Column(c).Grow(1).Gap(6).Children(func() {
			ui.Text(c, fmt.Sprintf("Input gain  %+.1f dB", input))
			if ui.Slider(c, &input, -24, 24).Label("Input gain").Disabled(state.PresetLoading).Changed() {
				a.controller.SetInputGain(input)
			}
		})
		ui.Column(c).Grow(1).Gap(6).Children(func() {
			ui.Text(c, fmt.Sprintf("Master gain  %+.1f dB", master))
			if ui.Slider(c, &master, -24, 24).Label("Master gain").Disabled(state.PresetLoading).Changed() {
				a.controller.SetMasterGain(master)
			}
		})
	})
}

func chainControls(c *ui.Context, a *App, state AppState, theme *ui.Theme) {
	hasRecoverySlot := false
	for _, item := range state.Blocks {
		if item.Missing || item.Orphaned {
			hasRecoverySlot = true
			break
		}
	}
	ui.Column(c).Fill().Grow(1).Gap(10).Padding(16).Background(theme.Surface).Border(1, theme.Border).Radius(12).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(10).Children(func() {
			ui.Text(c, "Effects chain").FontSize(17).Bold()
			if ui.Button(c, "Open Preset").Disabled(state.PresetLoading).Clicked() {
				go a.openPresetFile()
			}
			if ui.Button(c, "Save Preset").Disabled(state.PresetLoading).Clicked() {
				go a.savePreset()
			}
			if ui.PrimaryButton(c, "Add NAM Model").Disabled(state.PresetLoading).Clicked() {
				go a.pickAndAdd([]mygo.FileFilter{{Name: "NAM models", Extensions: []string{"nam"}}})
			}
			if ui.Button(c, "Add IR").Disabled(state.PresetLoading).Clicked() {
				go a.pickAndAdd([]mygo.FileFilter{{Name: "WAV impulse responses", Extensions: []string{"wav"}}})
			}
		})
		if len(state.Blocks) == 0 {
			ui.Text(c, "Add a model or impulse response to build your signal chain.").TextColor(theme.TextMuted)
			return
		}
		a.list.Key = func(row int) any { return state.Blocks[row].Block.ID }
		a.list.Reorder = nil
		if !hasRecoverySlot && !state.PresetLoading {
			a.list.Reorder = func(rows []int, to int) {
				ids := reorderedIDs(state.Blocks, rows, to)
				go a.controller.ReorderBlocks(ids)
			}
		}
		ui.List(c, &a.list, len(state.Blocks), func(i int) {
			item := state.Blocks[i]
			block := item.Block
			ui.Column(c).Gap(8).Padding(10).Border(1, theme.Border).Radius(8).Children(func() {
				ui.Row(c).AlignItems(ui.Center).Gap(8).Children(func() {
					title := blockKindName(block) + " · " + shortPath(block.Path)
					if item.Missing {
						title = "Missing " + title
					} else if item.Orphaned {
						title = "Engine-only " + title
					}
					ui.Text(c, title).Bold().Grow(1).MinWidth(0).SingleLine()
					if ui.Button(c.Key("move-up-"+block.ID), "Move up").Shrink(0).Disabled(i == 0 || hasRecoverySlot || state.PresetLoading).Clicked() {
						a.list.Reorder([]int{i}, i-1)
					}
					if ui.Button(c.Key("move-down-"+block.ID), "Move down").Shrink(0).Disabled(i == len(state.Blocks)-1 || hasRecoverySlot || state.PresetLoading).Clicked() {
						a.list.Reorder([]int{i}, i+2)
					}
					if item.Missing {
						if ui.Button(c.Key("relink-"+block.ID), "Relink").Shrink(0).Disabled(state.PresetLoading).Clicked() {
							go a.pickAndRelink(block.ID, block.Kind)
						}
					} else if !item.Orphaned {
						bypassLabel := "Bypass"
						if block.Bypassed {
							bypassLabel = "Enable"
						}
						if ui.Button(c.Key("bypass-"+block.ID), bypassLabel).Shrink(0).Disabled(state.PresetLoading).Clicked() {
							value := 1.0
							if block.Bypassed {
								value = 0
							}
							a.controller.SetBlockParam(block.ID, "bypassed", value)
						}
					}
					if ui.Button(c.Key("remove-"+block.ID), "Remove").Shrink(0).Disabled(state.PresetLoading).Clicked() {
						go a.controller.RemoveBlock(block.ID)
					}
				})
				if item.Message != "" {
					ui.Text(c, item.Message).TextColor(ui.Hex("#B13A32")).FontSize(12)
				}
				blockSliders(c, a, block, item.Missing || item.Orphaned || state.PresetLoading)
			})
		})
	})
}

func blockSliders(c *ui.Context, a *App, block engine.Block, disabled bool) {
	inputGain := block.InputGainDB
	outputGain := block.OutputGainDB
	mix := block.Mix
	ui.Row(c).Gap(12).Children(func() {
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Input %+.1f dB", inputGain)).FontSize(12)
			if ui.Slider(c, &inputGain, -24, 24).Label("Block input gain").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "inputGainDb", inputGain)
			}
		})
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Output %+.1f dB", outputGain)).FontSize(12)
			if ui.Slider(c, &outputGain, -24, 24).Label("Block output gain").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "outputGainDb", outputGain)
			}
		})
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Mix %.0f%%", mix*100)).FontSize(12)
			if ui.Slider(c, &mix, 0, 1).Label("Block mix").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "mix", mix)
			}
		})
	})
}

func meters(c *ui.Context, state AppState, theme *ui.Theme) {
	clipping := state.InputMeterDB >= 0 || state.OutputMeterDB >= 0
	ui.Row(c).Gap(16).Children(func() {
		ui.Text(c, fmt.Sprintf("Input  %+.1f dBFS", state.InputMeterDB)).TextColor(theme.TextMuted)
		ui.Text(c, fmt.Sprintf("Output  %+.1f dBFS", state.OutputMeterDB)).TextColor(theme.TextMuted)
		if clipping {
			ui.Text(c, "Clipping").TextColor(ui.Hex("#B13A32")).Bold()
		}
	})
}

func (a *App) pickAndAdd(filters []mygo.FileFilter) {
	paths, err := a.openDialog(filters)
	if err != nil {
		a.controller.fail(err)
		return
	}
	for _, path := range paths {
		if err := a.controller.AddFile(path); err != nil {
			return
		}
	}
}

func (a *App) pickAndRelink(placeholderID, kind string) {
	extensions := []string{"wav"}
	name := "WAV impulse responses"
	if kind == "nam" {
		extensions = []string{"nam"}
		name = "NAM models"
	}
	paths, err := a.openDialog([]mygo.FileFilter{{Name: name, Extensions: extensions}})
	if err != nil {
		a.controller.fail(err)
		return
	}
	if len(paths) == 0 {
		return
	}
	_ = a.controller.RelinkBlock(placeholderID, paths[0])
}

func deviceOptions(devices []engine.Device, inputs bool) ([]string, []deviceChoice) {
	var options []string
	var values []deviceChoice
	for _, device := range devices {
		if (inputs && device.InputChannels == 0) || (!inputs && device.OutputChannels == 0) {
			continue
		}
		label := device.Name + " · " + device.ID
		options = append(options, label)
		values = append(values, deviceChoice{label: label, id: device.ID, channels: device.InputChannels})
	}
	return options, values
}

type deviceChoice struct {
	label    string
	id       string
	channels int
}

func selectionForID(values []deviceChoice, id string) string {
	for _, value := range values {
		if value.id == id {
			return value.label
		}
	}
	return ""
}

func selectedID(values []deviceChoice, label string) string {
	for _, value := range values {
		if value.label == label {
			return value.id
		}
	}
	return ""
}

func selectedInputChannels(devices []engine.Device, id string) int {
	for _, device := range devices {
		if device.ID == id {
			return device.InputChannels
		}
	}
	return 0
}

func indexOf(values []string, target string) int {
	for i, value := range values {
		if value == target {
			return i
		}
	}
	return -1
}

func reorderedIDs(blocks []BlockItem, rows []int, to int) []string {
	selected := make(map[int]bool, len(rows))
	for _, row := range rows {
		if row >= 0 && row < len(blocks) {
			selected[row] = true
		}
	}
	move := make([]string, 0, len(selected))
	remaining := make([]string, 0, len(blocks)-len(selected))
	for i, item := range blocks {
		if selected[i] {
			move = append(move, item.Block.ID)
		} else {
			remaining = append(remaining, item.Block.ID)
		}
	}
	insert := to
	for row := range selected {
		if row < to {
			insert--
		}
	}
	if insert < 0 {
		insert = 0
	}
	if insert > len(remaining) {
		insert = len(remaining)
	}
	result := append([]string(nil), remaining[:insert]...)
	result = append(result, move...)
	return append(result, remaining[insert:]...)
}

func shortPath(path string) string {
	if index := strings.LastIndexAny(path, "/\\"); index >= 0 {
		return path[index+1:]
	}
	return path
}
