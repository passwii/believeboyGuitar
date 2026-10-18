/**
 * 节拍器的浏览器音频封装：懒创建 AudioContext，按音色与重音参数合成一次点击。
 *
 * 只用 Web Audio API 合成，不加载素材（方案 §7）：
 * - 木质：带通噪声瞬态 + 三角波 1.2kHz
 * - 电子：方波 2kHz，短促衰减
 * - 机械：高通噪声 + 800Hz / 1.6kHz 两个短谐波
 *
 * 本模块不在顶层访问 `window` / `document`，静态导出构建时不会被求值；
 * 只有调用 `resume()` / `schedule()` 时才会碰 AudioContext。
 */

import { accentIndexes, type Meter } from "@/lib/metronome";

export type Timbre = "wood" | "electronic" | "mechanical";

export type TimbreOption = {
  id: Timbre;
  label: string;
  /** 界面上的听感提示 */
  hint: string;
};

/** 三种音色，顺序即界面展示顺序 */
export const TIMBRES: TimbreOption[] = [
  { id: "wood", label: "木质", hint: "木鱼般的短促敲击" },
  { id: "electronic", label: "电子", hint: "录音棚节拍器 click" },
  { id: "mechanical", label: "机械", hint: "老式机械节拍器" },
];

export const DEFAULT_TIMBRE: Timbre = "wood";

/** 弱拍相对重拍的频率系数（约降一个八度附近） */
export const WEAK_PITCH_RATIO = 0.72;
/** 弱拍相对重拍的增益（−6 dB） */
export const WEAK_GAIN_RATIO = 10 ** (-6 / 20);

type NoiseSpec = {
  /** 滤波类型：木质用带通取窄，机械用高通保留金属高频 */
  type: BiquadFilterType;
  /** 滤波器中心频率（highpass 时为截止频率） */
  center: number;
  /** 噪声瞬态时长（秒） */
  duration: number;
  /** 滤波器 Q 值 */
  q: number;
};

type TimbreSpec = {
  /** 重拍基频（Hz） */
  frequency: number;
  /** 振荡器波形 */
  type: OscillatorType;
  /** 起音时长（秒） */
  attack: number;
  /** 衰减时长（秒） */
  decay: number;
  /** 重拍峰值增益 */
  peak: number;
  /** 相对基频的谐波倍数，逐个叠加短振荡器 */
  harmonics: number[];
  /** 噪声瞬态，null 表示不加 */
  noise: NoiseSpec | null;
};

/** 音色参数，见方案 §7 */
const TIMBRE_SPECS: Record<Timbre, TimbreSpec> = {
  wood: {
    frequency: 1200,
    type: "triangle",
    attack: 0.001,
    decay: 0.045,
    peak: 0.9,
    harmonics: [],
    noise: { type: "bandpass", center: 2400, duration: 0.008, q: 1.2 },
  },
  electronic: {
    frequency: 2000,
    type: "square",
    attack: 0.001,
    decay: 0.02,
    peak: 0.7,
    harmonics: [],
    noise: null,
  },
  mechanical: {
    frequency: 800,
    type: "triangle",
    attack: 0.001,
    decay: 0.03,
    peak: 0.8,
    // 800Hz 基频 + 1.6kHz 谐波
    harmonics: [2],
    noise: { type: "highpass", center: 3000, duration: 0.005, q: 0.7 },
  },
};

/**
 * 一次已排程的点击：记录源节点与它的起播 / 结束时间（AudioContext 时钟，秒）。
 * `cancelFrom` 靠 `start` 判断哪些还没发声，`end` 用来清理已经放完的记录。
 */
type ScheduledClick = {
  source: AudioScheduledSourceNode;
  start: number;
  end: number;
};

export type MetronomeAudioOptions = {
  /** 初始音色，默认木质 */
  timbre?: Timbre;
  /** 注入 AudioContext 构造（测试用），默认取 globalThis 上的实现 */
  contextFactory?: () => AudioContext;
};

export type MetronomeAudio = {
  /** 当前音色 */
  readonly timbre: Timbre;
  /** 切换音色，立即生效且不打断节拍 */
  setTimbre(timbre: Timbre): void;
  /** AudioContext 状态；尚未创建时为 "idle" */
  readonly state: AudioContextState | "idle";
  /** 音频时钟当前时间（秒）；未创建时为 0 */
  readonly currentTime: number;
  /** 懒创建并 resume AudioContext，必须由用户手势触发（iOS Safari 要求） */
  resume(): Promise<void>;
  /** 按音色与重音参数在 time（AudioContext 时钟）排程一次点击 */
  schedule(beatIndex: number, time: number, meter: Meter): void;
  /**
   * 撤销 start 在 time 之后、尚未发声的点击（方案 §4 / §8）。
   *
   * 向前看 120ms 意味着音频时钟里总有几个还没响的点击；改拍号 / 改 BPM /
   * 切音色 / 暂停 / 结束时必须先撤掉它们，再按新参数重排，否则会听到旧参数。
   * 已经开始的点击不受影响（不能凭空抹掉正在发声的声音）。
   */
  cancelFrom(time: number): void;
  /** 挂起音频时钟（切后台 / 暂停时调用） */
  suspend(): Promise<void>;
  /** 释放 AudioContext；之后再调用 resume 会重新创建 */
  dispose(): Promise<void>;
};

function defaultContextFactory(): AudioContext {
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("当前环境不支持 Web Audio API");
  }
  return new AudioContextCtor();
}

