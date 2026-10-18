"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_METER,
  METERS,
  bpmToIntervalMs,
  clampBpm,
  nextBeat,
  tempoName,
  type Meter,
} from "@/lib/metronome";
import {
  DEFAULT_TIMBRE,
  TIMBRES,
  createMetronomeAudio,
  type MetronomeAudio,
  type Timbre,
} from "@/lib/metronome-audio";

/**
 * 调度参数（方案 §8）：25ms 的 interval 只负责往音频时钟里排拍子，
 * 每次向前看 120ms。不用 setInterval 直接发声——手机浏览器会漂移。
 */
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
/** 开始 / 从暂停恢复时，第一拍相对当前时钟的提前量 */
const START_LEAD_S = 0.06;
/** 改拍号后新小节第一拍的提前量 */
const RESUME_LEAD_S = 0.02;
/** BPM 播报节流（方案 §10），避免拖动滑杆时读屏连播 */
const BPM_ANNOUNCE_MS = 400;

type Phase = "idle" | "running" | "paused";

/** 已排进音频时钟、尚未发声的一次点击 */
type PendingClick = { beat: number; time: number };

const PHASE_LABEL: Record<Phase, string> = {
  idle: "开始",
  running: "暂停",
  // 暂停后按钮回到「开始」（按钮不留在「暂停」上），再按从暂停的拍继续
  paused: "开始",
};

/** 减弱动态效果时拍点只换颜色，不做缩放（方案 §10） */
function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // 静态导出时在服务端预渲染，没有 matchMedia
    () => false,
  );
}

