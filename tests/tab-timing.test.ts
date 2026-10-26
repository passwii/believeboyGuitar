import { describe, expect, it } from "vitest";
import { activeNoteIndex, noteTimings, totalBeats } from "@/lib/tab-timing";
import { WEEK1_SECTIONS } from "@/lib/tab-exercises";
import type { TabMeasure } from "@/lib/tab";

const quarters = (count: number): TabMeasure => ({
  notes: Array.from({ length: count }, () => ({ string: 6 as const, fret: 5, duration: "q" as const })),
});
const eighths = (count: number): TabMeasure => ({
  notes: Array.from({ length: count }, () => ({ string: 6 as const, fret: 5, duration: "8" as const })),
});

describe("曲谱时间轴", () => {
  it("四分音符每拍一个", () => {
    const timings = noteTimings([quarters(4)]);
    expect(timings.map((timing) => timing.onset)).toEqual([0, 1, 2, 3]);
    expect(totalBeats([quarters(4)])).toBe(4);
  });

  it("八分音符半拍一个", () => {
    const timings = noteTimings([eighths(8)]);
    expect(timings.map((timing) => timing.onset)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  it("按拍位定位音符，跨小节连续", () => {
    const measures = [quarters(4), eighths(4)];
    expect(activeNoteIndex(measures, 0)).toBe(0);
    expect(activeNoteIndex(measures, 3)).toBe(3);
    // 第 5 拍是第二小节的第一个音
    expect(activeNoteIndex(measures, 4)).toBe(4);
    expect(activeNoteIndex(measures, 4.5)).toBe(5);
  });

  it("超出末尾或非法拍位返回 null", () => {
    const measures = [quarters(2)];
    expect(activeNoteIndex(measures, 2)).toBeNull();
    expect(activeNoteIndex(measures, -1)).toBeNull();
    expect(activeNoteIndex(measures, Number.NaN)).toBeNull();
  });

  it("第 1 周的每一段都能算出拍数", () => {
    for (const section of WEEK1_SECTIONS) {
      expect(totalBeats(section.measures)).toBeGreaterThan(0);
    }
  });
});
