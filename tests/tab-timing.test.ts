import { describe, expect, it } from "vitest";
import {
  activeNoteIndex,
  measureBeatOrigins,
  noteTimings,
  playheadProgress,
  totalBeats,
} from "@/lib/tab-timing";
import { WEEK1_SECTIONS } from "@/lib/week-1-tab-exercises";
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

  it("全小节休止占满四拍并在一个位置显示", () => {
    const rest: TabMeasure = {
      notes: [{ string: 6, fret: 0, duration: "w", rest: true }],
    };
    expect(noteTimings([rest])).toEqual([{ onset: 0, duration: 4 }]);
    expect(totalBeats([rest])).toBe(4);
  });

  it("二分时值占两拍", () => {
    const half: TabMeasure = {
      notes: [{ string: 3, fret: 10, duration: "h", tie: true }],
    };
    expect(noteTimings([half])).toEqual([{ onset: 0, duration: 2 }]);
    expect(totalBeats([half])).toBe(2);
  });

  it("和弦双音共用同一拍位，不延长时间轴", () => {
    const chord: TabMeasure = {
      notes: [
        {
          string: 5,
          fret: 5,
          duration: "q",
          chord: [{ string: 4, fret: 7 }],
        },
        { string: 5, fret: 5, duration: "q" },
      ],
    };
    expect(noteTimings([chord])).toEqual([
      { onset: 0, duration: 1 },
      { onset: 1, duration: 1 },
    ]);
    expect(totalBeats([chord])).toBe(2);
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

describe("激光播放头位置", () => {
  const measures = [eighths(4), quarters(4)];

  it("给每个小节记录起始拍位", () => {
    expect(measureBeatOrigins(measures)).toEqual([0, 2]);
  });

  it("按音符时长推进，而不是按音符个数均分", () => {
    expect(playheadProgress(measures, 0.5)).toBeCloseTo(0.125);
    expect(playheadProgress(measures, 1)).toBeCloseTo(0.25);
    expect(playheadProgress(measures, 2)).toBeCloseTo(0.5);
    expect(playheadProgress(measures, 3)).toBeCloseTo(0.625);
  });

  it("未开始或超出谱面时返回空值/终点", () => {
    expect(playheadProgress(measures, -1)).toBeNull();
    expect(playheadProgress(measures, Number.NaN)).toBeNull();
    expect(playheadProgress(measures, 99)).toBe(1);
  });
});
