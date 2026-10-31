import {
  PitchDetector,
  TUNING_PRESETS,
  centsBetween,
  describeCents,
  nearestString,
  noteAtFrequency,
  rms,
  type StringId,
  type TuningPreset,
} from "../../generated/guitar-core";
import { createRecorderPcm } from "../../adapters/recorder-pcm";

const MIN_RMS = 10 ** (-50 / 20);
const STABLE_DURATION_MS = 200;
const MAX_HISTORY = 5;

type TunerState = "idle" | "starting" | "listening" | "error";

const runtime = {
  recorder: null as ReturnType<typeof createRecorderPcm> | null,
  detector: new PitchDetector({ minFrequency: 55, maxFrequency: 400 }),
  history: [] as number[],
  stableSince: null as number | null,
  generation: 0,
};

function medianFrequency(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function requestRecordPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    wx.getSetting({
      success: (settings) => {
        if (settings.authSetting["scope.record"] === true) {
          resolve(true);
          return;
        }
        wx.authorize({
          scope: "scope.record",
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

function resetSmoothing(): void {
  runtime.history = [];
  runtime.stableSince = null;
}

Page({
  data: {
    preset: TUNING_PRESETS[0] as TuningPreset,
    presetIndex: 0,
    chromatic: false,
    mode: "auto" as "auto" | "manual",
    manualStringId: "" as StringId | "",
    state: "idle" as TunerState,
    statusText: "准备调音",
    noteText: "—",
    cents: 0,
    directionText: "等待声音",
    stable: false,
    listening: false,
    permissionDenied: false,
  },

  onLoad() {
    runtime.generation += 1;
    runtime.detector = new PitchDetector({ minFrequency: 55, maxFrequency: 400 });
    resetSmoothing();
    this.setData({
      preset: TUNING_PRESETS[0],
      presetIndex: 0,
      chromatic: false,
      mode: "auto",
      manualStringId: "",
      state: "idle",
      statusText: "准备调音",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
      listening: false,
      permissionDenied: false,
    });
  },

  onHide() {
    this.stopTuning();
  },

  onUnload() {
    this.stopTuning();
  },

  toggleTuning() {
    if (this.data.listening || this.data.state === "starting") {
      this.stopTuning();
      return;
    }
    void this.startTuning();
  },

  async startTuning() {
    if (this.data.listening || this.data.state === "starting") return;
    const generation = ++runtime.generation;
    resetSmoothing();
    this.setData({
      state: "starting",
      statusText: "正在请求麦克风权限",
      listening: false,
      stable: false,
      permissionDenied: false,
    });

    const permitted = await requestRecordPermission();
    if (generation !== runtime.generation) return;
    if (!permitted) {
      this.setData({
        state: "idle",
        statusText: "需要麦克风权限才能调音",
        permissionDenied: true,
      });
      wx.showModal({
        title: "需要麦克风权限",
        content: "请在设置中允许使用麦克风，再回来开始调音。",
        confirmText: "去设置",
        success: (result) => {
          if (result.confirm && generation === runtime.generation) this.openSettings();
        },
      });
      return;
    }

    let recorder: ReturnType<typeof createRecorderPcm> | null = null;
    recorder = createRecorderPcm({
      frameSize: 8,
      onFrame: (samples, sampleRate) => this.onFrame(samples, sampleRate),
      onError: () => {
        if (generation !== runtime.generation) return;
        if (runtime.recorder === recorder) runtime.recorder = null;
        recorder?.dispose();
        this.setData({
          state: "error",
          statusText: "录音启动失败，请检查麦克风后重试",
          listening: false,
          stable: false,
        });
        resetSmoothing();
      },
      onState: (state) => {
        if (generation !== runtime.generation) return;
        if (state === "listening") {
          this.setData({
            state: "listening",
            statusText: "正在聆听",
            listening: true,
          });
        } else if (state === "stopped" && this.data.state === "starting") {
          this.setData({
            state: "error",
            statusText: "录音启动失败，请重试",
            listening: false,
          });
        }
      },
    });
    runtime.recorder = recorder;

    try {
      await recorder.start();
      if (generation !== runtime.generation) recorder.dispose();
    } catch {
      if (generation !== runtime.generation) return;
      recorder.dispose();
      runtime.recorder = null;
      this.setData({
        state: "error",
        statusText: "录音启动失败，请检查麦克风后重试",
        listening: false,
      });
    }
  },

  openSettings() {
    wx.openSetting({
      success: (settings) => {
        if (settings.authSetting["scope.record"] === true) {
          this.setData({
            permissionDenied: false,
            statusText: "麦克风已允许，点击开始调音",
          });
        }
      },
    });
  },

  onFrame(samples: Float32Array, sampleRate: number) {
    if (rms(samples) < MIN_RMS) {
      resetSmoothing();
      this.setData({
        statusText: "声音太小",
        directionText: "等待声音",
        stable: false,
      });
      return;
    }

    const reading = runtime.detector.detect(samples, sampleRate);
    if (!reading) {
      resetSmoothing();
      this.setData({
        statusText: "信号不稳定",
        directionText: "等待稳定音",
        stable: false,
      });
      return;
    }

    runtime.history.push(reading.frequency);
    if (runtime.history.length > MAX_HISTORY) runtime.history.shift();
    const frequency = medianFrequency(runtime.history);
    let noteText: string;
    let cents: number;

    if (this.data.chromatic) {
      const note = noteAtFrequency(frequency);
      noteText = `${note.name}${note.octave}`;
      cents = note.cents;
    } else {
      const target = this.data.mode === "manual"
        ? this.data.preset.strings.find((string) => string.id === this.data.manualStringId)
        : undefined;
      const stringReading = target
        ? { target, cents: centsBetween(frequency, target.frequency) }
        : nearestString(frequency, this.data.preset.strings);
      noteText = stringReading.target.label;
      cents = stringReading.cents;
    }

    const inTune = Math.abs(cents) <= 3;
    const now = Date.now();
    if (inTune) runtime.stableSince ??= now;
    else runtime.stableSince = null;
    const stable = inTune && runtime.stableSince !== null && now - runtime.stableSince >= STABLE_DURATION_MS;
    const direction = describeCents(cents);
    const directionText = direction === "in-tune"
      ? stable ? "准" : "稳定中"
      : direction === "flat" ? "偏低" : "偏高";

    this.setData({
      noteText,
      cents: Math.round(cents),
      directionText,
      stable,
      statusText: stable ? "音高已稳定" : inTune ? "保持音高以确认调准" : "正在识别音高",
    });
  },

  stopTuning() {
    runtime.generation += 1;
    runtime.recorder?.dispose();
    runtime.recorder = null;
    resetSmoothing();
    this.setData({
      state: "idle",
      statusText: "准备调音",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
      listening: false,
      permissionDenied: false,
    });
  },

  cyclePreset() {
    const presetIndex = (this.data.presetIndex + 1) % TUNING_PRESETS.length;
    const preset = TUNING_PRESETS[presetIndex];
    const chromatic = preset.id === "chromatic";
    this.setData({
      preset,
      presetIndex,
      chromatic,
      mode: "auto",
      manualStringId: "",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
    });
    resetSmoothing();
  },

  resetMode() {
    this.setData({ mode: "auto", manualStringId: "", stable: false });
    runtime.stableSince = null;
  },

  selectString(event: WechatMiniprogram.TouchEvent) {
    const manualStringId = String(event.currentTarget.dataset.id) as StringId;
    this.setData({ mode: "manual", manualStringId, stable: false });
    runtime.stableSince = null;
  },
});
