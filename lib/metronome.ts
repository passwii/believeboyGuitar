/**
 * 节拍器的纯逻辑：拍号模型、BPM 换算、速度术语、拍子推进。
 *
 * 这个模块不碰 DOM、不碰 AudioContext，可以在 node（vitest）下直接 import。
 * 浏览器音频部分见 `lib/metronome-audio.ts`。
 */

export type Meter = {
  /** 拍号显示名，如 "6/8" */
  label: string;
  /** 每小节拍数 */
  beatsPerBar: number;
  /** 以几分音符为一拍 */
  beatUnit: number;
  /** 重音拍索引，0 起 */
  accents: number[];
  /** 中文听感说明，用于界面提示 */
  description: string;
};

/**
 * 支持的拍号。重音规则见 docs/superpowers/specs/2026-10-18-metronome-design.md §5：
 * 单拍子只重音第 1 拍；6/8 每三个八分音符一个重音；7/8 按 2+2+3。
 */
export const METERS: Meter[] = [
  { label: "4/4", beatsPerBar: 4, beatUnit: 4, accents: [0], description: "默认" },
  { label: "3/4", beatsPerBar: 3, beatUnit: 4, accents: [0], description: "圆舞曲" },
  { label: "2/4", beatsPerBar: 2, beatUnit: 4, accents: [0], description: "进行曲" },
  {
    label: "6/8",
    beatsPerBar: 6,
    beatUnit: 8,
    accents: [0, 3],
    description: "复合拍，两个大拍",
  },
  {
    label: "5/4",
    beatsPerBar: 5,
    beatUnit: 4,
    accents: [0],
    description: "3+2 听感，只重音第 1 拍",
  },
  { label: "7/8", beatsPerBar: 7, beatUnit: 8, accents: [0, 2, 4], description: "2+2+3" },
];

/** 默认拍号（4/4） */
export const DEFAULT_METER: Meter = METERS[0];

/** BPM 下限 */
export const BPM_MIN = 30;
/** BPM 上限 */
export const BPM_MAX = 240;
/** 默认 BPM */
export const BPM_DEFAULT = 90;

/**
 * 重音拍索引，升序且去重。
 * 对越界或非整数的声明做过滤，避免拍号模型被写坏时把重音排到小节外。
 */
export function accentIndexes(meter: Meter): number[] {
  const valid = meter.accents.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < meter.beatsPerBar,
  );
  return [...new Set(valid)].sort((a, b) => a - b);
}

/** 夹紧到 30–240 并取整；非有限值回落到默认 BPM */
export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return BPM_DEFAULT;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
}

/** 一拍多少毫秒：60000 / bpm，入参先按 clampBpm 规整 */
export function bpmToIntervalMs(bpm: number): number {
  return 60000 / clampBpm(bpm);
}

/**
 * 圆环速度控件的几何常量。
 *
 * 扫角 270°，以 12 点钟方向为 0°、顺时针为正：起点 -135°（左下），
 * 终点 +135°（右下），底部留 90° 缺口。缺口既给旋钮一个可辨认的起点，
 * 也让「拖到底」和「拖到顶」在手指下是两处不同的位置。
 */
export const DIAL_SWEEP_DEG = 270;
export const DIAL_START_DEG = -135;

/** BPM 在圆环上的占比（0 = 最小速度，1 = 最大速度） */
export function bpmToDialRatio(bpm: number): number {
  return (clampBpm(bpm) - BPM_MIN) / (BPM_MAX - BPM_MIN);
}

/** BPM → 相对 12 点钟方向、顺时针的圆环角度（度） */
export function bpmToDialAngle(bpm: number): number {
  return DIAL_START_DEG + bpmToDialRatio(bpm) * DIAL_SWEEP_DEG;
}

/**
 * 指针相对圆心的偏移 → 相对 12 点钟方向、顺时针的角度（度，取值 [0, 360)）。
 * 圆心处没有方向，返回 0（调用方按「中心区不接管拖拽」处理）。
 */
