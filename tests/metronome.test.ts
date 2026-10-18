import { describe, expect, it, vi } from "vitest";
import {
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_METER,
  METERS,
  accentIndexes,
  bpmToIntervalMs,
  clampBpm,
  nextBeat,
  tempoName,
  type Meter,
} from "@/lib/metronome";
import {
  DEFAULT_TIMBRE,
  TIMBRES,
  WEAK_GAIN_RATIO,
  WEAK_PITCH_RATIO,
  clickParams,
  createMetronomeAudio,
  isAccentBeat,
  type Timbre,
} from "@/lib/metronome-audio";

describe("METERS 拍号模型", () => {
  it("包含方案约定的六种拍号", () => {
    expect(METERS.map((meter) => meter.label)).toEqual([
      "4/4",
      "3/4",
      "2/4",
      "6/8",
      "5/4",
      "7/8",
    ]);
  });

  it("每项都有 beatsPerBar / beatUnit / accents", () => {
    for (const meter of METERS) {
      expect(meter.beatsPerBar).toBeGreaterThan(1);
      expect([4, 8]).toContain(meter.beatUnit);
      expect(meter.accents.length).toBeGreaterThan(0);
      expect(meter.description).not.toBe("");
    }
  });

  it("拍号显示名与 beatsPerBar / beatUnit 一致", () => {
    for (const meter of METERS) {
      expect(meter.label).toBe(`${meter.beatsPerBar}/${meter.beatUnit}`);
    }
  });

  it("默认拍号是 4/4", () => {
    expect(DEFAULT_METER).toBe(METERS[0]);
    expect(DEFAULT_METER.beatsPerBar).toBe(4);
  });
});

describe("accentIndexes", () => {
  const byLabel = (label: string): Meter => {
    const meter = METERS.find((item) => item.label === label);
    if (!meter) throw new Error(`缺少拍号 ${label}`);
    return meter;
  };

  it("4/4 只重音第 1 拍", () => {
    expect(accentIndexes(byLabel("4/4"))).toEqual([0]);
  });

  it("6/8 每三个八分音符一个重音", () => {
    expect(accentIndexes(byLabel("6/8"))).toEqual([0, 3]);
  });

  it("7/8 按 2+2+3", () => {
    expect(accentIndexes(byLabel("7/8"))).toEqual([0, 2, 4]);
  });

  it("5/4 只重音第 1 拍", () => {
    expect(accentIndexes(byLabel("5/4"))).toEqual([0]);
  });

  it("越界、负数与重复索引被过滤，返回升序", () => {
    const meter: Meter = {
      label: "自定义",
      beatsPerBar: 4,
      beatUnit: 4,
      accents: [3, 0, 3, -1, 4, 1.5],
      description: "",
    };
    expect(accentIndexes(meter)).toEqual([0, 3]);
  });

  it("不修改入参", () => {
    const meter = byLabel("7/8");
    const before = [...meter.accents];
    accentIndexes(meter);
    expect(meter.accents).toEqual(before);
  });
});

describe("clampBpm", () => {
  it("夹紧到 30–240", () => {
    expect(clampBpm(BPM_MIN)).toBe(30);
    expect(clampBpm(BPM_MAX)).toBe(240);
    expect(clampBpm(0)).toBe(30);
    expect(clampBpm(-120)).toBe(30);
    expect(clampBpm(1000)).toBe(240);
  });

  it("取整（四舍五入）", () => {
    expect(clampBpm(89.4)).toBe(89);
    expect(clampBpm(89.5)).toBe(90);
    expect(clampBpm(239.6)).toBe(240);
    expect(clampBpm(29.6)).toBe(30);
  });

  it("区间内原样返回整数", () => {
    for (const bpm of [30, 60, 90, 120, 167, 240]) {
      expect(clampBpm(bpm)).toBe(bpm);
    }
  });

  it("非有限值回落到默认 BPM", () => {
    expect(clampBpm(Number.NaN)).toBe(BPM_DEFAULT);
    expect(clampBpm(Number.POSITIVE_INFINITY)).toBe(BPM_DEFAULT);
    expect(clampBpm(Number.NEGATIVE_INFINITY)).toBe(BPM_DEFAULT);
  });
});

