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
	width, height := c.Size()
	compact := width < 760 || height < 560
	t := *c.Theme()
	t.Dark = true
	t.Background = ui.Hex("#171B1A")
	t.Surface = ui.Hex("#202624")
	t.SurfaceHover = ui.Hex("#29312D")
	t.SurfacePressed = ui.Hex("#343D39")
	t.Border = ui.Hex("#39433D")
	t.Text = ui.Hex("#ECEFE9")
	t.TextMuted = ui.Hex("#A2ADA5")
	t.Accent = ui.Hex("#69D293")
	t.AccentHover = ui.Hex("#7BE0A1")
	t.AccentPressed = ui.Hex("#50B97A")
	t.AccentText = ui.Hex("#142019")
	t.Danger = ui.Hex("#FF786F")
	t.Warning = ui.Hex("#E5B65C")
	t.Success = ui.Hex("#69D293")
	t.Selection = ui.RGBA(105, 210, 147, 0.25)
	t.Focus = ui.Hex("#69D293")
	t.Inverse = ui.Hex("#ECEFE9")
	t.InverseText = ui.Hex("#171B1A")
	t.Scrollbar = ui.RGBA(236, 239, 233, 0.28)
	t.Radius = 8
	c.SetTheme(&t)

	rootGap, rootPadding, titleSize := float32(12), float32(20), float32(24)
	if compact {
		rootGap, rootPadding, titleSize = 8, 12, 20
	}
	ui.Column(c).Fill().Gap(rootGap).Padding(rootPadding).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(12).Children(func() {
			ui.Text(c, "NAM Effects").FontSize(titleSize).Bold()
			ui.Text(c, state.Status).TextColor(t.TextMuted).FontSize(13)
			if state.Message != "" {
				ui.Text(c, state.Message).TextColor(t.Danger).FontSize(12).Grow(1).MinWidth(0).SingleLine()
			}
			if ui.Button(c, "Open Preset").Disabled(state.PresetLoading).Clicked() {
				go a.openPresetFile()
			}
			if ui.Button(c, "Save Preset").Disabled(state.PresetLoading).Clicked() {
				go a.savePreset()
			}
			transportButton(c, a, state)
		})

		deviceControls(c, a, state, &t, compact)
		gainControls(c, a, state, &t, compact)
		chainControls(c, a, state, &t, compact)
		meters(c, state, &t, compact)
	})
}

func transportButton(c *ui.Context, a *App, state AppState) {
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

func deviceControls(c *ui.Context, a *App, state AppState, theme *ui.Theme, compact bool) {
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

	cardPadding, cardGap, cardLabelSize := float32(12), float32(7), float32(11)
	if compact {
		cardPadding, cardGap, cardLabelSize = 8, 5, 9
	}
	ui.Row(c).Gap(10).Children(func() {
		ui.Column(c).Grow(1).Gap(cardGap).Padding(cardPadding).Background(theme.Surface).Border(1, theme.Border).Radius(10).Children(func() {
			ui.Text(c, "INPUT ROUTING").FontSize(cardLabelSize).TextColor(theme.TextMuted).Bold()
			if len(inputOptions) == 0 {
				ui.Text(c, "No input device").FontSize(14).Bold()
			} else if ui.Select(c, &inputValue, inputOptions).Disabled(deviceLocked).Label("Input device").Changed() {
				if id := selectedID(inputValues, inputValue); id != "" {
					a.controller.SelectInput(id)
				}
			}
			if ui.Select(c, &channelValue, channelOptions).Disabled(deviceLocked).Label("Input channel").Changed() && channelValue != channelOptions[0] {
				a.controller.SelectInputChannel(indexOf(channelOptions[1:], channelValue))
			}
		})
		ui.Column(c).Grow(1).Gap(cardGap).Padding(cardPadding).Background(theme.Surface).Border(1, theme.Border).Radius(10).Children(func() {
			ui.Text(c, "OUTPUT ROUTING").FontSize(cardLabelSize).TextColor(theme.TextMuted).Bold()
			if len(outputOptions) == 0 {
				ui.Text(c, "No output device").FontSize(14).Bold()
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
}

func gainControls(c *ui.Context, a *App, state AppState, theme *ui.Theme, compact bool) {
	input := state.InputGainDB
	master := state.OutputGainDB
	paddingY, paddingX, gap, headingSize, valueSize := float32(10), float32(12), float32(18), float32(11), float32(12)
	if compact {
		paddingY, paddingX, gap, headingSize, valueSize = 6, 8, 8, 9, 10
	}
	ui.Row(c).AlignItems(ui.Center).Gap(gap).Padding(paddingY, paddingX).Background(theme.Surface).Border(1, theme.Border).Radius(10).Children(func() {
		ui.Text(c, "GLOBAL GAIN").FontSize(headingSize).TextColor(theme.TextMuted).Bold().Shrink(0)
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Input  %+.1f dB", input)).FontSize(valueSize)
			if ui.Slider(c, &input, -24, 24).Label("Input gain").Disabled(state.PresetLoading).Changed() {
				a.controller.SetInputGain(input)
			}
		})
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Master  %+.1f dB", master)).FontSize(valueSize)
			if ui.Slider(c, &master, -24, 24).Label("Master gain").Disabled(state.PresetLoading).Changed() {
				a.controller.SetMasterGain(master)
			}
		})
	})
}

func chainControls(c *ui.Context, a *App, state AppState, theme *ui.Theme, compact bool) {
	hasRecoverySlot := false
	for _, item := range state.Blocks {
		if item.Missing || item.Orphaned {
			hasRecoverySlot = true
			break
		}
	}
	chainPadding, chainGap, blockPadding, blockGap := float32(14), float32(10), float32(10), float32(8)
	if compact {
		chainPadding, chainGap, blockPadding, blockGap = 9, 7, 6, 4
	}
	ui.Column(c).Fill().Grow(1).Gap(chainGap).Padding(chainPadding).Background(theme.Surface).Border(1, theme.Border).Radius(12).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(9).Children(func() {
			ui.Text(c, "Signal chain").FontSize(17).Bold().Grow(1)
			ui.Text(c, fmt.Sprintf("%d MODULES", len(state.Blocks))).FontSize(10).TextColor(theme.TextMuted)
			if ui.Button(c, "Add NAM Model").Disabled(state.PresetLoading).Clicked() {
				go a.pickAndAdd([]mygo.FileFilter{{Name: "NAM models", Extensions: []string{"nam"}}})
			}
			if ui.Button(c, "Add IR").Disabled(state.PresetLoading).Clicked() {
				go a.pickAndAdd([]mygo.FileFilter{{Name: "WAV impulse responses", Extensions: []string{"wav"}}})
			}
		})
		if len(state.Blocks) == 0 {
			ui.Text(c, "Add a NAM model or cabinet IR to build the signal chain.").TextColor(theme.TextMuted)
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
			ui.Column(c).Gap(blockGap).Padding(blockPadding).Background(ui.Hex("#191F1D")).Border(1, theme.Border).Radius(9).Children(func() {
				ui.Row(c).AlignItems(ui.Center).Gap(7).Children(func() {
					ui.Text(c, fmt.Sprintf("%02d", i+1)).FontSize(11).TextColor(theme.TextMuted).Shrink(0)
					if item.Missing {
						ui.Text(c, "Missing").FontSize(11).TextColor(theme.Danger).Bold().Shrink(0)
					} else if item.Orphaned {
						ui.Text(c, "Engine-only").FontSize(11).TextColor(theme.Warning).Bold().Shrink(0)
					}
					ui.Text(c, blockKindName(block)).TextColor(blockKindColor(block)).Bold().Shrink(0)
					ui.Text(c, "·").TextColor(theme.TextMuted).Shrink(0)
					ui.Text(c, shortPath(block.Path)).Bold().Grow(1).MinWidth(0).SingleLine()
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
					ui.Text(c, item.Message).TextColor(theme.Danger).FontSize(12)
				}
				blockSliders(c, a, block, item.Missing || item.Orphaned || state.PresetLoading, compact)
			})
		}).Grow(1).Gap(8)
	})
}

