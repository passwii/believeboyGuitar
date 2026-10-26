"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BpmDial } from "@/components/BpmDial";
import { TempoWave } from "@/components/TempoWave";
import { useScreenWakeLock } from "@/components/useScreenWakeLock";
import {
  preferPlaybackAudioSession,
  type AudioSessionNavigatorLike,
} from "@/lib/background-audio";
import {
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_METER,
  METERS,
  bpmToIntervalMs,
  clampBpm,
  meterChanged,
  nextBeat,
  pickResumeClick,
  resumeContinuation,
  retainScheduleWindow,
  type Meter,
  type ScheduledClick,
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
/**
 * 页面隐藏 / 锁屏时向前排满的秒数（BLF-1443）。
 *
 * 隐藏页面的定时器会被节流到 ≥1s，iOS 甚至直接冻结 JS；但已经交给音频时钟
 * 的拍子不受影响。所以进后台前先把一段时间排进去：只要 AudioContext 还活着，
 * 锁屏后节拍就不会断。240 BPM 时这段约 1200 拍，木质音色每拍 5 个节点
 * （振荡器 + 增益 + 噪声源 + 滤波器 + 增益），合计约 6000 个短命节点，内存可以
 * 接受；回到前台会立刻用 `retainScheduleWindow` 收回到 `SCHEDULE_AHEAD_S`。
 */
const BACKGROUND_SCHEDULE_AHEAD_S = 300;
/** 开始 / 从暂停恢复时，第一拍相对当前时钟的提前量 */
const START_LEAD_S = 0.06;
/** 改拍号后新小节第一拍的提前量 */
const RESUME_LEAD_S = 0.02;
/** BPM 播报节流（方案 §10），避免拖动滑杆时读屏连播 */
const BPM_ANNOUNCE_MS = 400;

type Phase = "idle" | "running" | "paused";

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
  const { hint: wakeLockHint, keepAwake } = useScreenWakeLock();

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
  const pendingRef = useRef<ScheduledClick[]>([]);
  /**
   * 启动请求代次：`start()` 每次进来 +1，卸载清理也 +1。
   * `await audio.resume()` 的续段拿它比对，作废了就一拍不排、一次 setState 也不发。
   */
  const startGenerationRef = useRef(0);

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

    const horizon =
      now +
      (document.visibilityState === "hidden"
        ? BACKGROUND_SCHEDULE_AHEAD_S
        : SCHEDULE_AHEAD_S);
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
    // 这次启动的请求代次：卸载与新一轮启动都会让它前进，await 续段据此判断是否已作废
    startGenerationRef.current += 1;
    const generation = startGenerationRef.current;

    // 借这次用户手势再要一次屏幕常亮：挂载时被浏览器拒绝的请求，在这里能补上
    keepAwake();

    let unlocked = true;
    try {
      await audio.resume();
    } catch {
      unlocked = false;
    }

    // 手势解锁音频是异步的。这个 await 窗口里用户可能导航走、组件已卸载 ——
    // 卸载清理已经 dispose 音频、清掉 interval，续段必须直接收手：再往下走到
    // startTicking() 会重建一个没人再清的 25ms interval（反复「点开始 → 立刻切走」
    // 会累积后台定时器），也没有可更新的组件。
    //
    // 页面隐藏不再算作「取消启动」：BLF-1443 要求锁屏后继续出声，所以隐藏时
    // 照常进入 running（旧版本在这里转 paused）。
    const continuation = resumeContinuation(generation, startGenerationRef.current);
    if (continuation === "discard") return;

    if (!unlocked) {
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
  }, [ensureAudio, keepAwake, startTicking]);

  const pause = useCallback(async () => {
    const audio = audioRef.current;
    stopTicking();
    if (audio) {
      const now = audio.currentTime;
      audio.cancelFrom(now);

      // 停在下一次该响的拍子上。pending 里可能还留着刚响过的那一拍
      // （tick 每 25ms 才清一次），所以取第一个尚未发声的项，不能直接取首项。
      const next = pickResumeClick(pendingRef.current, now, nextBeatIndexRef.current);
      nextBeatIndexRef.current = next.beat;
      nextBeatTimeRef.current = next.time;
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
    // 重复点当前拍号是无操作：不能重置小节、不能打断正在跑的节拍
    if (!meterChanged(meterRef.current, next)) return;

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

  /**
   * 锁屏 / 切到别的 app 回来之后：恢复音频时钟，并把后台排的长队列收回前台窗口。
   *
   * 关键点是「不补发」：队列里的拍子是按音频时钟排的，解锁后第一拍仍用队列里
   * 的时间点，不会一口气补响一串。Safari 有时不允许无手势恢复 AudioContext，
   * 这时退回 paused——「开始」按钮亮着，再点一下就好，不假装还在响。
   */
  const resumeFromBackground = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || phaseRef.current !== "running") return;

    // 这次恢复的代次：await 期间用户可能暂停 / 结束，也可能重新按了开始
    const generation = startGenerationRef.current;

    try {
      await audio.resume();
    } catch {
      // 代次已前进说明新一次启动接手了音频，别再 pause 掉它
      if (startGenerationRef.current === generation && phaseRef.current === "running") {
        await pause();
      }
      return;
    }

    // 这里必须复核，不能直接往下走：iOS 被中断时 resume() 可能挂很久才落定，
    // 这期间用户按了暂停 / 结束，或者点开始重新起了一轮。
    // - 代次变了：新一次启动拥有这个音频上下文，这次恢复整段作废，什么都不碰；
    // - 相位不是 running：用户已经停下来，把刚恢复的音频时钟挂回去再返回，
    //   否则界面显示「已暂停 / 已结束」而拍子还在响。
    if (startGenerationRef.current !== generation) return;
    if (phaseRef.current !== "running") {
      await audio.suspend();
      return;
    }

    if (audio.state !== "running") {
      await pause();
      return;
    }

    const now = audio.currentTime;
    const upcoming = pendingRef.current.find((entry) => entry.time > now);

    if (!upcoming) {
      // 队列跑空或时钟跳过了整段：从最后一拍的下一个位置重新起算
      const last = pendingRef.current[pendingRef.current.length - 1];
      const anchor = last
        ? nextBeat(last.beat, meterRef.current)
        : nextBeatIndexRef.current;
      audio.cancelFrom(now);
      pendingRef.current = [];
      nextBeatIndexRef.current = anchor;
      nextBeatTimeRef.current = now + RESUME_LEAD_S;
    } else {
      const plan = retainScheduleWindow(pendingRef.current, {
        now,
        aheadSeconds: SCHEDULE_AHEAD_S,
        intervalSeconds: bpmToIntervalMs(bpmRef.current) / 1000,
        meter: meterRef.current,
        fallback: { beat: nextBeatIndexRef.current, time: nextBeatTimeRef.current },
      });
      audio.cancelFrom(plan.cutoff);
      pendingRef.current = plan.kept;
      nextBeatIndexRef.current = plan.nextBeatIndex;
      nextBeatTimeRef.current = plan.nextBeatTime;
    }

    tick();
  }, [pause, tick]);

  /**
   * 页面隐藏（切 app / 锁屏）不再暂停（BLF-1443）。
   *
   * 隐藏时立刻按后台窗口排满：浏览器会把隐藏页面的 setInterval 节流到 ≥1s，
   * iOS 会直接冻结 JS，但已经交给音频时钟的拍子照响。回到前台先恢复音频时钟，
   * 再把队列收回到 120ms 窗口，避免之后改 BPM 时重排几百个点击。
   */
  useEffect(() => {
    const onVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio || phaseRef.current !== "running") return;

      if (document.visibilityState === "hidden") {
        tick();
        return;
      }

      void resumeFromBackground();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [resumeFromBackground, tick]);

  /** Safari：把这段音频声明成「媒体播放」，锁屏后系统不立刻挂起它 */
  useEffect(() => {
    preferPlaybackAudioSession(navigator as unknown as AudioSessionNavigatorLike);
  }, []);

  /** 锁屏 / 耳机的播放键接到节拍器上，也告诉系统这是媒体而不是后台噪音 */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "节拍器",
        artist: "电吉他学习资料库",
      });
    } catch {
      // 没有 MediaMetadata 的旧实现：没有锁屏信息，不影响播放
    }

    for (const [action, handler] of [
      ["play", () => void start()],
      ["pause", () => void pause()],
      ["stop", () => void stop()],
    ] as const) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // 部分浏览器只实现了其中一部分 action，缺哪个就少哪个
      }
    }

    return () => {
      for (const action of ["play", "pause", "stop"] as const) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // 未注册过的 action 在这里抛错也无所谓
        }
      }
    };
  }, [pause, start, stop]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = phase === "running" ? "playing" : "paused";
    } catch {
      // 旧实现里 playbackState 可能只读
    }
  }, [phase]);

  /** 卸载时 dispose，不是只 suspend（方案 §8） */
  useEffect(() => {
    return () => {
      // 先让还在 await 音频解锁的 start() 续段作废，它会看到代次对不上直接返回
      startGenerationRef.current += 1;
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
                  selected ? "bg-accent-700 text-on-accent" : "text-ink-700 hover:text-ink-950"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-500">{meter.description}</p>
      </section>

      <section className="flex flex-col items-center">
        <BpmDial value={bpm} onChange={changeBpm} />

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            aria-label="减速 1 BPM"
            onClick={() => changeBpm(bpm - 1)}
            disabled={bpm <= BPM_MIN}
            className="size-11 shrink-0 rounded-md border border-control-edge text-lg leading-none text-ink-700 hover:text-ink-950 disabled:text-ink-300"
          >
            −
          </button>
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

      {/* 拍点波形：峰值落在每拍，重音拍更高；播放时当前拍整组换成强调色。
          高亮来自同一个调度循环（activeBeat），不是另一套计时器。 */}
      <section className="flex flex-col gap-2">
        <TempoWave meter={meter} activeBeat={activeBeat} running={phase === "running"} className="h-12" />
        <p className="sr-only">波形：每拍四个细分，亮色是当前拍。</p>
      </section>

      <section className="flex flex-col items-center gap-1">
        {/* 过渡类只受 reducedMotion 控制、缩放类才受 active 控制。若两者绑在一起
            （旧写法：`active && !reducedMotion ? "scale-125 transition-transform"`），
            失去高亮的同一帧会把 transition-property 一起摘掉，退场就从 1.25 硬跳回 1，
            只剩「涨」没有「退」。 */}
        <div className="flex min-h-6 items-center justify-center gap-3" aria-hidden="true">
          {Array.from({ length: beats }, (_, index) => {
            const active = index === activeBeat;
            return (
              <span
                key={index}
                className={`size-3 rounded-full ${
                  active ? "bg-accent-600" : "bg-ink-100 ring-1 ring-rule"
                } ${reducedMotion ? "" : "transition-transform"} ${
                  active && !reducedMotion ? "scale-125" : ""
                }`}
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
          className="h-16 w-full rounded-md bg-accent-700 text-lg font-medium text-on-accent"
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
        {/* 屏幕常亮的状态条：高度先留着，避免 request 落定后整页往下跳 */}
        <p className="min-h-5 text-center text-meta text-ink-500">{wakeLockHint}</p>
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
                  selected ? "bg-accent-700 text-on-accent" : "text-ink-700 hover:text-ink-950"
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