describe("bpmToIntervalMs", () => {
  it("按 60000 / bpm 换算", () => {
    expect(bpmToIntervalMs(60)).toBe(1000);
    expect(bpmToIntervalMs(120)).toBe(500);
    expect(bpmToIntervalMs(240)).toBe(250);
    expect(bpmToIntervalMs(30)).toBe(2000);
  });

  it("非整除 BPM 保留小数精度", () => {
    expect(bpmToIntervalMs(90)).toBeCloseTo(666.6667, 3);
    expect(bpmToIntervalMs(90) * 90).toBeCloseTo(60000, 6);
    expect(bpmToIntervalMs(7)).toBe(2000); // 越界先夹紧到 30
  });

  it("越界 BPM 先夹紧再换算", () => {
    expect(bpmToIntervalMs(1000)).toBe(250);
    expect(bpmToIntervalMs(1)).toBe(2000);
  });
});

describe("tempoName", () => {
  it("按方案区间给出速度术语", () => {
    expect(tempoName(30)).toBe("Largo");
    expect(tempoName(59)).toBe("Largo");
    expect(tempoName(60)).toBe("Adagio");
    expect(tempoName(75)).toBe("Adagio");
    expect(tempoName(76)).toBe("Andante");
    expect(tempoName(107)).toBe("Andante");
    expect(tempoName(108)).toBe("Moderato");
    expect(tempoName(119)).toBe("Moderato");
    expect(tempoName(120)).toBe("Allegro");
    expect(tempoName(167)).toBe("Allegro");
    expect(tempoName(168)).toBe("Presto");
    expect(tempoName(240)).toBe("Presto");
  });

  it("越界值按夹紧后的 BPM 判定", () => {
    expect(tempoName(10)).toBe("Largo");
    expect(tempoName(1000)).toBe("Presto");
  });
});

describe("nextBeat", () => {
  it("在小节内推进并回到 0", () => {
    const meter = METERS.find((item) => item.label === "4/4") as Meter;
    expect(nextBeat(0, meter)).toBe(1);
    expect(nextBeat(2, meter)).toBe(3);
    expect(nextBeat(3, meter)).toBe(0);
  });

  it("6/8 与 7/8 按各自的拍数循环", () => {
    const six = METERS.find((item) => item.label === "6/8") as Meter;
    const seven = METERS.find((item) => item.label === "7/8") as Meter;
    expect(nextBeat(5, six)).toBe(0);
    expect(nextBeat(4, six)).toBe(5);
    expect(nextBeat(6, seven)).toBe(0);
    expect(nextBeat(0, seven)).toBe(1);
  });

  it("走完一整小节回到起点", () => {
    for (const meter of METERS) {
      let beat = 0;
      for (let step = 0; step < meter.beatsPerBar; step += 1) {
        beat = nextBeat(beat, meter);
      }
      expect(beat, meter.label).toBe(0);
    }
  });

  it("非法输入回到第 1 拍", () => {
    const meter = DEFAULT_METER;
    expect(nextBeat(-1, meter)).toBe(0);
    expect(nextBeat(Number.NaN, meter)).toBe(0);
    expect(nextBeat(Number.POSITIVE_INFINITY, meter)).toBe(0);
    expect(nextBeat(1.7, meter)).toBe(2);
    expect(nextBeat(0, { ...meter, beatsPerBar: 0 })).toBe(0);
  });

  it("索引超出当前小节时回到第 1 拍，而不是取模落到任意一拍", () => {
    const four = METERS.find((item) => item.label === "4/4") as Meter;
    const six = METERS.find((item) => item.label === "6/8") as Meter;
    // 6/8 停在第 5、6 拍时切到 4/4：索引 4 / 5 对新小节越界
    expect(nextBeat(4, four)).toBe(0);
    expect(nextBeat(5, four)).toBe(0);
    expect(nextBeat(6, six)).toBe(0);
    expect(nextBeat(7, six)).toBe(0);
  });
});

