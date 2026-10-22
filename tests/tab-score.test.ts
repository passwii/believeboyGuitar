import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TabExercise } from "@/components/TabExercise";
import { TabStaff } from "@/components/TabStaff";
import { deriveTabPitch, groupNotesForRhythm, type TabNote } from "@/lib/tab";
import { FRET_TO_FINGER, WEEK1_SECTIONS } from "@/lib/tab-exercises";

describe("第 1 周曲谱数据", () => {
  it("四条练习各四小节，音符都在 6 弦 5–8 品", () => {
    expect(WEEK1_SECTIONS.map((section) => section.id)).toEqual([
      "daily",
      "monday",
      "tuesday",
      "wednesday",
    ]);

    for (const section of WEEK1_SECTIONS) {
      expect(section.measures).toHaveLength(4);
      for (const measure of section.measures) {
        expect(measure.notes.length).toBeGreaterThan(0);
        for (const note of measure.notes) {
          expect(note.string).toBe(6);
          expect(note.fret).toBeGreaterThanOrEqual(5);
          expect(note.fret).toBeLessThanOrEqual(8);
          expect(note.finger).toBe(FRET_TO_FINGER[note.fret as 5 | 6 | 7 | 8]);
        }
      }
    }
  });

  it("每日必弹、周一、周二各 32 个八分音符，周三 48 个三连音", () => {
    expect(WEEK1_SECTIONS[0].measures.flatMap((m) => m.notes)).toHaveLength(32);
    expect(WEEK1_SECTIONS[1].measures.flatMap((m) => m.notes)).toHaveLength(32);
    expect(WEEK1_SECTIONS[2].measures.flatMap((m) => m.notes)).toHaveLength(32);
    expect(WEEK1_SECTIONS[3].measures.flatMap((m) => m.notes)).toHaveLength(48);

    expect(
      WEEK1_SECTIONS[3].measures
        .flatMap((m) => m.notes)
        .every((note) => note.duration === "8t"),
    ).toBe(true);
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

  it("品位与指法都渲染出来，音位本身不进入 tab 序列", () => {
    expect(html).toContain(">5</text>");
    expect(html).toContain(">食</text>");
    expect(html).not.toMatch(/<(circle|g)[^>]*tabindex/i);
  });

  it("谱面是静态图，滚动容器负责键盘横向浏览", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toMatch(/<svg[^>]*tabindex/i);
  });
});

describe("第 1 周 widget", () => {
  const html = renderToStaticMarkup(createElement(TabExercise));

  it("四条练习都有标题、要求与提示", () => {
    for (const title of ["每日必弹", "周一", "周二", "周三"]) {
      expect(html).toContain(`>${title}</h3>`);
    }
    expect(html).toContain("食指 → 无名指 → 中指 → 小指");
    expect(html).toContain("别「手忙脚乱」");
    expect(html).toContain("请使用拨片上下交替拨弦");
  });

  it("每条练习都有一份 TAB 谱，三连音小节画出 3 的标记", () => {
    expect(html.match(/class="[^"]*rounded-card/g)).toHaveLength(1);
    expect(html.match(/role="region"/g)).toHaveLength(4);
    // 周三第一小节有 4 组三连音
    const tripletMeasure = renderToStaticMarkup(
      createElement(TabStaff, {
        measures: WEEK1_SECTIONS[3].measures.slice(0, 1),
        bpm: 100,
      }),
    );
    expect(tripletMeasure.match(/>3<\/text>/g)).toHaveLength(4);
  });
});