export function Metronome() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [meter, setMeter] = useState<Meter>(DEFAULT_METER);
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [timbre, setTimbre] = useState<Timbre>(DEFAULT_TIMBRE);
  const [activeBeat, setActiveBeat] = useState(0);
  const [status, setStatus] = useState("");
  const [announcedBpm, setAnnouncedBpm] = useState(BPM_DEFAULT);
  const reducedMotion = usePrefersReducedMotion();

  /** 音频封装与调度器放在 ref 里：不参与渲染，也不会被闭包捕获成旧值 */
  const audioRef = useRef<MetronomeAudio | null>(null);
  const intervalRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const meterRef = useRef<Meter>(DEFAULT_METER);
  const bpmRef = useRef(BPM_DEFAULT);
  const timbreRef = useRef<Timbre>(DEFAULT_TIMBRE);
  /** 下一次要排程的拍（小节内索引）与它的音频时钟时间 */
  const nextBeatIndexRef = useRef(0);
  const nextBeatTimeRef = useRef(0);
  const pendingRef = useRef<PendingClick[]>([]);

  const stopTicking = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * 往前看一个窗口，把窗口内的拍子排进音频时钟。
   * 显示用的当前拍由同一循环按 `currentTime` 对齐，不另开计时器。
   */
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const now = audio.currentTime;
    // 时钟落后（例如切后台回来）时不要补发积压的拍子
    if (nextBeatTimeRef.current < now) {
      nextBeatTimeRef.current = now + RESUME_LEAD_S;
    }

    const horizon = now + SCHEDULE_AHEAD_S;
    while (nextBeatTimeRef.current < horizon) {
      const currentMeter = meterRef.current;
      const beat = nextBeatIndexRef.current;
      const time = nextBeatTimeRef.current;

      audio.schedule(beat, time, currentMeter);
      pendingRef.current.push({ beat, time });

      nextBeatIndexRef.current = nextBeat(beat, currentMeter);
      nextBeatTimeRef.current = time + bpmToIntervalMs(bpmRef.current) / 1000;
    }

    // 已经响过的点击从待撤销队列里摘掉，剩下的第一个就是「下一次该响的拍」
    const due = pendingRef.current.filter((entry) => entry.time <= now);
    pendingRef.current = pendingRef.current.filter((entry) => entry.time > now);
    if (due.length > 0) {
      const latest = due[due.length - 1].beat;
      setActiveBeat((previous) => (previous === latest ? previous : latest));
    }
  }, []);

  const startTicking = useCallback(() => {
    stopTicking();
    intervalRef.current = window.setInterval(tick, LOOKAHEAD_MS);
  }, [stopTicking, tick]);

  const ensureAudio = useCallback((): MetronomeAudio => {
    if (!audioRef.current) {
      audioRef.current = createMetronomeAudio({ timbre: timbreRef.current });
    }
    return audioRef.current;
  }, []);

  /**
   * 切音色：撤掉队列里的点击，按原时间、新音色重放。
   * 时间不变，所以节拍不被打断（方案 §4）。
   */
  const rescheduleTimbre = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || phaseRef.current !== "running") return;

    const now = audio.currentTime;
    audio.cancelFrom(now);

    const kept = pendingRef.current.filter((entry) => entry.time > now);
    pendingRef.current = kept;
    for (const entry of kept) {
      audio.schedule(entry.beat, entry.time, meterRef.current);
    }
  }, []);

  /**
   * 改 BPM：撤掉队列里的点击，从下一拍起用新间隔铺开，小节位置不重置（方案 §4）。
   *
   * 锚点是被撤掉的第一个点击（它已经按旧间隔排好了时间）——它照原时间响，
   * 后面各拍按新间隔铺开。这样既不会漏拍，也不会出现两拍挤在几十毫秒内。
   */
  const rescheduleTempo = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || phaseRef.current !== "running") return;

    const now = audio.currentTime;
    const cancelled = pendingRef.current.filter((entry) => entry.time > now);
    audio.cancelFrom(now);
    pendingRef.current = [];

    const interval = bpmToIntervalMs(bpmRef.current) / 1000;
    const anchor = cancelled[0] ?? {
      beat: nextBeatIndexRef.current,
      time: Math.max(nextBeatTimeRef.current, now + RESUME_LEAD_S),
    };

    // 被撤掉的窗口有几拍就补几拍，保证 tick 下一轮有落脚点
    let beat = anchor.beat;
    let time = anchor.time;
    for (let index = 0; index < Math.max(cancelled.length, 1); index += 1) {
      audio.schedule(beat, time, meterRef.current);
      pendingRef.current.push({ beat, time });
      beat = nextBeat(beat, meterRef.current);
      time += interval;
    }
    nextBeatIndexRef.current = beat;
    nextBeatTimeRef.current = time;
  }, []);

  const start = useCallback(async () => {
    const audio = ensureAudio();
    try {
      await audio.resume();
    } catch {
      setStatus("当前浏览器无法播放声音");
      return;
    }

    const resuming = phaseRef.current === "paused";
    if (!resuming) {
      // idle → running：从第 1 拍开始
      nextBeatIndexRef.current = 0;
      setActiveBeat(0);
    }
    pendingRef.current = [];
    nextBeatTimeRef.current = audio.currentTime + START_LEAD_S;

    phaseRef.current = "running";
    setPhase("running");
    setStatus(resuming ? "已继续" : "已开始");
    startTicking();
  }, [ensureAudio, startTicking]);

  const pause = useCallback(async () => {
    const audio = audioRef.current;
    stopTicking();
    if (audio) {
      const now = audio.currentTime;
      audio.cancelFrom(now);

      // 停在下一次该响的拍子上：回退到被撤销队列的第一拍
      const next = pendingRef.current[0];
      if (next) {
        nextBeatIndexRef.current = next.beat;
        nextBeatTimeRef.current = next.time;
      } else {
        nextBeatTimeRef.current = now;
      }
      pendingRef.current = [];
      setActiveBeat(nextBeatIndexRef.current);
      await audio.suspend();
    }

    phaseRef.current = "paused";
    setPhase("paused");
    setStatus("已暂停");
  }, [stopTicking]);

  const stop = useCallback(async () => {
    if (phaseRef.current === "idle") return;

    const audio = audioRef.current;
    stopTicking();
    if (audio) {
      audio.cancelFrom(audio.currentTime);
      await audio.suspend();
    }

    pendingRef.current = [];
    nextBeatIndexRef.current = 0;
    nextBeatTimeRef.current = 0;
    phaseRef.current = "idle";
    setPhase("idle");
    setActiveBeat(0);
    setStatus("已结束");
  }, [stopTicking]);

  const toggle = useCallback(() => {
    if (phaseRef.current === "running") {
      void pause();
      return;
    }
    void start();
  }, [pause, start]);

  const changeMeter = useCallback((next: Meter) => {
    meterRef.current = next;
    setMeter(next);

    // 改拍号：立即生效，running 时从新小节第 1 拍起算
    nextBeatIndexRef.current = 0;
    setActiveBeat(0);

    const audio = audioRef.current;
    if (audio && phaseRef.current === "running") {
      const now = audio.currentTime;
      audio.cancelFrom(now);
      pendingRef.current = [];
      nextBeatTimeRef.current = now + RESUME_LEAD_S;
    }
  }, []);

  const changeBpm = useCallback(
    (value: number) => {
      const next = clampBpm(value);
      bpmRef.current = next;
      setBpm(next);
      // 立即生效：下一拍起用新间隔，小节位置不变
      rescheduleTempo();
    },
    [rescheduleTempo],
  );

  const changeTimbre = useCallback(
    (next: Timbre) => {
      timbreRef.current = next;
      setTimbre(next);
      audioRef.current?.setTimbre(next);
      // 立即生效但不打断节拍：已排程的点击按原时间、新音色重放
      rescheduleTimbre();
    },
    [rescheduleTimbre],
  );

  /** 页面隐藏：停调度 + suspend，并把状态显式改成 paused（方案 §4） */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "running") {
        void pause();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pause]);

  /** 卸载时 dispose，不是只 suspend（方案 §8） */
  useEffect(() => {
    return () => {
      stopTicking();
      const audio = audioRef.current;
      audioRef.current = null;
      pendingRef.current = [];
      if (audio) void audio.dispose();
    };
  }, [stopTicking]);

  /** Space 切换开始/暂停，Esc 结束；焦点在原生控件上时不劫持 Space */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        if (phaseRef.current === "idle") return;
        event.preventDefault();
        void stop();
        return;
      }

      if (event.key !== " " && event.key !== "Spacebar") return;

      const target = event.target as HTMLElement | null;
      const interactive = target?.closest(
        "input, textarea, select, button, a, [contenteditable='true']",
      );
      if (interactive) return;

      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stop, toggle]);

  /** BPM 播报节流：拖动滑杆时只在停下来 400ms 后播报一次 */
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncedBpm(bpm), BPM_ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [bpm]);

  const beats = meter.beatsPerBar;
  const isIdle = phase === "idle";

  return (
    <div className="flex flex-col gap-7">
      <section>
        <p id="metronome-meter-label" className="text-sm font-medium text-ink-700">
          拍号
        </p>
        <div
          role="group"
          aria-labelledby="metronome-meter-label"
          className="mt-2 flex rounded-sm border border-control-edge p-0.5"
        >
          {METERS.map((option) => {
            const selected = option.label === meter.label;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                onClick={() => changeMeter(option)}
                className={`min-h-11 flex-1 rounded-sm px-1 text-sm font-medium ${
                  selected ? "bg-accent-700 text-white" : "text-ink-700 hover:text-ink-950"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-500">{meter.description}</p>
      </section>

      <section>
        <div className="text-center">
          <p className="text-6xl font-semibold tabular-nums leading-none">{bpm}</p>
          <p className="mt-2 text-sm text-ink-700">{tempoName(bpm)}</p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            aria-label="减速 1 BPM"
            onClick={() => changeBpm(bpm - 1)}
            disabled={bpm <= BPM_MIN}
            className="size-11 shrink-0 rounded-md border border-control-edge text-lg leading-none text-ink-700 hover:text-ink-950 disabled:text-ink-300"
          >
            −
          </button>
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={bpm}
            aria-label="速度"
            aria-valuetext={`每分钟 ${bpm} 拍`}
            onChange={(event) => changeBpm(Number(event.currentTarget.value))}
            className="h-11 min-w-0 flex-1 accent-accent-700"
          />
          <button
            type="button"
            aria-label="加速 1 BPM"
            onClick={() => changeBpm(bpm + 1)}
            disabled={bpm >= BPM_MAX}
            className="size-11 shrink-0 rounded-md border border-control-edge text-lg leading-none text-ink-700 hover:text-ink-950 disabled:text-ink-300"
          >
            +
          </button>
        </div>
      </section>

      <section className="flex flex-col items-center gap-1">
        <div className="flex min-h-6 items-center justify-center gap-3" aria-hidden="true">
          {Array.from({ length: beats }, (_, index) => {
            const active = index === activeBeat;
            return (
              <span
                key={index}
                className={`size-3 rounded-full ${
                  active ? "bg-accent-600" : "bg-ink-100 ring-1 ring-rule"
                } ${active && !reducedMotion ? "scale-125 transition-transform" : ""}`}
              />
            );
          })}
        </div>
        <p className="sr-only">
          第 {Math.min(activeBeat + 1, beats)} 拍，共 {beats} 拍
        </p>
      </section>

      <section className="flex flex-col items-stretch gap-1">
        <button
          type="button"
          onClick={toggle}
          className="h-16 w-full rounded-md bg-accent-700 text-lg font-medium text-white"
        >
          {PHASE_LABEL[phase]}
        </button>
        <button
          type="button"
          onClick={() => void stop()}
          disabled={isIdle}
          className="min-h-11 text-sm text-ink-700 disabled:text-ink-300"
        >
          结束
        </button>
      </section>

      <section>
        <p id="metronome-timbre-label" className="text-sm font-medium text-ink-700">
          音色
        </p>
        <div
          role="group"
          aria-labelledby="metronome-timbre-label"
          className="mt-2 flex rounded-sm border border-control-edge p-0.5"
        >
          {TIMBRES.map((option) => {
            const selected = option.id === timbre;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                title={option.hint}
                onClick={() => changeTimbre(option.id)}
                className={`min-h-11 flex-1 rounded-sm px-1 text-sm font-medium ${
                  selected ? "bg-accent-700 text-white" : "text-ink-700 hover:text-ink-950"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <p role="status" className="sr-only">
        {status}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcedBpm} 拍每分钟
      </p>
    </div>
  );
}