/** 记录调用序列的最小 AudioContext 替身，只实现被测代码用到的成员 */
type FakeCall = { name: string; args: unknown[] };

function createFakeContext(state: AudioContextState = "suspended") {
  const calls: FakeCall[] = [];
  const record = (name: string, ...args: unknown[]) => {
    calls.push({ name, args });
  };

  const param = (label: string) => ({
    setValueAtTime: (...args: unknown[]) => record(`${label}.setValueAtTime`, ...args),
    linearRampToValueAtTime: (...args: unknown[]) =>
      record(`${label}.linearRampToValueAtTime`, ...args),
    exponentialRampToValueAtTime: (...args: unknown[]) =>
      record(`${label}.exponentialRampToValueAtTime`, ...args),
  });

  const node = (label: string) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    label,
  });

  const context = {
    state,
    currentTime: 0,
    sampleRate: 44100,
    destination: { label: "destination" },
    createOscillator: () => ({
      ...node("oscillator"),
      type: "sine",
      frequency: param("oscillator.frequency"),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: () => ({ ...node("gain"), gain: param("gain.gain") }),
    createBiquadFilter: () => {
      const filter = {
        ...node("filter"),
        frequency: param("filter.frequency"),
        Q: param("filter.Q"),
      };
      let type: BiquadFilterType = "lowpass";
      Object.defineProperty(filter, "type", {
        get: () => type,
        set: (next: BiquadFilterType) => {
          type = next;
          record("filter.type", next);
        },
      });
      return filter;
    },
    createBufferSource: () => ({
      ...node("source"),
      buffer: null,
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createBuffer: (channels: number, frames: number) => {
      const data = new Float32Array(frames);
      return {
        length: frames,
        numberOfChannels: channels,
        getChannelData: () => data,
      };
    },
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    suspend: vi.fn(async () => {
      context.state = "suspended";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
  };

  return { context, calls };
}

describe("createMetronomeAudio", () => {
  it("默认音色是木质，且音色列表覆盖三种", () => {
    expect(DEFAULT_TIMBRE).toBe("wood");
    expect(TIMBRES.map((item) => item.id)).toEqual([
      "wood",
      "electronic",
      "mechanical",
    ]);
  });

  it("懒创建：未 resume 前不碰 AudioContext", () => {
    const factory = vi.fn(() => createFakeContext().context as unknown as AudioContext);
    const audio = createMetronomeAudio({ contextFactory: factory });
    expect(audio.state).toBe("idle");
    expect(audio.currentTime).toBe(0);
    expect(factory).not.toHaveBeenCalled();
  });

  it("resume 时创建并恢复 AudioContext，只创建一次", async () => {
    const { context } = createFakeContext();
    const factory = vi.fn(() => context as unknown as AudioContext);
    const audio = createMetronomeAudio({ contextFactory: factory });

    await audio.resume();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.state).toBe("running");

    await audio.resume();
    expect(factory).toHaveBeenCalledTimes(1);
    // 已经在 running，不再重复 resume
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("未 resume 时 schedule 静默跳过，不抛错", () => {
    const { context, calls } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    expect(() => audio.schedule(0, 1, DEFAULT_METER)).not.toThrow();
    expect(calls).toEqual([]);
  });

  it("schedule 在给定时间点排程振荡器与包络", async () => {
    const { context, calls } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    await audio.resume();
    audio.schedule(0, 1.5, DEFAULT_METER);

    const frequency = calls.find((call) => call.name === "oscillator.frequency.setValueAtTime");
    expect(frequency?.args).toEqual([1200, 1.5]);
    const attack = calls.find((call) => call.name === "gain.gain.linearRampToValueAtTime");
    expect(attack?.args[1]).toBeCloseTo(1.5 + 0.001, 6);
    // 木质音色带噪声瞬态
    expect(calls.some((call) => call.name === "filter.frequency.setValueAtTime")).toBe(true);
  });

  it("噪声滤波器类型按音色区分：木质带通、机械高通", async () => {
    const { context, calls } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    await audio.resume();

    audio.schedule(0, 1, DEFAULT_METER);
    expect(calls.find((call) => call.name === "filter.type")?.args).toEqual(["bandpass"]);

    calls.length = 0;
    audio.setTimbre("mechanical");
    audio.schedule(0, 2, DEFAULT_METER);
    expect(calls.find((call) => call.name === "filter.type")?.args).toEqual(["highpass"]);
  });

  it("弱拍降频到 0.72 倍并 −6dB", () => {
    const accent = clickParams("wood", true);
    const weak = clickParams("wood", false);
    expect(weak.frequency).toBeCloseTo(accent.frequency * WEAK_PITCH_RATIO, 6);
    expect(weak.peak).toBeCloseTo(accent.peak * WEAK_GAIN_RATIO, 6);
    expect(WEAK_GAIN_RATIO).toBeCloseTo(0.5012, 3);
  });

  it("三种音色的基频与包络参数不同", () => {
    const wood = clickParams("wood", true);
    const electronic = clickParams("electronic", true);
    const mechanical = clickParams("mechanical", true);
    expect(wood.frequency).toBe(1200);
    expect(electronic.frequency).toBe(2000);
    expect(mechanical.frequency).toBe(800);
    expect(electronic.decay).toBeLessThan(wood.decay);
  });

  it("isAccentBeat 按拍号重音判定", () => {
    const six = METERS.find((item) => item.label === "6/8") as Meter;
    const seven = METERS.find((item) => item.label === "7/8") as Meter;
    expect(isAccentBeat(0, six)).toBe(true);
    expect(isAccentBeat(3, six)).toBe(true);
    expect(isAccentBeat(1, six)).toBe(false);
    expect(isAccentBeat(2, seven)).toBe(true);
    expect(isAccentBeat(1, seven)).toBe(false);
  });

  it("7/8 的第 3 拍（索引 2）排程为重音频率", async () => {
    const { context, calls } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    await audio.resume();
    const seven = METERS.find((item) => item.label === "7/8") as Meter;
    audio.schedule(2, 2, seven);
    const frequency = calls.find((call) => call.name === "oscillator.frequency.setValueAtTime");
    expect(frequency?.args[0]).toBe(1200);
  });

  it("setTimbre 立即生效并改变排程频率", async () => {
    const { context, calls } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    await audio.resume();
    const timbres: Timbre[] = ["electronic", "mechanical"];
    for (const timbre of timbres) {
      audio.setTimbre(timbre);
      expect(audio.timbre).toBe(timbre);
      calls.length = 0;
      audio.schedule(0, 1, DEFAULT_METER);
      const frequency = calls.find(
        (call) => call.name === "oscillator.frequency.setValueAtTime",
      );
      expect(frequency?.args[0]).toBe(clickParams(timbre, true).frequency);
    }
  });

  it("suspend 只在 running 时挂起", async () => {
    const { context } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    await audio.suspend();
    expect(context.suspend).not.toHaveBeenCalled();

    await audio.resume();
    await audio.suspend();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(audio.state).toBe("suspended");
  });

  it("dispose 关闭上下文，再次 resume 重新创建", async () => {
    const { context } = createFakeContext();
    const factory = vi.fn(() => context as unknown as AudioContext);
    const audio = createMetronomeAudio({ contextFactory: factory });

    await audio.resume();
    await audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(audio.state).toBe("idle");

    await audio.resume();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("非法时间点回落到当前时钟时间", async () => {
    const { context, calls } = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    await audio.resume();
    context.currentTime = 4;
    audio.schedule(0, Number.NaN, DEFAULT_METER);
    const frequency = calls.find((call) => call.name === "oscillator.frequency.setValueAtTime");
    expect(frequency?.args[1]).toBe(4);
  });
});
