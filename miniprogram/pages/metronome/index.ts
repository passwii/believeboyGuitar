import {
  BPM_DEFAULT,
  DEFAULT_METER,
  METERS,
  bpmToIntervalMs,
  clampBpm,
  nextBeat,
  type Meter,
} from "../../generated/guitar-core";
import {
  TIMBRES,
  createMetronomeAudio,
  type Timbre,
} from "../../adapters/metronome-audio";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const START_LEAD_S = 0.06;
const CHANGED_LEAD_S = 0.02;

type PendingClick = { beat: number; time: number };

const runtime = {
  audio: null as ReturnType<typeof createMetronomeAudio> | null,
  timer: null as number | null,
  phase: "idle" as "idle" | "running",
  meter: DEFAULT_METER as Meter,
  bpm: BPM_DEFAULT,
  timbre: "wood" as Timbre,
  nextBeatIndex: 0,
  nextBeatTime: 0,
  pending: [] as PendingClick[],
};

let startGeneration = 0;

function resetRuntime(): void {
  startGeneration += 1;
  runtime.audio = null;
  runtime.timer = null;
  runtime.phase = "idle";
  runtime.meter = DEFAULT_METER;
  runtime.bpm = BPM_DEFAULT;
  runtime.timbre = "wood";
  runtime.nextBeatIndex = 0;
  runtime.nextBeatTime = 0;
  runtime.pending = [];
}

function releaseWakeLock(): void {
  try {
    wx.setKeepScreenOn({ keepScreenOn: false });
  } catch {
    // Older clients may not expose the screen wake lock API.
  }
}

Page({
  data: {
    bpm: BPM_DEFAULT,
    meter: DEFAULT_METER,
    meters: METERS,
    timbres: TIMBRES,
    timbre: TIMBRES[0] as (typeof TIMBRES)[number],
    activeBeat: 0,
    phase: "idle" as "idle" | "running",
    status: "准备开始",
    wakeHint: "",
  },

  onLoad() {
    resetRuntime();
    this.setData({
      bpm: runtime.bpm,
      meter: runtime.meter,
      meters: METERS,
      timbres: TIMBRES,
      timbre: TIMBRES[0],
      activeBeat: 0,
      phase: "idle",
      status: "准备开始",
      wakeHint: "",
    });
  },

  onHide() {
    this.stop();
  },

  onUnload() {
    this.stop();
  },

  onDialChange(event: { detail: { value: number } }) {
    this.changeBpm(event.detail.value);
  },

  toggle() {
    if (runtime.phase === "running") this.stop();
    else void this.start();
  },

  decrementBpm() {
    this.changeBpm(runtime.bpm - 1);
  },

  incrementBpm() {
    this.changeBpm(runtime.bpm + 1);
  },

  changeBpm(value: number) {
    runtime.bpm = clampBpm(value);
    this.setData({ bpm: runtime.bpm });
    if (runtime.phase === "running") this.reschedule();
  },

  cycleMeter() {
    const currentIndex = METERS.findIndex(
      (meter) => meter.label === runtime.meter.label,
    );
    runtime.meter = METERS[(currentIndex + 1) % METERS.length];
    this.setData({ meter: runtime.meter, activeBeat: 0 });
    if (runtime.phase === "running") this.reschedule(true);
  },

  cycleTimbre() {
    const currentIndex = TIMBRES.findIndex(
      (timbre) => timbre.id === runtime.timbre,
    );
    const nextTimbre = TIMBRES[(currentIndex + 1) % TIMBRES.length];
    runtime.timbre = nextTimbre.id;
    runtime.audio?.setTimbre(runtime.timbre);
    this.setData({ timbre: nextTimbre });
    if (runtime.phase === "running") this.reschedule();
  },

  async start() {
    if (runtime.phase === "running" || runtime.audio) return;
    if (typeof wx.createWebAudioContext !== "function") {
      this.setData({ status: "当前微信版本不支持节拍器音频", wakeHint: "" });
      return;
    }

    const generation = ++startGeneration;
    let audio: ReturnType<typeof createMetronomeAudio> | null = null;
    try {
      audio = createMetronomeAudio({ timbre: runtime.timbre });
      runtime.audio = audio;
      await audio.resume();
    } catch {
      if (audio && runtime.audio === audio) {
        runtime.audio = null;
        void audio.dispose().catch(() => undefined);
      } else if (audio) {
        void audio.dispose().catch(() => undefined);
      }
      releaseWakeLock();
      if (generation === startGeneration) {
        runtime.phase = "idle";
        this.setData({
          phase: "idle",
          activeBeat: 0,
          status: "音频启动失败，请重试",
          wakeHint: "",
        });
      }
      return;
    }

    if (!audio || generation !== startGeneration || runtime.audio !== audio) {
      void audio.dispose().catch(() => undefined);
      return;
    }

    runtime.phase = "running";
    runtime.nextBeatIndex = 0;
    runtime.nextBeatTime = audio.currentTime + START_LEAD_S;
    runtime.pending = [];
    this.setData({ phase: "running", status: "正在播放", activeBeat: 0 });
    try {
      wx.setKeepScreenOn({
        keepScreenOn: true,
        success: () => {
          if (runtime.phase === "running") this.setData({ wakeHint: "屏幕将保持常亮" });
        },
        fail: () => {
          if (runtime.phase === "running") this.setData({ wakeHint: "无法保持屏幕常亮" });
        },
      });
    } catch {
      this.setData({ wakeHint: "无法保持屏幕常亮" });
    }
    runtime.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
    this.tick();
  },

  tick() {
    const audio = runtime.audio;
    if (runtime.phase !== "running" || !audio) return;

    const now = audio.currentTime;
    while (runtime.nextBeatTime < now + SCHEDULE_AHEAD_S) {
      const beat = runtime.nextBeatIndex;
      const time = runtime.nextBeatTime;
      audio.schedule(beat, time, runtime.meter);
      runtime.pending.push({ beat, time });
      runtime.nextBeatIndex = nextBeat(beat, runtime.meter);
      runtime.nextBeatTime = time + bpmToIntervalMs(runtime.bpm) / 1000;
    }

    const due = runtime.pending.filter((click) => click.time <= now);
    runtime.pending = runtime.pending.filter((click) => click.time > now);
    const latestDue = due[due.length - 1];
    if (latestDue && this.data.activeBeat !== latestDue.beat) {
      this.setData({ activeBeat: latestDue.beat });
    }
  },

  reschedule(resetBeat = false) {
    const audio = runtime.audio;
    if (!audio) return;

    const now = audio.currentTime;
    const future = runtime.pending.filter((click) => click.time > now);
    audio.cancelFrom(now);
    runtime.pending = [];
    const anchor = resetBeat
      ? { beat: 0, time: future[0]?.time ?? now + CHANGED_LEAD_S }
      : future[0] ?? {
          beat: runtime.nextBeatIndex,
          time: now + CHANGED_LEAD_S,
        };
    runtime.nextBeatIndex = anchor.beat;
    runtime.nextBeatTime = anchor.time;
  },

  stop() {
    startGeneration += 1;
    if (runtime.timer !== null) clearInterval(runtime.timer);
    runtime.timer = null;
    const audio = runtime.audio;
    if (audio) {
      audio.cancelFrom(audio.currentTime);
      runtime.audio = null;
      void audio.dispose().catch(() => undefined);
    }
    runtime.pending = [];
    runtime.nextBeatIndex = 0;
    runtime.nextBeatTime = 0;
    runtime.phase = "idle";
    releaseWakeLock();
    this.setData({ activeBeat: 0, phase: "idle", status: "准备开始", wakeHint: "" });
  },
});
