import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TabStaff } from "@/components/TabStaff";
import { WeekTwoTabDrill } from "@/components/WeekTwoTabDrill";
import { describePicking } from "@/lib/tab";
import { WEEK2_SECTIONS } from "@/lib/week-2-tab-exercises";

describe("第 2 周曲谱数据", () => {
  it("每日必弹与周一至周六共七段，每段四小节", () => {
    expect(WEEK2_SECTIONS.map((section) => section.id)).toEqual([
      "daily-picking",
      "monday-c-arpeggio",
      "tuesday-d-triplets",
      "wednesday-chord-tones",
      "thursday-ghost-picking",
      "friday-syncopation",
      "saturday-hammer-on",
    ]);
    expect(WEEK2_SECTIONS.every((section) => section.measures.length === 4)).toBe(true);
  });

  it("速度按每日与周一至周六的明细保留", () => {
    expect(WEEK2_SECTIONS.map((section) => section.bpm)).toEqual([
      120, 120, 90, 110, 120, 100, 100,
    ]);
  });

  it("每日必弹按四、八、三连、十六分的密度推进", () => {
    const daily = WEEK2_SECTIONS[0];
    expect(daily.measures.map((measure) => measure.notes.length)).toEqual([4, 8, 12, 16]);
    expect(daily.measures.map((measure) => measure.picking?.length)).toEqual([4, 8, 12, 16]);
    expect(daily.measures.map((measure) => measure.notes[0].duration)).toEqual([
      "q",
      "8",
      "8t",
      "16",
    ]);
  });

  it("周一 C 和弦分解跨五根弦并保持上下交替", () => {
    const strings = WEEK2_SECTIONS[1].measures[0].notes.map((note) => note.string);
    expect(strings).toEqual([5, 4, 3, 2, 1, 2, 3, 4]);
    expect(
      WEEK2_SECTIONS[1].measures[0].picking?.map((pick) => pick.stroke),
    ).toEqual(["down", "up", "down", "up", "down", "up", "down", "up"]);
  });

  it("周二 D、Dadd9、Dsus4 使用三连音并保留小指标记", () => {
    const tuesday = WEEK2_SECTIONS[2];
    expect(tuesday.measures.every((measure) => measure.notes.length === 12)).toBe(true);
    expect(tuesday.measures.every((measure) => measure.notes[0].duration === "8t")).toBe(true);
    expect(
      tuesday.measures.flatMap((measure) => measure.notes).filter((note) => note.string === 1 && note.fret === 3),
    ).toEqual([
      expect.objectContaining({ finger: "小" }),
    ]);
  });

  it("周三前两小节八分、后两小节三连音", () => {
    const wednesday = WEEK2_SECTIONS[3];
    expect(wednesday.measures.map((measure) => measure.notes[0].duration)).toEqual([
      "8",
      "8",
      "8t",
      "8t",
    ]);
  });

  it("周四保留十六分空拨格与空拨方向", () => {
    const thursday = WEEK2_SECTIONS[4];
    for (const measure of thursday.measures) {
      expect(measure.notes).toHaveLength(16);
      expect(measure.picking).toHaveLength(16);
      expect(measure.notes.filter((note) => note.silent)).toHaveLength(
        measure.picking?.filter((pick) => pick.ghost).length ?? 0,
      );
    }
    expect(describePicking(thursday.measures[0])).toContain("上拨空挥");
  });

  it("每小节的拨片格数明确，延音与技巧音不会落到格点之外", () => {
    expect(
      WEEK2_SECTIONS.map((section) =>
        section.measures.map((measure) => measure.picking?.length),
      ),
    ).toEqual([
      [4, 8, 12, 16],
      [8, 8, 8, 8],
      [12, 12, 12, 12],
      [8, 8, 12, 12],
      [16, 16, 16, 16],
      [16, 16, 16, 16],
      [15, 15, 15, 15],
    ]);

    for (const section of WEEK2_SECTIONS) {
      for (const measure of section.measures) {
        for (const note of measure.notes) {
          if (note.slot !== undefined) {
            expect(note.slot).toBeGreaterThanOrEqual(0);
            expect(note.slot).toBeLessThan(measure.picking?.length ?? 0);
          }
        }
      }
    }
  });

  it("周五、周六的延音、击弦和 Q.C. 都写入数据", () => {
    const allNotes = WEEK2_SECTIONS.flatMap((section) =>
      section.measures.flatMap((measure) => measure.notes),
    );
    expect(allNotes.some((note) => note.tie)).toBe(true);
    expect(allNotes.some((note) => note.hammerOn)).toBe(true);
    expect(allNotes.some((note) => note.quarterChoke)).toBe(true);
    expect(allNotes.some((note) => note.fretLabel === "3.5")).toBe(true);
  });
});

describe("第 2 周 widget", () => {
  const html = renderToStaticMarkup(createElement(WeekTwoTabDrill));

  it("七段练习都有 TAB 与速度", () => {
    for (const title of [
      "每日必弹 · 右手节奏控制",
      "周一 · C 和弦分解",
      "周二 · D 和弦三连音",
      "周三 · A / D 和弦组成音",
      "周四 · 空拨保持节奏",
      "周五 · 切分音里的持续交替",
      "周六 · 击弦与 Q.C.",
    ]) {
      expect(html).toContain(`>${title}</h3>`);
    }
    expect(html.match(/role="region"/g)).toHaveLength(7);
  });

  it("显示拨片、空拨、延音、击弦与 Q.C. 图例和谱面标记", () => {
    expect(html).toContain("谱面记号图例");
    expect(html).toContain(">⊓</");
    expect(html).toContain(">∨</");
    expect(html).toContain(">(⊓)</");
    expect(html).toContain(">(∨)</");
    expect(html).toContain(">~</text>");
    expect(html).toContain(">h</text>");
    expect(html).toContain(">Q.C.</text>");
    expect(html).toContain(">3.5</text>");
  });

  it("谱面读屏文本包含拨片轨迹", () => {
    const markup = renderToStaticMarkup(
      createElement(TabStaff, {
        measures: WEEK2_SECTIONS[4].measures.slice(0, 1),
        bpm: 120,
      }),
    );
    expect(markup).toContain("拨片：下拨、上拨空挥");
  });
});
