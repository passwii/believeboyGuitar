import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TabStaff } from "@/components/TabStaff";
import { WeekOneTabDrill } from "@/components/WeekOneTabDrill";
import { deriveTabPitch, groupNotesForRhythm, type TabNote } from "@/lib/tab";
import { TAB_LAYOUT, tabBeamRowY, tabStemSpan, tabStringY } from "@/lib/tab-layout";
import { FRET_TO_FINGER, WEEK1_SECTIONS } from "@/lib/week-1-tab-exercises";

describe("第 1 周曲谱数据", () => {
  it("每日必弹与周一至周六共七段，每段四小节且都在 6 弦", () => {
    expect(WEEK1_SECTIONS.map((section) => section.id)).toEqual([
      "daily",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ]);

    for (const section of WEEK1_SECTIONS) {
      expect(section.measures).toHaveLength(4);
      for (const measure of section.measures) {
        expect(measure.notes.length).toBeGreaterThan(0);
        for (const note of measure.notes) {
          expect(note.string).toBe(6);
          expect(note.fret).toBeGreaterThanOrEqual(4);
          expect(note.fret).toBeLessThanOrEqual(10);
          expect(["食", "中", "名", "小"]).toContain(note.finger);
        }
      }
    }
  });

  it("基础把位的品位仍对应固定指法", () => {
    for (const section of WEEK1_SECTIONS.slice(0, 4)) {
      for (const note of section.measures.flatMap((measure) => measure.notes)) {
        expect(note.finger).toBe(FRET_TO_FINGER[note.fret as 5 | 6 | 7 | 8]);
      }
    }
  });

  it("八分、三连音与十六分音符的音数正确", () => {
    const counts = WEEK1_SECTIONS.map(
      (section) => section.measures.flatMap((measure) => measure.notes).length,
    );
    expect(counts).toEqual([32, 32, 32, 48, 64, 32, 32]);
    expect(
      WEEK1_SECTIONS[3].measures
        .flatMap((m) => m.notes)
        .every((note) => note.duration === "8t"),
    ).toBe(true);
    expect(
      WEEK1_SECTIONS[4].measures
        .flatMap((m) => m.notes)
        .every((note) => note.duration === "16"),
    ).toBe(true);
  });

  it("速度按 100 → 110 分组", () => {
    expect(WEEK1_SECTIONS.map((section) => section.bpm)).toEqual([
      100, 100, 100, 100, 110, 110, 110,
    ]);
  });

  it("周四标出三音一组重音，并在末尾保留把位移位", () => {
    const thursday = WEEK1_SECTIONS[4];
    for (const measure of thursday.measures) {
      const accents = measure.notes
        .map((note, index) => (note.accent ? index : -1))
        .filter((index) => index >= 0);
      expect(accents).toEqual([0, 3, 6, 9, 12, 15]);
    }

    const lastMeasure = thursday.measures[3].notes;
    expect(lastMeasure.map((note) => note.fret)).toEqual([
      6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 5, 7, 6, 5, 4, 5,
    ]);
    expect(lastMeasure[14]).toMatchObject({ fret: 4, finger: "食", shift: true });
  });

  it("周五、周六保留向低把位与第 10 品的移动", () => {
    expect(WEEK1_SECTIONS[5].measures[1].notes.map((note) => note.fret)).toEqual([
      5, 6, 7, 8, 4, 5, 6, 7,
    ]);
    expect(WEEK1_SECTIONS[6].measures[2].notes.map((note) => note.fret)).toEqual([
      7, 9, 8, 10, 6, 8, 7, 9,
    ]);
  });

  it("全部 28 个小节的品位序列与完整明细一致", () => {
    const expected = [
      [
        [5, 6, 7, 8, 5, 6, 7, 8],
        [8, 7, 6, 5, 8, 7, 6, 5],
        [5, 6, 7, 8, 8, 7, 6, 5],
        [5, 6, 7, 8, 8, 7, 6, 5],
      ],
      [
        [5, 7, 6, 8, 5, 7, 6, 8],
        [5, 7, 6, 8, 5, 7, 6, 8],
        [8, 6, 7, 5, 8, 6, 7, 5],
        [8, 6, 7, 5, 8, 6, 7, 5],
      ],
      [
        [5, 6, 5, 7, 5, 8, 5, 7],
        [5, 6, 5, 7, 5, 8, 5, 7],
        [8, 7, 8, 6, 8, 5, 8, 6],
        [8, 7, 8, 6, 8, 5, 8, 6],
      ],
      [
        [5, 6, 7, 5, 6, 7, 6, 7, 8, 6, 7, 8],
        [8, 7, 6, 8, 7, 6, 7, 6, 5, 7, 6, 5],
        [5, 6, 7, 6, 7, 8, 8, 7, 6, 7, 6, 5],
        [5, 6, 7, 6, 7, 8, 8, 7, 6, 7, 6, 5],
      ],
      [
        [5, 6, 7, 5, 6, 7, 5, 6, 7, 5, 6, 7, 5, 6, 7, 5],
        [7, 5, 6, 7, 5, 6, 7, 8, 8, 7, 6, 8, 7, 6, 8, 7],
        [8, 7, 6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 8],
        [6, 8, 7, 6, 8, 7, 6, 8, 7, 6, 5, 7, 6, 5, 4, 5],
      ],
      [
        [5, 6, 7, 8, 6, 7, 8, 9],
        [5, 6, 7, 8, 4, 5, 6, 7],
        [8, 7, 6, 5, 9, 8, 7, 6],
        [8, 7, 6, 5, 7, 6, 5, 4],
      ],
      [
        [5, 7, 6, 8, 4, 6, 5, 7],
        [5, 7, 6, 8, 6, 8, 7, 9],
        [7, 9, 8, 10, 6, 8, 7, 9],
        [5, 7, 6, 8, 4, 6, 5, 7],
      ],
    ];

    const actual = WEEK1_SECTIONS.map((section) =>
      section.measures.map((measure) => measure.notes.map((note) => note.fret)),
    );
    expect(actual).toEqual(expected);
  });

  it("周四末拍、周五与周六的指法按明细保留", () => {
    const fingerStrings = WEEK1_SECTIONS.slice(4).map((section) =>
      section.measures.map((measure) =>
        measure.notes.map((note) => note.finger).join(""),
      ),
    );

    expect(fingerStrings).toEqual([
      ["食中名食中名食中名食中名食中名食", "名食中名食中名小小名中小名中小名", "小名中小名中小名中小名中小名中小", "中小名中小名中小名中食名中食食食"],
      ["食中名小食中名小", "食中名小食中名小", "小名中食小名中食", "小名中食小名中食"],
      ["食名中小食名中小", "食名中小食名中小", "食名中小食名中小", "食名中小食名中小"],
    ]);
  });

  it("品位能推导出吉他低八度记谱的音高", () => {
    expect(deriveTabPitch(6, 5)).toMatchObject({
      staffName: "A",
      staffOctave: 3,
      staffMidi: 57,
    });
    expect(deriveTabPitch(6, 8)).toMatchObject({
      staffName: "C",
      staffOctave: 4,
      staffMidi: 60,
    });
  });
});