/** 该拍是否重音 */
export function isAccentBeat(beatIndex: number, meter: Meter): boolean {
  return accentIndexes(meter).includes(beatIndex);
}

/**
 * 一次点击的合成参数：重拍用原频率与原音量，
 * 弱拍降频（×0.72）并 −6dB。导出供单测核对参数映射。
 */
export function clickParams(
  timbre: Timbre,
  accent: boolean,
): { frequency: number; peak: number; attack: number; decay: number } {
  const spec = TIMBRE_SPECS[timbre];
  const ratio = accent ? 1 : WEAK_PITCH_RATIO;
  return {
    frequency: spec.frequency * ratio,
    peak: spec.peak * (accent ? 1 : WEAK_GAIN_RATIO),
    attack: spec.attack,
    decay: spec.decay,
  };
}

export function createMetronomeAudio(
  options: MetronomeAudioOptions = {},
): MetronomeAudio {
  const contextFactory = options.contextFactory ?? defaultContextFactory;
  let timbre: Timbre = options.timbre ?? DEFAULT_TIMBRE;
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  /** 已排程但尚未结束的点击，供 cancelFrom 撤销 */
  const scheduled: ScheduledClick[] = [];

  /** 丢掉已经自然放完的记录，避免队列随播放时长无限增长 */
  function pruneScheduled(now: number): void {
    for (let index = scheduled.length - 1; index >= 0; index -= 1) {
      if (scheduled[index].end < now) scheduled.splice(index, 1);
    }
  }

  function ensureContext(): AudioContext {
    if (context) return context;
    context = contextFactory();
    noiseBuffer = null;
    return context;
  }

  /** 噪声缓冲按 context 缓存，长度覆盖最长的噪声瞬态 */
  function ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (noiseBuffer) return noiseBuffer;
    const seconds = Math.max(
      ...Object.values(TIMBRE_SPECS)
        .map((spec) => spec.noise?.duration ?? 0)
        .concat(0.01),
    );
    const frames = Math.max(1, Math.ceil(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;
    return buffer;
  }

  function scheduleOscillator(
    ctx: AudioContext,
    destination: AudioNode,
    frequency: number,
    start: number,
    params: { peak: number; attack: number; decay: number; type: OscillatorType },
  ): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = params.type;
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(params.peak, start + params.attack);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + params.attack + params.decay,
    );

    oscillator.connect(gain);
    gain.connect(destination);
    const end = start + params.attack + params.decay + 0.01;
    oscillator.start(start);
    oscillator.stop(end);
    scheduled.push({ source: oscillator, start, end });
  }

  function scheduleNoise(
    ctx: AudioContext,
    destination: AudioNode,
    spec: NoiseSpec,
    start: number,
    peak: number,
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = ensureNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.setValueAtTime(spec.center, start);
    filter.Q.setValueAtTime(spec.q, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    const end = start + spec.duration + 0.005;
    source.start(start);
    source.stop(end);
    scheduled.push({ source, start, end });
  }

  return {
    get timbre() {
      return timbre;
    },
    setTimbre(next: Timbre) {
      timbre = next;
    },
    get state() {
      return context ? context.state : "idle";
    },
    get currentTime() {
      return context ? context.currentTime : 0;
    },
    async resume() {
      const ctx = ensureContext();
      // iOS 会在来电 / 切后台后把上下文置为 interrupted，不只是 suspended
      if (ctx.state !== "running") await ctx.resume();
    },
    schedule(beatIndex: number, time: number, meter: Meter) {
      const ctx = context;
      // 未 resume 就排程是调用方的 bug：静默跳过比抛出更安全（不会打断节拍循环）
      if (!ctx) return;
      const spec = TIMBRE_SPECS[timbre];
      const params = clickParams(timbre, isAccentBeat(beatIndex, meter));
      // AudioContext 时钟只接受非负、有限的时间点
      const start = Number.isFinite(time) && time > 0 ? time : ctx.currentTime;
      pruneScheduled(ctx.currentTime);

      scheduleOscillator(ctx, ctx.destination, params.frequency, start, {
        peak: params.peak,
        attack: params.attack,
        decay: params.decay,
        type: spec.type,
      });
      for (const multiple of spec.harmonics) {
        scheduleOscillator(ctx, ctx.destination, params.frequency * multiple, start, {
          peak: params.peak * 0.5,
          attack: params.attack,
          decay: params.decay * 0.8,
          type: spec.type,
        });
      }
      if (spec.noise) {
        scheduleNoise(ctx, ctx.destination, spec.noise, start, params.peak * 0.6);
      }
    },
    cancelFrom(time: number) {
      let boundary = time;
      if (!Number.isFinite(boundary)) {
        boundary = context ? context.currentTime : 0;
      }
      const keep: ScheduledClick[] = [];
      for (const entry of scheduled) {
        if (entry.start > boundary) {
          try {
            // stop(0) 表示「立刻停」，start 已调用过，这里合法
            entry.source.stop(0);
          } catch {
            // 已经自然结束的节点忽略即可
          }
        } else {
          keep.push(entry);
        }
      }
      scheduled.length = 0;
      scheduled.push(...keep);
    },
    async suspend() {
      if (context && context.state === "running") await context.suspend();
    },
    async dispose() {
      const ctx = context;
      context = null;
      noiseBuffer = null;
      scheduled.length = 0;
      if (ctx) await ctx.close();
    },
  };
}
