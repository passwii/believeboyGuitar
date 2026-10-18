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
