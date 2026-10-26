import type { TabDuration, TabMeasure } from "@/lib/tab";

/**
 * 曲谱时间轴（2026-10-26）。
 *
 * 把「音符时值」换算成拍位：q = 1 拍，8 = 半拍，8t = 三分之一拍，16 = 四分之一拍。
 * 只做时间，不碰音高——音高仍由 lib/tab.ts 推导，两者互不覆盖。
 *
 * 节拍器与谱面共用这一个时间轴：拍点推进时，落在该拍位上的音符被点亮。
 */
export const DURATION_BEATS: Record<TabDuration, number> = {
  q: 1,
  "8": 0.5,
  "8t": 1 / 3,
  "16": 0.25,
};

export type NoteTiming = {
  /** 相对本段起点的拍位 */
  onset: number;
  duration: number;
};

/** 一段乐句里每个音符的拍位，顺序与 measures 里的音符顺序一致 */
export function noteTimings(measures: readonly TabMeasure[]): NoteTiming[] {
  const timings: NoteTiming[] = [];
  let position = 0;
  for (const measure of measures) {
    for (const note of measure.notes) {
      const duration = DURATION_BEATS[note.duration];
      timings.push({ onset: position, duration });
      position += duration;
    }
  }
  return timings;
}

/** 某个拍位落在哪个音符上；没有音符覆盖该拍位时返回 null */
export function activeNoteIndex(
  measures: readonly TabMeasure[],
  beatPosition: number,
): number | null {
  if (!Number.isFinite(beatPosition) || beatPosition < 0) return null;
  const timings = noteTimings(measures);
  const epsilon = 1e-6;
  for (let index = 0; index < timings.length; index += 1) {
    const { onset, duration } = timings[index];
    if (beatPosition + epsilon >= onset && beatPosition < onset + duration - epsilon) {
      return index;
    }
  }
  return null;
}

/** 一段乐句的总拍数，用来在末尾停住并复位 */
export function totalBeats(measures: readonly TabMeasure[]): number {
  return noteTimings(measures).reduce((sum, timing) => sum + timing.duration, 0);
}
