import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_METER,
  DIAL_START_DEG,
  DIAL_SWEEP_DEG,
  METERS,
  accentIndexes,
  bpmToDialAngle,
  bpmToIntervalMs,
  clampBpm,
  dialAngleFromPoint,
  dialAngleToBpm,
  dialPointToBpm,
  meterChanged,
  nextBeat,
  pickResumeClick,
  resumeContinuation,
  retainScheduleWindow,
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

describe("圆环速度控件几何", () => {
  it("BPM 端点映射到 270° 扇形的两端", () => {
    expect(bpmToDialAngle(BPM_MIN)).toBe(DIAL_START_DEG);
    expect(bpmToDialAngle(BPM_MAX)).toBe(DIAL_START_DEG + DIAL_SWEEP_DEG);
    // -135° 指向左下、+135° 指向右下，底部留 90° 缺口
    expect(DIAL_START_DEG).toBe(-135);
    expect(DIAL_SWEEP_DEG).toBe(270);
  });

  it("角度与 BPM 互为逆运算（抽样校验）", () => {
    for (const bpm of [30, 45, 90, 120, 167, 200, 240]) {
      expect(dialAngleToBpm(bpmToDialAngle(bpm))).toBe(bpm);
    }
  });

  it("居中速度落在 0°（正上方）", () => {
    // (30 + 240) / 2 = 135，正好是扇形中点，与 12 点钟对齐
    expect(bpmToDialAngle(135)).toBe(0);
  });

  it("指针位置：正上是中位、正右约 5/6 处、正下吸附到端点", () => {
    // 扇形从 -135° 到 +135°，所以正上（0°）是区间中点
    expect(dialPointToBpm(0, -100)).toBe(clampBpm(BPM_MIN + 0.5 * (BPM_MAX - BPM_MIN)));
    // 正右是 90°，相对起点 225°，即扇形的 5/6
    expect(dialPointToBpm(100, 0)).toBe(clampBpm(BPM_MIN + (5 / 6) * (BPM_MAX - BPM_MIN)));
    // 正下落在 90° 缺口里，吸附到端点而不是给出中间值
    expect([BPM_MIN, BPM_MAX]).toContain(dialPointToBpm(0, 100));
    // 圆心没有方向
    expect(dialAngleFromPoint(0, 0)).toBe(0);
  });

  it("底部缺口里的角度吸附到更近的端点，不跳变", () => {
    // 缺口从 +135° 到 +225°：前半段算最大，后半段算最小
    expect(dialAngleToBpm(140)).toBe(BPM_MAX);
    expect(dialAngleToBpm(220)).toBe(BPM_MIN);
    // 12 点钟方向不是缺口，它就是扇形中点
    expect(dialAngleToBpm(0)).toBe(clampBpm(BPM_MIN + 0.5 * (BPM_MAX - BPM_MIN)));
  });

  it("负角度与超过 360° 的角度先归一到 [0, 360)", () => {
    // -135° == 225°（缺口后半段）→ 最小值
    expect(dialAngleToBpm(-135)).toBe(BPM_MIN);
    expect(dialAngleToBpm(500)).toBe(dialAngleToBpm(140));
    expect(dialAngleFromPoint(0, 100)).toBe(180);
    expect(dialAngleFromPoint(-100, 0)).toBe(270);
  });

  it("非有限输入不把 BPM 弄成 NaN", () => {
    expect(dialAngleToBpm(Number.NaN)).toBe(BPM_DEFAULT);
    expect(Number.isFinite(dialPointToBpm(Number.POSITIVE_INFINITY, 0))).toBe(true);
    expect(Number.isFinite(dialPointToBpm(0, Number.NaN))).toBe(true);
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

describe("pickResumeClick：暂停停在哪一拍", () => {
  it("跳过已经响过的点击，停在下一个未发声的拍", () => {
    // 240 BPM：第 2 拍在 0.31 刚响完，tick 还没轮到清理它
    const pending = [
      { beat: 1, time: 0.06 },
      { beat: 2, time: 0.31 },
      { beat: 3, time: 0.56 },
    ];
    expect(pickResumeClick(pending, 0.317, 3)).toEqual({ beat: 3, time: 0.56 });
  });

  it("边界相等算已响过：不重播当前这一拍", () => {
    expect(pickResumeClick([{ beat: 2, time: 0.31 }], 0.31, 3)).toEqual({
      beat: 3,
      time: 0.31,
    });
  });

  it("没有任何未响的点击时沿用调度器已推进的下一拍", () => {
    // tick 排程时已把 nextBeatIndex 推到下一拍，这里不能回退
    expect(pickResumeClick([{ beat: 3, time: 1.0 }], 1.007, 0)).toEqual({
      beat: 0,
      time: 1.007,
    });
    expect(pickResumeClick([], 2, 1)).toEqual({ beat: 1, time: 2 });
  });

  it("不改动传入的队列", () => {
    const pending = [{ beat: 1, time: 0.06 }];
    pickResumeClick(pending, 0.07, 2);
    expect(pending).toEqual([{ beat: 1, time: 0.06 }]);
  });
});

describe("meterChanged：重复点当前拍号不打断节拍", () => {
  const byLabel = (label: string): Meter => {
    const meter = METERS.find((item) => item.label === label);
    if (!meter) throw new Error(`缺少拍号 ${label}`);
    return meter;
  };

  it("同一个拍号返回 false，调用方因此不重置小节、不重排", () => {
    expect(meterChanged(DEFAULT_METER, DEFAULT_METER)).toBe(false);
    expect(meterChanged(byLabel("6/8"), byLabel("6/8"))).toBe(false);
  });

  it("不同拍号返回 true，包括拍数相同的情况", () => {
    expect(meterChanged(byLabel("4/4"), byLabel("3/4"))).toBe(true);
    expect(meterChanged(byLabel("2/4"), byLabel("4/4"))).toBe(true);
    expect(meterChanged(byLabel("6/8"), byLabel("5/4"))).toBe(true);
  });
});

describe("retainScheduleWindow：锁屏回来把长队列收回前台窗口（BLF-1443）", () => {
  const fallback = { beat: 2, time: 99 };

  it("只保留窗口内尚未响的点击，并给出继续排程的锚点", () => {
    const pending = [
      { beat: 0, time: 1 }, // 已响
      { beat: 1, time: 1.1 },
      { beat: 2, time: 1.2 },
      { beat: 3, time: 1.35 },
    ];

    const plan = retainScheduleWindow(pending, {
      now: 1.15,
      aheadSeconds: 0.1,
      intervalSeconds: 0.5,
      meter: DEFAULT_METER,
      fallback,
    });

    expect(plan.kept).toEqual([{ beat: 2, time: 1.2 }]);
    expect(plan.cutoff).toBeCloseTo(1.25);
    // 锚点是最后保留那一拍的下一个位置，相位不因裁剪而改变
    expect(plan.nextBeatIndex).toBe(3);
    expect(plan.nextBeatTime).toBeCloseTo(1.7);
  });

  it("慢速时窗口只有 120ms，也要保住两秒后的下一拍", () => {
    const pending = [
      { beat: 0, time: 10.5 },
      { beat: 1, time: 12.5 },
    ];

    const plan = retainScheduleWindow(pending, {
      now: 10,
      aheadSeconds: 0.12,
      intervalSeconds: 2,
      meter: DEFAULT_METER,
      fallback,
    });

    // cutoff 至少落在第一个未响点击上，不能把它撤掉
    expect(plan.cutoff).toBe(10.5);
    expect(plan.kept).toEqual([{ beat: 0, time: 10.5 }]);
    expect(plan.nextBeatIndex).toBe(1);
    expect(plan.nextBeatTime).toBe(12.5);
  });

  it("窗口覆盖整段时全保留，一个点击都不撤", () => {
    const pending = [
      { beat: 2, time: 5.1 },
      { beat: 3, time: 5.35 },
    ];

    const plan = retainScheduleWindow(pending, {
      now: 5,
      aheadSeconds: 1,
      intervalSeconds: 0.25,
      meter: DEFAULT_METER,
      fallback,
    });

    expect(plan.kept).toEqual(pending);
    expect(plan.cutoff).toBe(6);
  });

  it("没有未响点击时落回 fallback（调度器已有的下一拍）", () => {
    const plan = retainScheduleWindow([{ beat: 1, time: 3 }], {
      now: 3,
      aheadSeconds: 0.12,
      intervalSeconds: 0.5,
      meter: DEFAULT_METER,
      fallback,
    });

    expect(plan.kept).toEqual([]);
    expect(plan.cutoff).toBe(3);
    expect(plan.nextBeatIndex).toBe(fallback.beat);
    expect(plan.nextBeatTime).toBe(fallback.time);
  });

  it("不改动传入的队列", () => {
    const pending = [
      { beat: 0, time: 1 },
      { beat: 1, time: 5 },
    ];
    retainScheduleWindow(pending, {
      now: 0.5,
      aheadSeconds: 0.12,
      intervalSeconds: 0.5,
      meter: DEFAULT_METER,
      fallback,
    });
    expect(pending).toEqual([
      { beat: 0, time: 1 },
      { beat: 1, time: 5 },
    ]);
  });
});

/** 记录调用序列的最小 AudioContext 替身，只实现被测代码用到的成员 */
type FakeCall = { name: string; args: unknown[] };

function createFakeContext(state: AudioContextState = "suspended") {
  const calls: FakeCall[] = [];
  /** 按创建顺序记录的可排程源节点，供 cancelFrom 用例检查 stop 调用 */
  const sources: Array<{
    label: string;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
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
    createOscillator: () => {
      const oscillator = {
        ...node("oscillator"),
        type: "sine",
        frequency: param("oscillator.frequency"),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(oscillator);
      return oscillator;
    },
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
    createBufferSource: () => {
      const source = {
        ...node("source"),
        buffer: null,
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    },
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

  return { context, calls, sources };
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

describe("cancelFrom 撤销已排程的点击", () => {
  /** 每次点击会创建 1 个振荡器 + 噪声瞬态（木质、机械） */
  async function setup() {
    const fake = createFakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => fake.context as unknown as AudioContext,
    });
    await audio.resume();
    return { ...fake, audio };
  }

  it("停掉 start 在边界之后的 source，并保留已发声的", async () => {
    const { audio, sources } = await setup();

    audio.schedule(0, 1, DEFAULT_METER); // 已发声（边界之前）
    audio.schedule(1, 5, DEFAULT_METER); // 尚未发声（边界之后）

    const past = sources.slice(0, sources.length / 2);
    const future = sources.slice(sources.length / 2);
    // 排程时已经 stop 过一次（自然结束时间）
    for (const source of [...past, ...future]) {
      expect(source.stop).toHaveBeenCalledTimes(1);
    }

    audio.cancelFrom(2);

    for (const source of future) {
      expect(source.stop).toHaveBeenCalledTimes(2);
      expect(source.stop).toHaveBeenLastCalledWith(0);
    }
    for (const source of past) {
      // 已发声的不被抹掉
      expect(source.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("边界恰好等于 start 时不撤销（已经开始的不动）", async () => {
    const { audio, sources } = await setup();
    audio.schedule(0, 3, DEFAULT_METER);
    audio.cancelFrom(3);
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("撤销后队列清空：再次 cancelFrom 不会重复 stop", async () => {
    const { audio, sources } = await setup();
    audio.schedule(0, 5, DEFAULT_METER);
    audio.cancelFrom(1);
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalledTimes(2);
    }

    audio.cancelFrom(1);
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalledTimes(2);
    }
  });

  it("清空后可以按新参数重排，且新点击正常排程", async () => {
    const { audio, calls, sources } = await setup();
    audio.schedule(0, 5, DEFAULT_METER);
    const before = sources.length;
    audio.cancelFrom(1);

    calls.length = 0;
    audio.setTimbre("electronic");
    audio.schedule(0, 6, DEFAULT_METER);

    const added = sources.slice(before);
    expect(added.length).toBeGreaterThan(0);
    // 电子音色无噪声瞬态，只有振荡器
    expect(added.every((source) => source.label === "oscillator")).toBe(true);
    for (const source of added) {
      expect(source.stop).toHaveBeenCalledTimes(1);
    }
    const frequency = calls.find(
      (call) => call.name === "oscillator.frequency.setValueAtTime",
    );
    expect(frequency?.args).toEqual([clickParams("electronic", true).frequency, 6]);
  });

  it("未创建 AudioContext 时安全无操作", () => {
    const audio = createMetronomeAudio({
      contextFactory: () => createFakeContext().context as unknown as AudioContext,
    });
    expect(() => audio.cancelFrom(1)).not.toThrow();
  });

  it("非有限边界回落到当前时钟时间", async () => {
    const { audio, context, sources } = await setup();
    context.currentTime = 2;
    audio.schedule(0, 1, DEFAULT_METER); // 已发声
    audio.schedule(1, 4, DEFAULT_METER); // 未发声
    const past = sources.slice(0, sources.length / 2);
    const future = sources.slice(sources.length / 2);

    audio.cancelFrom(Number.NaN);

    for (const source of past) expect(source.stop).toHaveBeenCalledTimes(1);
    for (const source of future) expect(source.stop).toHaveBeenCalledTimes(2);
  });

  it("dispose 清空队列，重排后 cancelFrom 不影响旧节点", async () => {
    const { audio, sources } = await setup();
    audio.schedule(0, 5, DEFAULT_METER);
    const old = [...sources];
    await audio.dispose();
    audio.cancelFrom(1);
    for (const source of old) expect(source.stop).toHaveBeenCalledTimes(1);
  });
});

const metronomeSource = readFileSync(
  new URL("../components/Metronome.tsx", import.meta.url),
  "utf8",
);

/** 只取 `start()` 回调体，避免断言命中同文件里其它地方的同名调用 */
function startBody(): string {
  const from = metronomeSource.indexOf("const start = useCallback(");
  const to = metronomeSource.indexOf("const pause = useCallback(");
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return metronomeSource.slice(from, to);
}

describe("start() 里 await resume 之后的代次复核（方案 §4，BLF-1443 修订）", () => {
  it("复核位置在 await audio.resume() 之后、置 running 之前", () => {
    const body = startBody();
    const resumed = body.indexOf("await audio.resume()");
    const guard = body.indexOf("resumeContinuation(");
    const running = body.indexOf('phaseRef.current = "running"');

    expect(resumed).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(resumed);
    expect(running).toBeGreaterThan(guard);
  });

  it("页面隐藏不再转暂停：旧 pause 分支必须消失", () => {
    const body = startBody();
    expect(body).not.toContain('continuation === "pause"');
    expect(body).not.toContain("await audio.suspend()");
  });

  it("启动时借用户手势再要一次屏幕常亮（申请排在 await 之前）", () => {
    const body = startBody();
    const keepAwake = body.indexOf("keepAwake();");
    const resumed = body.indexOf("await audio.resume()");

    expect(keepAwake).toBeGreaterThan(-1);
    expect(keepAwake).toBeLessThan(resumed);
  });
});

describe("resumeContinuation：音频解锁 resolve 时该不该继续", () => {
  it("代次一致：正常开跑（页面是否可见不再影响结果）", () => {
    expect(resumeContinuation(3, 3)).toBe("run");
    expect(resumeContinuation(0, 0)).toBe("run");
  });

  it("代次已前进（卸载或新一轮启动）：丢弃", () => {
    // 卸载后重建 interval 就是在泄露后台定时器；组件没了 setState 也没意义
    expect(resumeContinuation(3, 4)).toBe("discard");
    expect(resumeContinuation(0, 1)).toBe("discard");
  });
});

describe("start() 的 await 续段不会在卸载后重建调度器（定时器泄露）", () => {
  it("请求代次在 await 之前就推进，作废判定才有基准", () => {
    const body = startBody();
    const bump = body.indexOf("startGenerationRef.current += 1");
    const resumed = body.indexOf("await audio.resume()");

    expect(bump).toBeGreaterThan(-1);
    expect(bump).toBeLessThan(resumed);
  });

  it("丢弃分支排在 startTicking() 之前，且是真返回", () => {
    const body = startBody();
    const discard = body.indexOf('if (continuation === "discard") return;');
    const running = body.indexOf('phaseRef.current = "running"');
    // 用带分号的调用形式，避免命中注释里提到的 startTicking()
    const ticking = body.indexOf("startTicking();");

    expect(discard).toBeGreaterThan(-1);
    expect(discard).toBeLessThan(running);
    expect(ticking).toBeGreaterThan(discard);
  });

  it("卸载清理推进代次，让挂着的 await 续段看到自己已作废", () => {
    const from = metronomeSource.indexOf("卸载时 dispose");
    expect(from).toBeGreaterThan(-1);
    const cleanup = metronomeSource.slice(from);
    const bump = cleanup.indexOf("startGenerationRef.current += 1");
    const stop = cleanup.indexOf("stopTicking();");

    // 先作废再清调度器：续段即便抢在这中间跑，也不会再往后走
    expect(bump).toBeGreaterThan(-1);
    expect(bump).toBeLessThan(stop);
  });
});

/** 只取 `resumeFromBackground()` 回调体 */
function backgroundResumeBody(): string {
  const from = metronomeSource.indexOf("const resumeFromBackground = useCallback(");
  const to = metronomeSource.indexOf("页面隐藏（切 app / 锁屏）不再暂停", from);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return metronomeSource.slice(from, to);
}

describe("回前台的 resume 在 await 之后复核代次与相位（复核 2）", () => {
  it("await 之前记下代次", () => {
    const body = backgroundResumeBody();
    const generation = body.indexOf("const generation = startGenerationRef.current;");
    const resumed = body.indexOf("await audio.resume()");

    expect(generation).toBeGreaterThan(-1);
    expect(resumed).toBeGreaterThan(-1);
    expect(generation).toBeLessThan(resumed);
  });

  it("await 之后先查代次、再查相位，两道都过了才碰队列", () => {
    const body = backgroundResumeBody();
    const resumed = body.indexOf("await audio.resume()");
    const guard = body.indexOf("startGenerationRef.current !== generation", resumed);
    const phase = body.indexOf('phaseRef.current !== "running"', resumed);
    const scheduling = body.indexOf("pendingRef.current.find", resumed);

    expect(guard).toBeGreaterThan(resumed);
    expect(phase).toBeGreaterThan(guard);
    expect(scheduling).toBeGreaterThan(phase);
  });

  it("相位已作废就重新 suspend 并返回，不再 tick", () => {
    const body = backgroundResumeBody();
    const resumed = body.indexOf("await audio.resume()");
    const phase = body.indexOf('phaseRef.current !== "running"', resumed);
    const suspend = body.indexOf("await audio.suspend()", resumed);
    const tick = body.indexOf("tick();", resumed);

    expect(suspend).toBeGreaterThan(phase);
    expect(tick).toBeGreaterThan(suspend);
  });

  it("resume 抛错时也不越过代次去 pause 新一轮启动", () => {
    const body = backgroundResumeBody();
    const failed = body.indexOf("await pause();");

    expect(failed).toBeGreaterThan(-1);
    expect(body.slice(0, failed)).toContain(
      'if (startGenerationRef.current === generation && phaseRef.current === "running")',
    );
  });
});
