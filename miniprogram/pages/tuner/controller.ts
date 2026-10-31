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

const MIN_RMS = 10 ** (-50 / 20);
const STABLE_DURATION_MS = 200;
const MAX_HISTORY = 5;

export type TunerState = "idle" | "starting" | "listening" | "error";
export type TunerMode = "auto" | "manual";

export type TunerControllerState = {
  preset: TuningPreset;
  presetIndex: number;
  chromatic: boolean;
  mode: TunerMode;
  manualStringId: StringId | "";
  state: TunerState;
  statusText: string;
  noteText: string;
  cents: number;
  directionText: string;
  stable: boolean;
  listening: boolean;
  permissionDenied: boolean;
};

function initialState(): TunerControllerState {
  return {
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
  };
}

export class TunerController {
  private current = initialState();
  private readonly detector = new PitchDetector({
    minFrequency: 55,
    maxFrequency: 400,
  });
  private history: number[] = [];
  private stableSince: number | null = null;

  getState(): TunerControllerState {
    return { ...this.current };
  }

  reset(): TunerControllerState {
    this.current = initialState();
    this.clearSmoothing();
    return this.getState();
  }

  start(): TunerControllerState {
    this.clearSmoothing();
    this.current = {
      ...this.current,
      state: "starting",
      statusText: "正在请求麦克风权限",
      stable: false,
      listening: false,
      permissionDenied: false,
    };
    return this.getState();
  }

  setPermissionResult(granted: boolean): TunerControllerState {
    if (!granted) {
      this.current = {
        ...this.current,
        state: "idle",
        statusText: "需要麦克风权限才能调音",
        listening: false,
        permissionDenied: true,
      };
      return this.getState();
    }
    this.current = {
      ...this.current,
      statusText: "正在启动录音",
      permissionDenied: false,
    };
    return this.getState();
  }

  permissionSettingsUpdated(granted: boolean): TunerControllerState {
    if (granted && this.current.state === "idle") {
      this.current = {
        ...this.current,
        statusText: "麦克风已允许，点击开始调音",
        permissionDenied: false,
      };
    }
    return this.getState();
  }

  recorderStarted(): TunerControllerState {
    this.current = {
      ...this.current,
      state: "listening",
      statusText: "正在聆听",
      listening: true,
    };
    return this.getState();
  }

  recorderFailed(message = "录音启动失败，请检查麦克风后重试"):
    TunerControllerState {
    this.clearSmoothing();
    this.current = {
      ...this.current,
      state: "error",
      statusText: message,
      listening: false,
      stable: false,
    };
    return this.getState();
  }

  stop(): TunerControllerState {
    this.clearSmoothing();
    this.current = {
      ...this.current,
      state: "idle",
      statusText: "准备调音",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
      listening: false,
      permissionDenied: false,
    };
    return this.getState();
  }

  handleFrame(
    samples: Float32Array,
    sampleRate: number,
    now = Date.now(),
  ): TunerControllerState {
    if (rms(samples) < MIN_RMS) {
      return this.invalidateReading("声音太小");
    }
    const reading = this.detector.detect(samples, sampleRate);
    if (!reading) return this.invalidateReading("信号不稳定");
    return this.acceptFrequency(reading.frequency, now);
  }

  acceptFrequency(frequency: number, now = Date.now()): TunerControllerState {
    if (!Number.isFinite(frequency) || frequency <= 0) {
      return this.invalidateReading("信号不稳定");
    }
    this.history.push(frequency);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    const sorted = [...this.history].sort((left, right) => left - right);
    const smoothedFrequency = sorted[Math.floor(sorted.length / 2)];
    const { noteText, cents } = this.resolveNote(smoothedFrequency);
    const inTune = Math.abs(cents) <= 3;
    if (inTune) this.stableSince ??= now;
    else this.stableSince = null;
    const stable =
      inTune && this.stableSince !== null && now - this.stableSince >= STABLE_DURATION_MS;
    const direction = describeCents(cents);
    const directionText = direction === "in-tune"
      ? stable ? "准" : "稳定中"
      : direction === "flat" ? "偏低" : "偏高";

    this.current = {
      ...this.current,
      noteText,
      cents: Math.round(cents),
      directionText,
      stable,
      statusText: stable
        ? "音高已稳定"
        : inTune
          ? "保持音高以确认调准"
          : "正在识别音高",
    };
    return this.getState();
  }

  cyclePreset(): TunerControllerState {
    const presetIndex = (this.current.presetIndex + 1) % TUNING_PRESETS.length;
    const preset = TUNING_PRESETS[presetIndex];
    this.clearSmoothing();
    this.current = {
      ...this.current,
      preset,
      presetIndex,
      chromatic: preset.id === "chromatic",
      mode: "auto",
      manualStringId: "",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
    };
    return this.getState();
  }

  resetMode(): TunerControllerState {
    this.stableSince = null;
    this.current = {
      ...this.current,
      mode: "auto",
      manualStringId: "",
      stable: false,
    };
    return this.getState();
  }

  selectString(id: StringId): TunerControllerState {
    if (this.current.chromatic) return this.getState();
    if (!this.current.preset.strings.some((string) => string.id === id)) {
      return this.getState();
    }
    this.stableSince = null;
    this.current = {
      ...this.current,
      mode: "manual",
      manualStringId: id,
      stable: false,
    };
    return this.getState();
  }

  private resolveNote(frequency: number): { noteText: string; cents: number } {
    if (this.current.chromatic) {
      const note = noteAtFrequency(frequency);
      return { noteText: `${note.name}${note.octave}`, cents: note.cents };
    }
    const target = this.current.mode === "manual"
      ? this.current.preset.strings.find(
          (string) => string.id === this.current.manualStringId,
        )
      : undefined;
    const reading = target
      ? { target, cents: centsBetween(frequency, target.frequency) }
      : nearestString(frequency, this.current.preset.strings);
    return { noteText: reading.target.label, cents: reading.cents };
  }

  private invalidateReading(statusText: string): TunerControllerState {
    this.clearSmoothing();
    this.current = {
      ...this.current,
      statusText,
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
    };
    return this.getState();
  }

  private clearSmoothing(): void {
    this.history = [];
    this.stableSince = null;
  }
}

export function createTunerController(): TunerController {
  return new TunerController();
}
