import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RockRhythmTabDrill } from "@/components/RockRhythmTabDrill";
import { totalBeats } from "@/lib/tab-timing";
import { ROCK_RHYTHM_SECTIONS } from "@/lib/rock-rhythm-tab-exercises";

describe("摇滚节奏型曲谱数据", () => {
  const [section] = ROCK_RHYTHM_SECTIONS;

  it("沿截图顺序保留 12 小节，每小节均为四拍", () => {
    expect(ROCK_RHYTHM_SECTIONS).toHaveLength(1);
    expect(section.measures).toHaveLength(12);
    expect(section.measures.map((measure) => totalBeats([measure]))).toEqual(
      Array.from({ length: 12 }, () => 4),
    );
    expect(section.measures[0].notes).toMatchObject([
      { duration: "w", rest: true },
    ]);
  });

  it("保留四个强力和弦、掌根制音区间与可复用技巧记号", () => {
    const chordLabels = section.measures.flatMap((measure) =>
      measure.annotations
        ?.filter((annotation) => annotation.kind === "chord")
        .map((annotation) => annotation.label) ?? [],
    );
    const notes = section.measures.flatMap((measure) => measure.notes);

    expect(chordLabels).toEqual(["D5", "Bb5", "F5", "C5"]);
    expect(section.measures.filter((measure) =>
      measure.annotations?.some((annotation) => annotation.kind === "palm-mute"),
    ).length).toBeGreaterThan(0);
    expect(notes.some((note) => (note.chord?.length ?? 0) > 0)).toBe(true);
    expect(notes.some((note) => note.slide === "up")).toBe(true);
    expect(notes.some((note) => note.fretLabel === "X")).toBe(true);
    expect(notes.some((note) => note.tie)).toBe(true);
    expect(notes.some((note) => note.vibrato)).toBe(true);
  });
});

describe("摇滚节奏型练习组件", () => {
  const html = renderToStaticMarkup(createElement(RockRhythmTabDrill));

  it("渲染速度、调式、和弦名与全曲 TAB", () => {
    for (const text of ["摇滚节奏型", "♩ = 160", "4/4 拍", "1=F", "D5", "Bb5", "F5", "C5"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("12 小节");
    expect(html).toContain(">P.M.</text>");
    expect(html).toContain(">/14</text>");
    expect(html).toContain('font-size="12"');
  });
});