export function dialAngleFromPoint(dx: number, dy: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return 0;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/**
 * 圆环角度 → BPM。
 *
 * 落在底部缺口里的角度没有对应值，吸附到更近的一端：缺口前半段算最大值，
 * 后半段算最小值。这样手指滑过缺口时读数只会停在端点上，不会跳变。
 */
export function dialAngleToBpm(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return BPM_DEFAULT;
  const relative = (((angleDeg - DIAL_START_DEG) % 360) + 360) % 360;
  const gap = 360 - DIAL_SWEEP_DEG;
  const ratio =
    relative <= DIAL_SWEEP_DEG
      ? relative / DIAL_SWEEP_DEG
      : relative - DIAL_SWEEP_DEG > gap / 2
        ? 0
        : 1;
  return clampBpm(BPM_MIN + ratio * (BPM_MAX - BPM_MIN));
}

/** 指针位置（相对圆心）直接映射到 BPM */
export function dialPointToBpm(dx: number, dy: number): number {
  return dialAngleToBpm(dialAngleFromPoint(dx, dy));
}

/**
 * 速度术语（只作提示，不参与计算）：
 * Largo <60、Adagio 60–75、Andante 76–107、Moderato 108–119、Allegro 120–167、Presto ≥168。
 */
export function tempoName(bpm: number): string {
  const value = clampBpm(bpm);
  if (value < 60) return "Largo";
  if (value < 76) return "Adagio";
  if (value < 108) return "Andante";
  if (value < 120) return "Moderato";
  if (value < 168) return "Allegro";
  return "Presto";
}

/**
 * 小节内推进一拍，越过最后一拍回到 0；非法输入回到第 1 拍。
 *
 * 越界索引（如 6/8 的索引 4 遇到 4/4）说明调用方的小节位置与新拍号不同步，
 * 此时回到第 1 拍而不是取模落到任意一拍。
 */
export function nextBeat(current: number, meter: Meter): number {
  const beats = meter.beatsPerBar;
  if (!Number.isInteger(beats) || beats <= 0) return 0;
  if (!Number.isFinite(current)) return 0;
  const index = Math.trunc(current);
  if (index < 0 || index >= beats) return 0;
  return (index + 1) % beats;
}

/** 已排进音频时钟的一次点击：小节内索引与它的音频时钟时间（秒） */
export type ScheduledClick = { beat: number; time: number };

/**
 * 暂停时决定从哪里继续。
 *
 * `pending` 里可能还留着刚响过的那一拍——调度器只在自己那次 tick 里清理
 * （每 25ms 一次），用户在这段窗口里点暂停就会看到它。直接取第一项会导致
 * 恢复时重播这一拍，所以必须取第一个 `time > now` 的项。
 *
 * 没有任何未响的点击时沿用 `nextBeatIndex`：调度器排程时已经把它推进到
 * 下一拍，这里再往回退才是错的。
 */
export function pickResumeClick(
  pending: readonly ScheduledClick[],
  now: number,
  nextBeatIndex: number,
): ScheduledClick {
  const upcoming = pending.find((entry) => entry.time > now);
  if (upcoming) return { beat: upcoming.beat, time: upcoming.time };
  return { beat: nextBeatIndex, time: now };
}

/**
 * 改拍号是否真的换了拍号。
 *
 * 点已选中的拍号必须是无操作：否则会撤掉已排程的点击、把新小节第 1 拍
 * 排到当前时刻之后，正在跑的节拍就断了一下。
 */
export function meterChanged(current: Meter, next: Meter): boolean {
  return next.label !== current.label;
}

/** 页面可见性，取值同 `document.visibilityState`（不含已废弃的 prerender） */
export type VisibilityState = "visible" | "hidden";

/**
 * 手势解锁音频之后，是否可以进入 running。
 *
 * `start()` 必须先 `await audio.resume()` 才能出声，这一步是异步的（浏览器要求
 * 音频由用户手势解锁）；这个窗口期内用户可能把页面切到后台。此时
 * `visibilitychange` 处理器读到的 `phaseRef.current` 还不是 running，会直接
 * no-op，于是 await 一 resolve 就在隐藏的标签页里开跑——与方案 §4「页面隐藏 →
 * 状态显式转 paused」冲突。所以 await 之后必须拿那一刻的可见性再判一次，
 * 隐藏就走暂停分支，一拍都不排程。
 */
export function mayStartRunning(visibilityState: VisibilityState): boolean {
  return visibilityState !== "hidden";
}

/** `await audio.resume()` 之后，`start()` 的续段该怎么走 */
export type ResumeContinuation = "run" | "pause" | "discard";

/**
 * 音频解锁 resolve 时，这次启动请求还算不算数。
 *
 * `await audio.resume()` 是异步的（浏览器要求音频由用户手势解锁），这个窗口期
 * 内组件可能已经被卸载（客户端路由切走）：卸载清理已经 `clearInterval` 掉调度器
 * 并 `dispose()` 了音频，但 `start()` 的续段还挂着等 resolve。续段再往下走就会
 * `startTicking()` 重建一个没人再清的 25ms interval——反复「点开始 → 立刻切走」
 * 会一步步累积后台定时器。所以 `start()` 在 await 之前记下请求代次，卸载（以及
 * 新的一次启动）都让代次前进，续段比对代次即可知道自己是否已经作废。
 *
 * 代次仍有效时才按那一刻的可见性分岔：隐藏走暂停语义（方案 §4），可见才开跑。
 */
export function resumeContinuation(
  requestGeneration: number,
  currentGeneration: number,
  visibilityState: VisibilityState,
): ResumeContinuation {
  if (requestGeneration !== currentGeneration) return "discard";
  return mayStartRunning(visibilityState) ? "run" : "pause";
}