describe("TAB 符杠分组", () => {
  const note = (duration: TabNote["duration"]): TabNote => ({
    string: 6,
    fret: 5,
    duration,
  });

  it("八分音符每四个一组", () => {
    const groups = groupNotesForRhythm(Array.from({ length: 8 }, () => note("8")));
    expect(groups.map((group) => group.notes.length)).toEqual([4, 4]);
    expect(groups.every((group) => group.beams === 1 && !group.triplet)).toBe(true);
  });

  it("三连音每三个一组", () => {
    const groups = groupNotesForRhythm(Array.from({ length: 12 }, () => note("8t")));
    expect(groups.map((group) => group.notes.length)).toEqual([3, 3, 3, 3]);
    expect(groups.every((group) => group.triplet)).toBe(true);
  });

  it("十六分音符画双符杠，四分音符不画符杠", () => {
    const sixteenths = groupNotesForRhythm(Array.from({ length: 4 }, () => note("16")));
    expect(sixteenths[0].beams).toBe(2);
    expect(groupNotesForRhythm([note("q")])[0].beams).toBe(0);
  });
});

describe("TAB 谱面", () => {
  const section = WEEK1_SECTIONS[0];
  const html = renderToStaticMarkup(
    createElement(TabStaff, {
      measures: section.measures,
      bpm: section.bpm,
      cdStart: section.cdStart,
      title: "每日必弹 TAB 谱",
    }),
  );

  it("有曲谱标题、速度、拍号与 CD 时间", () => {
    expect(html).toContain("<title>每日必弹 TAB 谱：4 小节，速度每分钟 100 拍</title>");
    expect(html).toContain("CD 0:00~");
    expect(html).toContain("♩ = 100");
    expect(html).toContain("4/4 拍");
    expect(html).toContain("4 小节");
  });

  it("六线谱按四小节渲染，每小节六条弦线", () => {
    expect(html.match(/opacity="0\.55"/g)).toHaveLength(24);
  });

  it("读屏能拿到逐小节的品位说明", () => {
    expect(html).toContain("第 1 小节：6 弦 5、6、7、8、5、6、7、8 品");
    expect(html).toContain("第 2 小节：6 弦 8、7、6、5、8、7、6、5 品");
    expect(html).toContain("第 4 小节：6 弦 5、6、7、8、8、7、6、5 品");
  });

  it("品位、指法与标准调弦都渲染出来，音位本身不进入 tab 序列", () => {
    expect(html).toContain(">5</text>");
    expect(html).toContain(">食</text>");
    for (const tuning of ["E", "B", "G", "D", "A"]) {
      expect(html).toContain(`>${tuning}</text>`);
    }
    expect(html).not.toMatch(/<(circle|g)[^>]*tabindex/i);
  });

  it("谱面是静态图，滚动容器负责键盘横向浏览", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toMatch(/<svg[^>]*tabindex/i);
  });
});

