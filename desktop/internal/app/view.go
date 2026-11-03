package app

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

var (
	signalIcon = ui.MustParseSVG([]byte(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M2 12h4l2.2-6 4.1 12 3.2-9 2.1 3H22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`))
	inputIcon  = ui.MustParseSVG([]byte(`<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10h4l2-5 3.2 10 2.2-7 1.6 2H18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`))
	outputIcon = ui.MustParseSVG([]byte(`<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10h5m4 0h7M7 7l3 3-3 3m4-6 3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`))
	moreIcon   = ui.MustParseSVG([]byte(`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="13" cy="8" r="1.25"/></svg>`))
)

func view(c *ui.Context, a *App) {
	state := a.State()
	width, height := c.Size()
	compact := width < 760 || height < 560
	t := themedContext(c)

	contentGap, contentPaddingX, contentPaddingY := float32(14), float32(20), float32(16)
	if compact {
		contentGap, contentPaddingX, contentPaddingY = 10, 14, 12
	}
	ui.Column(c).Fill().Children(func() {
		toolbar(c, a, state, t)
		ui.Box(c).Height(1).FillWidth().Background(t.Border)
		ui.Column(c).Grow(1).Gap(contentGap).Padding(contentPaddingY, contentPaddingX, 18, contentPaddingX).Children(func() {
			deviceControls(c, a, state, t)
			chainControls(c, a, state, t, compact)
		})
	})
}

func toolbar(c *ui.Context, a *App, state AppState, theme *ui.Theme) {
	bar := c.TitleBar()
	height := max(bar.Height, float32(44))
	statusColor := theme.TextMuted
	if state.Running {
		statusColor = theme.Success
	}
	if state.Message != "" || (state.Running && (state.InputMeterDB >= 0 || state.OutputMeterDB >= 0)) {
		statusColor = theme.Danger
	}

	ui.Row(c).Height(height).AlignItems(ui.Center).Gap(9).Padding(0, bar.Right+12, 0, bar.Left+16).DragWindow().Children(func() {
		ui.Text(c, "吉他效果器").FontSize(14).Bold().Shrink(0)
		ui.Box(c).Size(7, 7).Radius(4).Background(statusColor).Shrink(0)
		ui.Text(c, statusLabel(state)).FontSize(11).TextColor(statusColor).Shrink(0)
		ui.Text(c, "48 kHz").Font("SF Mono").FontSize(11).TextColor(theme.TextMuted).Shrink(0)
		if state.Message != "" {
			ui.Text(c, state.Message).FontSize(11).TextColor(theme.Danger).Grow(1).MinWidth(0).SingleLine()
		} else {
			ui.Box(c).Grow(1)
		}
		if ui.Button(c, "打开").Label("打开预设").Padding(5, 8).FontSize(12).Disabled(state.PresetLoading).Clicked() {
			go a.openPresetFile()
		}
		if ui.Button(c, "保存").Label("保存预设").Padding(5, 8).FontSize(12).Disabled(state.PresetLoading).Clicked() {
			go a.savePreset()
		}
		transportButton(c, a, state)
	})
}

func themedContext(c *ui.Context) *ui.Theme {
	t := *c.Theme()
	if t.Dark {
		t.Background = ui.Hex("#1C1C1E")
		t.Surface = ui.Hex("#29292D")
		t.SurfaceHover = ui.Hex("#323236")
		t.SurfacePressed = ui.Hex("#3A3A3E")
		t.Border = ui.Hex("#414145")
		t.Text = ui.Hex("#F5F5F7")
		t.TextMuted = ui.Hex("#A1A1A6")
		t.Accent = ui.Hex("#0A84FF")
		t.AccentHover = ui.Hex("#409CFF")
		t.AccentPressed = ui.Hex("#1685F7")
		t.AccentText = ui.Hex("#071827")
		t.Danger = ui.Hex("#FF453A")
		t.Warning = ui.Hex("#FF9F0A")
		t.Success = ui.Hex("#30D158")
		t.Selection = ui.RGBA(10, 132, 255, 0.3)
		t.Focus = ui.Hex("#0A84FF")
		t.Inverse = ui.Hex("#F5F5F7")
		t.InverseText = ui.Hex("#1C1C1E")
		t.Scrollbar = ui.RGBA(245, 245, 247, 0.24)
	} else {
		t.Background = ui.Hex("#F5F5F7")
		t.Surface = ui.Hex("#FFFFFF")
		t.SurfaceHover = ui.Hex("#F0F0F2")
		t.SurfacePressed = ui.Hex("#E5E5EA")
		t.Border = ui.Hex("#D1D1D6")
		t.Text = ui.Hex("#1D1D1F")
		t.TextMuted = ui.Hex("#6E6E73")
		t.Accent = ui.Hex("#0066CC")
		t.AccentHover = ui.Hex("#005AB8")
		t.AccentPressed = ui.Hex("#004E9F")
		t.AccentText = ui.Hex("#FFFFFF")
		t.Danger = ui.Hex("#D70015")
		t.Warning = ui.Hex("#C93400")
		t.Success = ui.Hex("#1E6A2B")
		t.Selection = ui.RGBA(0, 122, 255, 0.2)
		t.Focus = ui.Hex("#007AFF")
		t.Inverse = ui.Hex("#1D1D1F")
		t.InverseText = ui.Hex("#F5F5F7")
		t.Scrollbar = ui.RGBA(29, 29, 31, 0.22)
	}
	t.Radius = 8
	c.SetTheme(&t)
	return &t
}

func statusLabel(state AppState) string {
	if state.Starting {
		return "正在启动"
	}
	if !state.Running {
		return "已停止"
	}
	if state.InputMeterDB >= 0 {
		return "输入削波"
	}
	if state.OutputMeterDB >= 0 {
		return "输出削波"
	}
	return "监听中"
}

func transportButton(c *ui.Context, a *App, state AppState) {
	config := engine.AudioConfig{
		InputDeviceID: state.SelectedInputID, InputChannel: state.InputChannel,
		OutputDeviceID: state.SelectedOutputID, BufferSize: state.BufferSize,
	}
	startDisabled := state.SelectedInputID == "" || state.SelectedOutputID == "" || state.InputChannel < 0
	label := "开始监听"
	if state.Starting {
		label = "正在启动"
	} else if state.Running {
		label = "停止监听"
	}
	if ui.PrimaryButton(c, label).Label(label).Padding(5, 10).FontSize(12).Disabled(state.Starting || (!state.Running && (startDisabled || state.PresetLoading))).Clicked() {
		if state.Running {
			go a.controller.StopMonitoring()
		} else {
			go a.controller.StartMonitoring(config)
		}
	}
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
		channelOptions[i] = fmt.Sprintf("输入 %d", i+1)
	}
	channelValue := ""
	if state.InputChannel >= 0 && state.InputChannel < len(channelOptions) {
		channelValue = channelOptions[state.InputChannel]
	}
	channelOptions = append([]string{"选择输入通道"}, channelOptions...)
	if channelValue == "" {
		channelValue = channelOptions[0]
	}
	bufferValue := fmt.Sprintf("%d 样本", state.BufferSize)
	bufferOptions := []string{"64 样本", "128 样本", "256 样本"}
	if state.BufferSize != 64 && state.BufferSize != 128 && state.BufferSize != 256 {
		bufferOptions = append(bufferOptions, bufferValue)
	}

	ui.Row(c).Gap(0).Background(theme.Surface).Radius(10).Clip().Children(func() {
		routeField(c, theme, "吉他输入", func() {
			if len(inputOptions) == 0 {
				ui.Text(c, "未发现输入设备").FontSize(12).TextColor(theme.Danger).SingleLine()
			} else if ui.Select(c, &inputValue, inputOptions).Disabled(deviceLocked).Label("吉他输入设备").Changed() {
				if id := selectedID(inputValues, inputValue); id != "" {
					a.controller.SelectInput(id)
				}
			}
		})
		routeDivider(c, theme)
		routeField(c, theme, "输入通道", func() {
			if ui.Select(c, &channelValue, channelOptions).Disabled(deviceLocked).Label("输入通道").Changed() && channelValue != channelOptions[0] {
				a.controller.SelectInputChannel(indexOf(channelOptions[1:], channelValue))
			}
		})
		routeDivider(c, theme)
		routeField(c, theme, "耳机输出", func() {
			if len(outputOptions) == 0 {
				ui.Text(c, "未发现输出设备").FontSize(12).TextColor(theme.Danger).SingleLine()
			} else if ui.Select(c, &outputValue, outputOptions).Disabled(deviceLocked).Label("耳机输出设备").Changed() {
				if id := selectedID(outputValues, outputValue); id != "" {
					a.controller.SelectOutput(id)
				}
			}
		})
		routeDivider(c, theme)
		routeField(c, theme, "缓冲", func() {
			if ui.Select(c, &bufferValue, bufferOptions).Disabled(deviceLocked).Label("缓冲大小").Changed() {
				if size, ok := bufferSize(bufferValue); ok {
					a.controller.SelectBufferSize(size)
				}
			}
		})
	})
}

func routeField(c *ui.Context, theme *ui.Theme, label string, control func()) {
	ui.Column(c).Grow(1).MinWidth(0).Gap(4).Padding(8, 11).Children(func() {
		ui.Text(c, label).FontSize(11).TextColor(theme.TextMuted).SingleLine()
		control()
	})
}

func routeDivider(c *ui.Context, theme *ui.Theme) {
	ui.Box(c).Width(1).Height(34).Background(theme.Border).Shrink(0)
}

func bufferSize(label string) (int, bool) {
	fields := strings.Fields(label)
	if len(fields) == 0 {
		return 0, false
	}
	size, err := strconv.Atoi(fields[0])
	return size, err == nil
}

func chainControls(c *ui.Context, a *App, state AppState, theme *ui.Theme, compact bool) {
	headerGap := float32(8)
	cardHeight, nodeWidth, blockWidth := float32(216), float32(152), float32(224)
	if compact {
		headerGap = 6
		cardHeight, nodeWidth, blockWidth = 204, 144, 212
	}

	ui.Column(c).Grow(1).MinHeight(0).Gap(headerGap).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(8).Children(func() {
			ui.Text(c, "效果链").FontSize(15).Bold().Grow(1)
			if len(state.Blocks) > 0 {
				ui.Text(c, fmt.Sprintf("%d 个模块", len(state.Blocks))).FontSize(11).TextColor(theme.TextMuted).Shrink(0)
			}
			if ui.Button(c, "+ NAM").Label("添加 NAM 模型").Padding(5, 8).FontSize(11).Disabled(state.PresetLoading).Clicked() {
				go a.pickAndAdd([]mygo.FileFilter{{Name: "NAM 模型", Extensions: []string{"nam"}}})
			}
			if ui.Button(c, "+ IR").Label("添加箱体 IR").Padding(5, 8).FontSize(11).Disabled(state.PresetLoading).Clicked() {
				go a.pickAndAdd([]mygo.FileFilter{{Name: "WAV 箱体 IR", Extensions: []string{"wav"}}})
			}
		})
		ui.ScrollHorizontal(c).Grow(1).MinHeight(0).Gap(8).Padding(2).AlignItems(ui.Center).Children(func() {
			inputStage(c, a, state, theme, nodeWidth, cardHeight)
			signalConnector(c, theme, state.Running, 0)
			if len(state.Blocks) == 0 {
				emptyChainStage(c, theme, blockWidth, cardHeight)
			} else {
				for i, item := range state.Blocks {
					moduleCard(c, a, state, item, i, len(state.Blocks), theme, blockWidth, cardHeight)
					signalConnector(c, theme, state.Running, int64(i+1))
				}
			}
			signalConnector(c, theme, state.Running, int64(len(state.Blocks)+1))
			outputStage(c, a, state, theme, nodeWidth, cardHeight)
		})
	})
}

func emptyChainStage(c *ui.Context, theme *ui.Theme, width, height float32) {
	ui.Column(c).Width(width).Height(height).AlignItems(ui.Center).Justify(ui.Center).Gap(8).Padding(12).Background(theme.Surface).Radius(10).Children(func() {
		ui.Icon(c, signalIcon).FontSize(20).TextColor(theme.TextMuted)
		ui.Text(c, "效果链为空").FontSize(12).TextColor(theme.TextMuted)
		ui.Text(c, "添加 NAM 或 IR 模块").FontSize(10).TextColor(theme.TextMuted)
	})
}

func inputStage(c *ui.Context, a *App, state AppState, theme *ui.Theme, width, height float32) {
	inputGain := state.InputGainDB
	level := activeMeterDB(state.Running, state.InputMeterDB)
	ui.Column(c).Width(width).Height(height).Gap(8).Padding(11).Background(theme.SurfaceHover).Radius(10).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(7).Children(func() {
			ui.Icon(c, inputIcon).FontSize(16).TextColor(theme.Accent)
			ui.Text(c, "输入").FontSize(12).Bold()
		})
		ui.Text(c, "输入电平").FontSize(11).TextColor(theme.TextMuted)
		ui.Row(c).AlignItems(ui.Baseline).Gap(5).Children(func() {
			reading := ui.Text(c, fmt.Sprintf("%+.1f", level)).Font("SF Mono").FontSize(18).Bold()
			if level >= 0 {
				reading.TextColor(theme.Danger)
			}
			reading.Shrink(0)
			ui.Text(c, "dBFS").FontSize(10).TextColor(theme.TextMuted)
			if level >= 0 {
				ui.Text(c, "削波").FontSize(10).TextColor(theme.Danger).Bold()
			}
		})
		meter(c, "输入电平", level)
		ui.Box(c).Grow(1)
		ui.Row(c).AlignItems(ui.Center).Children(func() {
			ui.Text(c, "输入增益").FontSize(11).TextColor(theme.TextMuted).Grow(1)
			ui.Text(c, fmt.Sprintf("%+.1f dB", inputGain)).Font("SF Mono").FontSize(11)
		})
		if ui.Slider(c, &inputGain, -24, 24).Label("全局输入增益").Disabled(state.PresetLoading).Changed() {
			a.controller.SetInputGain(inputGain)
		}
	})
}

func outputStage(c *ui.Context, a *App, state AppState, theme *ui.Theme, width, height float32) {
	outputGain := state.OutputGainDB
	level := activeMeterDB(state.Running, state.OutputMeterDB)
	ui.Column(c).Width(width).Height(height).Gap(8).Padding(11).Background(theme.SurfaceHover).Radius(10).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(7).Children(func() {
			ui.Icon(c, outputIcon).FontSize(16).TextColor(theme.Accent)
			ui.Text(c, "输出").FontSize(12).Bold()
		})
		ui.Text(c, "输出电平").FontSize(11).TextColor(theme.TextMuted)
		ui.Row(c).AlignItems(ui.Baseline).Gap(5).Children(func() {
			reading := ui.Text(c, fmt.Sprintf("%+.1f", level)).Font("SF Mono").FontSize(18).Bold()
			if level >= 0 {
				reading.TextColor(theme.Danger)
			}
			reading.Shrink(0)
			ui.Text(c, "dBFS").FontSize(10).TextColor(theme.TextMuted)
			if level >= 0 {
				ui.Text(c, "削波").FontSize(10).TextColor(theme.Danger).Bold()
			}
		})
		meter(c, "输出电平", level)
		ui.Box(c).Grow(1)
		ui.Row(c).AlignItems(ui.Center).Children(func() {
			ui.Text(c, "主输出").FontSize(11).TextColor(theme.TextMuted).Grow(1)
			ui.Text(c, fmt.Sprintf("%+.1f dB", outputGain)).Font("SF Mono").FontSize(11)
		})
		if ui.Slider(c, &outputGain, -24, 24).Label("主输出增益").Disabled(state.PresetLoading).Changed() {
			a.controller.SetMasterGain(outputGain)
		}
	})
}

func activeMeterDB(running bool, db float64) float64 {
	if !running {
		return -120
	}
	return db
}

func meter(c *ui.Context, label string, db float64) {
	value := db
	if value < -60 {
		value = -60
	}
	if value > 0 {
		value = 0
	}
	ui.Meter(c, value, -60, 0, &ui.MeterLevels{Warning: -12, Critical: -3}).Label(label)
}

func signalConnector(c *ui.Context, theme *ui.Theme, running bool, offset int64) {
	ui.Box(c).Width(20).Height(8).Shrink(0).Label("信号路径").Draw(func(p *ui.Painter, r ui.Rect) {
		y := r.Y + r.H/2
		p.Fill(ui.Rect{X: r.X, Y: y, W: r.W, H: 1}, theme.Border, 0)
		if !running {
			return
		}
		p.AnimationFrame()
		phase := float32((p.Now().UnixNano()/1_000_000+offset*700)%2800) / 2800
		x := r.X + phase*(r.W-5)
		p.Fill(ui.Rect{X: x, Y: y - 2, W: 5, H: 5}, theme.Success, 2.5)
	})
}

func moduleCard(c *ui.Context, a *App, state AppState, item BlockItem, index, count int, theme *ui.Theme, width, height float32) {
	block := item.Block
	disabled := item.Missing || item.Orphaned || state.PresetLoading
	canReorder := !hasRecoverySlot(state.Blocks)
	ui.Column(c).Width(width).Height(height).Gap(7).Padding(11).Background(theme.Surface).Radius(10).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(7).Children(func() {
			ui.Text(c, fmt.Sprintf("%02d", index+1)).Font("SF Mono").FontSize(10).TextColor(theme.TextMuted).Shrink(0)
			ui.Text(c, blockKindName(block)).FontSize(10).TextColor(blockKindColor(block, theme)).Bold().Shrink(0)
			ui.Box(c).Grow(1)
			more := ui.ButtonBase(c).Label(shortPath(block.Path) + " 模块操作").Padding(5).Radius(7).Background(theme.SurfaceHover)
			more.Children(func() { ui.Icon(c, moreIcon).Size(14, 14) })
			more.Menu(func(m *ui.Menu) {
				if m.Item("上移").Disabled(index == 0 || !canReorder || state.PresetLoading).Chosen() {
					moveBlock(a, state.Blocks, index, index-1)
				}
				if m.Item("下移").Disabled(index == count-1 || !canReorder || state.PresetLoading).Chosen() {
					moveBlock(a, state.Blocks, index, index+2)
				}
				m.Separator()
				if item.Missing {
					if m.Item("重新定位文件").Disabled(state.PresetLoading).Chosen() {
						go a.pickAndRelink(block.ID, block.Kind)
					}
				} else if !item.Orphaned {
					label := "旁路"
					if block.Bypassed {
						label = "启用"
					}
					if m.Item(label).Disabled(state.PresetLoading).Chosen() {
						value := 1.0
						if block.Bypassed {
							value = 0
						}
						a.controller.SetBlockParam(block.ID, "bypassed", value)
					}
				}
				m.Separator()
				if m.Item("移除").Disabled(state.PresetLoading).Chosen() {
					go a.controller.RemoveBlock(block.ID)
				}
			})
		})
		ui.Text(c, shortPath(block.Path)).FontSize(13).Bold().SingleLine()
		if item.Missing {
			ui.Text(c, "文件缺失").FontSize(11).TextColor(theme.Danger)
		} else if item.Orphaned {
			ui.Text(c, "引擎残留").FontSize(11).TextColor(theme.Warning)
		} else if item.Message != "" {
			ui.Text(c, item.Message).FontSize(11).TextColor(theme.Danger).SingleLine()
		}
		ui.Box(c).Grow(1)
		blockSliders(c, a, block, disabled, theme)
	})
}

func hasRecoverySlot(blocks []BlockItem) bool {
	for _, item := range blocks {
		if item.Missing || item.Orphaned {
			return true
		}
	}
	return false
}

func moveBlock(a *App, blocks []BlockItem, index, target int) {
	ids := reorderedIDs(blocks, []int{index}, target)
	go a.controller.ReorderBlocks(ids)
}

func blockSliders(c *ui.Context, a *App, block engine.Block, disabled bool, theme *ui.Theme) {
	inputGain := block.InputGainDB
	outputGain := block.OutputGainDB
	mix := block.Mix
	ui.Row(c).Gap(7).Children(func() {
		ui.Column(c).Grow(1).MinWidth(46).Gap(4).Children(func() {
			ui.Row(c).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "入").FontSize(10).TextColor(theme.TextMuted).Grow(1)
				ui.Text(c, fmt.Sprintf("%+.1f", inputGain)).Font("SF Mono").FontSize(10)
			})
			if ui.Slider(c, &inputGain, -24, 24).Label("模块输入增益").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "inputGainDb", inputGain)
			}
		})
		ui.Column(c).Grow(1).MinWidth(46).Gap(4).Children(func() {
			ui.Row(c).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "出").FontSize(10).TextColor(theme.TextMuted).Grow(1)
				ui.Text(c, fmt.Sprintf("%+.1f", outputGain)).Font("SF Mono").FontSize(10)
			})
			if ui.Slider(c, &outputGain, -24, 24).Label("模块输出增益").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "outputGainDb", outputGain)
			}
		})
		ui.Column(c).Grow(1).MinWidth(46).Gap(4).Children(func() {
			ui.Row(c).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "混").FontSize(10).TextColor(theme.TextMuted).Grow(1)
				ui.Text(c, fmt.Sprintf("%.0f%%", mix*100)).Font("SF Mono").FontSize(10)
			})
			if ui.Slider(c, &mix, 0, 1).Label("模块混合比例").Disabled(disabled).Changed() {
				a.controller.SetBlockParam(block.ID, "mix", mix)
			}
		})
	})
}

func blockKindColor(block engine.Block, theme *ui.Theme) ui.Color {
	switch block.Kind {
	case "nam":
		if theme.Dark {
			return ui.Hex("#E4AD70")
		}
		return ui.Hex("#835015")
	case "ir":
		if theme.Dark {
			return ui.Hex("#75B8C0")
		}
		return ui.Hex("#286B73")
	default:
		return theme.TextMuted
	}
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
	name := "WAV 箱体 IR"
	if kind == "nam" {
		extensions = []string{"nam"}
		name = "NAM 模型"
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
	counts := make(map[string]int, len(devices))
	for _, device := range devices {
		if (inputs && device.InputChannels > 0) || (!inputs && device.OutputChannels > 0) {
			counts[device.Name]++
		}
	}
	var options []string
	var values []deviceChoice
	for _, device := range devices {
		if (inputs && device.InputChannels == 0) || (!inputs && device.OutputChannels == 0) {
			continue
		}
		label := device.Name
		if counts[device.Name] > 1 {
			label += " · " + device.ID
		}
		options = append(options, label)
		values = append(values, deviceChoice{label: label, id: device.ID})
	}
	return options, values
}

type deviceChoice struct {
	label string
	id    string
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