func blockSliders(c *ui.Context, a *App, block engine.Block, disabled, compact bool) {
	inputGain := block.InputGainDB
	outputGain := block.OutputGainDB
	mix := block.Mix
	gap, labelSize := float32(12), float32(12)
	if compact {
		gap, labelSize = 7, 10
	}
	ui.Row(c).Gap(gap).Children(func() {
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Input %+.1f dB", inputGain)).FontSize(labelSize).TextColor(c.Theme().TextMuted)
			if ui.Slider(c, &inputGain, -24, 24).Label("Block input gain").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "inputGainDb", inputGain)
			}
		})
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Output %+.1f dB", outputGain)).FontSize(labelSize).TextColor(c.Theme().TextMuted)
			if ui.Slider(c, &outputGain, -24, 24).Label("Block output gain").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "outputGainDb", outputGain)
			}
		})
		ui.Column(c).Grow(1).Gap(3).Children(func() {
			ui.Text(c, fmt.Sprintf("Mix %.0f%%", mix*100)).FontSize(labelSize).TextColor(c.Theme().TextMuted)
			if ui.Slider(c, &mix, 0, 1).Label("Block mix").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "mix", mix)
			}
		})
	})
}

func blockKindColor(block engine.Block) ui.Color {
	switch block.Kind {
	case "nam":
		return ui.Hex("#E5B65C")
	case "ir":
		return ui.Hex("#75C9D6")
	default:
		return ui.Hex("#ECEFE9")
	}
}

func meters(c *ui.Context, state AppState, theme *ui.Theme, compact bool) {
	clipping := state.InputMeterDB >= 0 || state.OutputMeterDB >= 0
	levels := &ui.MeterLevels{Warning: -12, Critical: -3}
	paddingY, paddingX, gap := float32(11), float32(13), float32(16)
	if compact {
		paddingY, paddingX, gap = 6, 8, 8
	}
	ui.Row(c).Gap(gap).Padding(paddingY, paddingX).Background(theme.Surface).Border(1, theme.Border).Radius(10).Children(func() {
		level(c, "Input level", state.InputMeterDB, levels, theme, compact)
		level(c, "Output level", state.OutputMeterDB, levels, theme, compact)
		if clipping {
			ui.Text(c, "CLIPPING").TextColor(theme.Danger).Bold().Shrink(0)
		}
	})
}

func level(c *ui.Context, label string, db float64, levels *ui.MeterLevels, theme *ui.Theme, compact bool) {
	gap, labelSize, valueSize := float32(5), float32(11), float32(12)
	if compact {
		gap, labelSize, valueSize = 3, 9, 10
	}
	ui.Column(c).Grow(1).Gap(gap).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Children(func() {
			ui.Text(c, label).FontSize(labelSize).TextColor(theme.TextMuted)
			ui.Text(c, fmt.Sprintf("%+.1f dBFS", db)).FontSize(valueSize).TextColor(theme.Text).Grow(1).TextAlign(ui.End)
		})
		value := db
		if value < -60 {
			value = -60
		}
		ui.Meter(c, value, -60, 0, levels).Label(label)
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