/** 从静态标记里取出符干（组件给符干打了 `tab-stem` 标记）。 */
function stemLines(markup: string): { x1: number; y1: number; x2: number; y2: number }[] {
  return [...markup.matchAll(/<line\b[^>]*class="tab-stem"[^>]*>/g)].map(([tag]) => {
    const read = (name: string) => Number(new RegExp(`${name}="(-?[\\d.]+)"`).exec(tag)?.[1]);
    return { x1: read("x1"), y1: read("y1"), x2: read("x2"), y2: read("y2") };
  });
}

describe("符杠与品位数字连成一体", () => {
  const section = WEEK1_SECTIONS[0];
  const html = renderToStaticMarkup(
    createElement(TabStaff, { measures: section.measures, bpm: section.bpm }),
  );
  const stems = stemLines(html);
  const lowE = tabStringY(0, 6);
  const beamRow = tabBeamRowY(lowE);
  const stem = tabStemSpan({ stringY: lowE, fontSize: TAB_LAYOUT.noteFontSize, beamY: beamRow });

  it("每个音符都有一条符干，上端在符杠行", () => {
    expect(stems).toHaveLength(32);
    expect(stems.every((line) => line.y1 === beamRow)).toBe(true);
  });

  it("符干下端贴着品位数字，不是悬在谱面顶部", () => {
    expect(stems.every((line) => line.y2 === stem.bottom)).toBe(true);
    // 数字在 6 弦上，符干必须一直画到它上面
    expect(stem.bottom).toBeGreaterThan(lowE - 14);
    expect(stem.bottom).toBeLessThan(lowE);
  });

  it("符杠不高于谱表，低把位练习的节奏符号就在数字上方", () => {
    expect(beamRow).toBeGreaterThan(TAB_LAYOUT.staffTop);
    expect(beamRow).toBeLessThan(lowE);
  });
});

describe("跨弦的谱面", () => {
  const notes: TabNote[] = [1, 2, 3, 4, 5, 6].map((string) => ({
    string: string as TabNote["string"],
    fret: 0,
    duration: "8",
  }));
  const html = renderToStaticMarkup(createElement(TabStaff, { measures: [{ notes }], bpm: 90 }));
  const stems = stemLines(html);
  const beamRow = tabBeamRowY(tabStringY(0, 1));

  it("每根弦上的音符都有自己的符干，从符杠落到各自的数字", () => {
    expect(stems).toHaveLength(6);
    expect(stems.every((line) => line.y1 === beamRow)).toBe(true);

    const bottoms = stems.map((line) => line.y2).sort((a, b) => a - b);
    const expected = [1, 2, 3, 4, 5, 6].map(
      (string) =>
        tabStemSpan({
          stringY: tabStringY(0, string),
          fontSize: TAB_LAYOUT.noteFontSize,
          beamY: beamRow,
        }).bottom,
    );
    for (const bottom of bottoms) expect(expected).toContain(bottom);
  });

  it("音符高到一弦时，符杠让到谱表上方", () => {
    expect(beamRow).toBeLessThan(TAB_LAYOUT.staffTop);
  });
});

describe("第 1 周 widget", () => {
  const html = renderToStaticMarkup(createElement(WeekOneTabDrill));

  it("七段练习都有标题、要求与提示", () => {
    for (const title of [
      "每日必弹",
      "周一 · 交错换指",
      "周二 · 固定基准指",
      "周三 · 三连音",
      "周四 · 三音循环",
      "周五 · 移动一个品格",
      "周六 · 移动两个品格",
    ]) {
      expect(html).toContain(`>${title}</h3>`);
    }
    expect(html).toContain("食指 → 无名指 → 中指 → 小指，再按相反顺序倒回");
    expect(html).toContain("别「手忙脚乱」");
    expect(html).toContain("请使用拨片上下交替拨弦");
    expect(html).toContain("最后一小节 6→5→4→5 含一次把位移动");
  });

  it("七段练习各有一份 TAB 谱，三连音与重音都有谱面标记", () => {
    expect(html.match(/class="[^"]*rounded-card/g)).toHaveLength(1);
    expect(html.match(/role="region"/g)).toHaveLength(7);
    // 周三第一小节有 4 组三连音
    const tripletMeasure = renderToStaticMarkup(
      createElement(TabStaff, {
        measures: WEEK1_SECTIONS[3].measures.slice(0, 1),
        bpm: 100,
      }),
    );
    expect(tripletMeasure.match(/>3<\/text>/g)).toHaveLength(4);

    // 周四每小节六个重音，最后一小节另有“移”标记
    expect(html.match(/&gt;<\/text>/g)).toHaveLength(24);
    expect(html.match(/>移<\/text>/g)).toHaveLength(1);
  });
});

describe("空小节", () => {
  const html = renderToStaticMarkup(createElement(TabStaff, { measures: [{ notes: [] }], bpm: 90 }));

  it("不画出 NaN 坐标", () => {
    expect(html).not.toContain("NaN");
  });
});
