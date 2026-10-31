import {
  accentIndexes,
  type Meter,
} from "../generated/guitar-core/metronome";

export type Timbre = "wood" | "electronic" | "mechanical";

export const TIMBRES = [
  { id: "wood", label: "木质" },
  { id: "electronic", label: "电子" },
  { id: "mechanical", label: "机械" },
] as const;

type NoiseSpec = {
  type: BiquadFilterType;
  center: number;
  duration: number;
  q: number;
};

type TimbreSpec = {
  frequency: number;
  type: OscillatorType;
  attack: number;
  decay: number;
  peak: number;
  harmonics: number[];
  noise: NoiseSpec | null;
};

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
    harmonics: [2],
    noise: { type: "highpass", center: 3000, duration: 0.005, q: 0.7 },
  },
};

type ScheduledClick = {
  source: OscillatorNode | WechatMiniprogram.BufferSourceNode;
  start: number;
  end: number;
};

function defaultContextFactory(): WechatMiniprogram.WebAudioContext {
  return wx.createWebAudioContext();
}

function isAccentBeat(beatIndex: number, meter: Meter): boolean {
  return accentIndexes(meter).includes(beatIndex);
}

function clickParams(
  timbre: Timbre,
  accent: boolean,
): { frequency: number; peak: number; attack: number; decay: number } {
  const spec = TIMBRE_SPECS[timbre];
  const pitchRatio = accent ? 1 : 0.72;
  const gainRatio = accent ? 1 : 10 ** (-6 / 20);
  return {
    frequency: spec.frequency * pitchRatio,
    peak: spec.peak * gainRatio,
    attack: spec.attack,
    decay: spec.decay,
  };
}

export function createMetronomeAudio(options: {
  timbre?: Timbre;
  contextFactory?: () => WechatMiniprogram.WebAudioContext;
} = {}): {
  readonly timbre: Timbre;
  readonly state: string;
  readonly currentTime: number;
  setTimbre(next: Timbre): void;
  resume(): Promise<void>;
  schedule(beatIndex: number, time: number, meter: Meter): void;
  cancelFrom(time: number): void;
  suspend(): Promise<void>;
  dispose(): Promise<void>;
} {
  const contextFactory = options.contextFactory ?? defaultContextFactory;
  let timbre = options.timbre ?? "wood";
  let context: WechatMiniprogram.WebAudioContext | null = null;
  let noiseBuffer: WechatMiniprogram.AudioBuffer | null = null;
  const scheduled: ScheduledClick[] = [];

  function pruneScheduled(now: number): void {
    for (let index = scheduled.length - 1; index >= 0; index -= 1) {
      if (scheduled[index].end < now) scheduled.splice(index, 1);
    }
  }

  function ensureContext(): WechatMiniprogram.WebAudioContext {
    if (!context) {
      context = contextFactory();
      noiseBuffer = null;
    }
    return context;
  }

  function ensureNoiseBuffer(
    ctx: WechatMiniprogram.WebAudioContext,
  ): WechatMiniprogram.AudioBuffer {
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
    ctx: WechatMiniprogram.WebAudioContext,
    frequency: number,
    start: number,
    params: {
      peak: number;
      attack: number;
      decay: number;
      type: OscillatorType;
    },
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
    gain.connect(ctx.destination);

    const end = start + params.attack + params.decay + 0.01;
    oscillator.start(start);
    oscillator.stop(end);
    scheduled.push({ source: oscillator, start, end });
  }

  function scheduleNoise(
    ctx: WechatMiniprogram.WebAudioContext,
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
    gain.connect(ctx.destination);

    const end = start + spec.duration + 0.005;
    source.start(start);
    source.stop(end);
    scheduled.push({ source, start, end });
  }

  return {
    get timbre() {
      return timbre;
    },
    get state() {
      return context ? context.state : "idle";
    },
    get currentTime() {
      return context ? context.currentTime : 0;
    },
    setTimbre(next) {
      timbre = next;
    },
    async resume() {
      const ctx = ensureContext();
      if (ctx.state !== "running") await ctx.resume();
    },
    schedule(beatIndex, time, meter) {
      const ctx = context;
      if (!ctx) return;
      const spec = TIMBRE_SPECS[timbre];
      const params = clickParams(timbre, isAccentBeat(beatIndex, meter));
      const start = Number.isFinite(time) && time > 0 ? time : ctx.currentTime;
      pruneScheduled(ctx.currentTime);
      scheduleOscillator(ctx, params.frequency, start, {
        peak: params.peak,
        attack: params.attack,
        decay: params.decay,
        type: spec.type,
      });
      for (const multiple of spec.harmonics) {
        scheduleOscillator(ctx, params.frequency * multiple, start, {
          peak: params.peak * 0.5,
          attack: params.attack,
          decay: params.decay * 0.8,
          type: spec.type,
        });
      }
      if (spec.noise) scheduleNoise(ctx, spec.noise, start, params.peak * 0.6);
    },
    cancelFrom(time) {
      const boundary = Number.isFinite(time) ? time : context?.currentTime ?? 0;
      const keep: ScheduledClick[] = [];
      for (const entry of scheduled) {
        if (entry.start > boundary) {
          try {
            entry.source.stop(0);
          } catch {
            // Nodes that have already ended need no further cancellation.
          }
        } else {
          keep.push(entry);
        }
      }
      scheduled.length = 0;
      scheduled.push(...keep);
    },
    async suspend() {
      if (context?.state === "running") await context.suspend();
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
