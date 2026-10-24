import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChordLibrary } from "@/components/ChordLibrary";
import {
  CHORD_MAX_FRET,
  CHORD_MAX_SPAN,
  chordBoxWindow,
  chordSymbol,
  queryChordVoicings,
  stringCells,
  voicingSpan,
  voicingSuggestion,
} from "@/lib/chords";
import {
  CHORD_ROOTS,
  CHORD_TYPE_LIST,
  chordTypeById,
  practicalChordVoicings,
} from "@/lib/guitar";

/**
 * 和弦库页面的守护。
 *
 * 这一页最容易出的三类问题：
 * 1. 音位被写成硬编码的常量（指法表抄进代码里）——调弦一变就全错；
 * 2. 选项不全（少了某个根音或性质）；
 * 3. 页面上显示的东西与推导函数算出来的不一致。
 */

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("选项齐全", () => {
  const html = renderToStaticMarkup(createElement(ChordLibrary));

  it("12 个根音都有按钮", () => {
    for (const note of CHORD_ROOTS) {
      expect(html, `缺少根音 ${note}`).toContain(`>${note}</button>`);
    }
  });

  it("9 种性质都有按钮", () => {
    for (const type of CHORD_TYPE_LIST) {
      const symbol = chordSymbol("C", type);
      expect(html, `缺少性质 ${type.id}`).toContain(symbol);
      expect(html, `缺少性质名 ${type.label}`).toContain(type.label);
    }
  });

  it("默认就带转位：根音不一定是最低音", () => {
    // 转位开关默认打开，所以页面上应该能看到标记为「转位」的按法
    expect(html).toContain("转位");
  });

  it("根音与性质都用 aria-pressed 表达选中态", () => {
    expect(html).toMatch(/aria-pressed="true"/);
    expect(html).toMatch(/aria-pressed="false"/);
  });

  it("选择控件有可访问组名", () => {
    expect(html).toContain('aria-labelledby="chord-root-label"');
    expect(html).toContain('aria-labelledby="chord-type-label"');
  });
});

describe("音位来自推导函数", () => {
  it("页面查表的结果与 practicalChordVoicings 完全一致", () => {
    for (const note of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        const fromPage = queryChordVoicings({
          root: note,
          typeId: type.id,
          includeInversions: false,
        });
        const fromLib = practicalChordVoicings(note, type.id, {
          maxFret: CHORD_MAX_FRET,
          maxSpan: CHORD_MAX_SPAN,
          rootPositionOnly: true,
        });
        expect(fromPage.length, `${note} ${type.id} 音位数不一致`).toBe(fromLib.length);
        for (const [index, voicing] of fromPage.entries()) {
          expect(voicing.notes.map((n) => `${n.stringNumber}-${n.fret}`)).toEqual(
            fromLib[index].notes.map((n) => `${n.stringNumber}-${n.fret}`),
          );
        }
      }
    }
  });

  it("按法按最低音从低到高排列", () => {
    for (const note of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        const voicings = queryChordVoicings({
          root: note,
          typeId: type.id,
          includeInversions: true,
        });
        const bassMidis = voicings.map((v) => v.notes[0].midi);
        expect(bassMidis, `${note} ${type.id} 顺序不是从低到高`).toEqual(
          [...bassMidis].sort((a, b) => a - b),
        );
      }
    }
  });

  it("转位开关会带出最低音不是根音的按法", () => {
    let found = false;
    for (const note of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        const withInversions = queryChordVoicings({
          root: note,
          typeId: type.id,
          includeInversions: true,
        });
        if (withInversions.some((v) => !v.notes[0].isRoot)) found = true;
      }
    }
    expect(found, "转位按法一个都没出现，开关没有意义").toBe(true);
  });

  it("每个按法都满足位宽约束", () => {
    for (const note of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        for (const voicing of queryChordVoicings({
          root: note,
          typeId: type.id,
          includeInversions: true,
        })) {
          expect(voicingSpan(voicing), `${note} ${type.id} 位宽超了`).toBeLessThanOrEqual(
            CHORD_MAX_SPAN,
          );
        }
      }
    }
  });
});

describe("没有手抄的指法常量", () => {
  it("lib/chords.ts 里没有写死的「N 弦 M 品」", () => {
    const text = source("lib/chords.ts");
    const offenders = text.match(/\d+\s*弦\s*\d+\s*品/g) ?? [];
    expect(offenders, `lib/chords.ts 里有手抄的指法：${offenders.join(", ")}`).toEqual([]);
  });

  it("组件里没有写死的「N 弦 M 品」", () => {
    const text = source("components/ChordLibrary.tsx");
    const offenders = text.match(/\d+\s*弦\s*\d+\s*品/g) ?? [];
    expect(offenders, `组件里有手抄的指法：${offenders.join(", ")}`).toEqual([]);
  });

  it("组件不自带音位表：根音与性质都来自 lib/guitar.ts", () => {
    const text = source("components/ChordLibrary.tsx");
    expect(text).toContain("CHORD_ROOTS");
    expect(text).toContain("CHORD_TYPE_LIST");
    expect(text).toContain("queryChordVoicings");
  });
});

describe("和弦记号", () => {
  it("记号由音级记号推出，与常用写法一致", () => {
    expect(chordSymbol("C", chordTypeById("major"))).toBe("C");
    expect(chordSymbol("C", chordTypeById("minor"))).toBe("Cm");
    expect(chordSymbol("C", chordTypeById("diminished"))).toBe("Cdim");
    expect(chordSymbol("C", chordTypeById("augmented"))).toBe("Caug");
    expect(chordSymbol("C", chordTypeById("dominant7"))).toBe("C7");
    expect(chordSymbol("C", chordTypeById("major7"))).toBe("Cmaj7");
    expect(chordSymbol("C", chordTypeById("minor7"))).toBe("Cm7");
    expect(chordSymbol("C", chordTypeById("halfDiminished7"))).toBe("Cm7♭5");
    expect(chordSymbol("C", chordTypeById("diminished7"))).toBe("Cdim7");
  });

  it("每种性质都有对应记号，没有漏写的", () => {
    // 大三和弦的记号就是根音本身（没有后缀），其他性质必须带后缀
    for (const type of CHORD_TYPE_LIST) {
      const symbol = chordSymbol("C", type);
      if (type.id === "major") {
        expect(symbol).toBe("C");
        continue;
      }
      expect(symbol, `性质 ${type.id} 的记号没有后缀`).not.toBe("C");
      expect(symbol.startsWith("C")).toBe(true);
    }
  });
});

describe("按法图与速查", () => {
  it("六根弦的格子按 6→1 排，根音被标出来", () => {
    const [voicing] = queryChordVoicings({
      root: "C",
      typeId: "major",
      includeInversions: false,
    });
    const cells = stringCells(voicing);
    expect(cells.map((cell) => cell.stringNumber)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(cells.filter((cell) => cell.fret !== null).length).toBe(voicing.notes.length);
    expect(cells.filter((cell) => cell.isRoot).length).toBe(1);
  });

  it("空弦按法留出琴枕行", () => {
    const voicings = queryChordVoicings({
      root: "C",
      typeId: "major",
      includeInversions: false,
    });
    const window = chordBoxWindow(voicings[0]);
    expect(window.hasOpenStrings).toBe(true);
    expect(window.rows).toBeGreaterThanOrEqual(4);
  });

  it("非空弦按法从最低的那一品画起", () => {
    // G 大三的根部按法含空弦，换成不含空弦的一个来验
    const voicings = queryChordVoicings({
      root: "G",
      typeId: "major7",
      includeInversions: true,
    });
    const noOpen = voicings.filter(
      (voicing) => voicing.notes.every((note) => note.fret > 0),
    );
    expect(noOpen.length).toBeGreaterThan(0);
    const window = chordBoxWindow(noOpen[0]);
    expect(window.hasOpenStrings).toBe(false);
    const min = Math.min(...noOpen[0].notes.map((n) => n.fret));
    expect(window.start).toBe(min);
    expect(window.end).toBeGreaterThanOrEqual(
      Math.max(...noOpen[0].notes.map((n) => n.fret)),
    );
  });

  it("每个按法都给出一句场景建议", () => {
    for (const note of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        for (const voicing of queryChordVoicings({
          root: note,
          typeId: type.id,
          includeInversions: true,
        })) {
          const text = voicingSuggestion(voicing);
          expect(text.length, `${note} ${type.id} 没有建议`).toBeGreaterThan(8);
          expect(text.endsWith("。")).toBe(true);
        }
      }
    }
  });
});

describe("页面外壳", () => {
  it("路由页面存在并写了标题", () => {
    const text = source("app/tools/chords/page.tsx");
    expect(text).toContain("ChordLibrary");
    expect(text).toContain("和弦库");
    expect(text).toContain("shell");
  });

  it("说明区讲了「怎么算出来的」与「练之前核对」", () => {
    const html = renderToStaticMarkup(createElement(ChordLibrary));
    expect(html).toContain("这里的按法是怎么算出来的");
    expect(html).toContain("不是抄的指法表");
    expect(html).toContain("在自己的琴上核对");
  });

  it("窄屏不产生横向溢出：宽表自己滚动", () => {
    const text = source("components/ChordLibrary.tsx");
    // 按法图不是 <table>，而是自带 overflow-x-auto 的网格；
    // 页面里若出现 <table>，它必须自己承担横向滚动
    for (const tag of text.match(/<table[^>]*>/g) ?? []) {
      expect(tag, "表格没有自己横向滚动").toMatch(/overflow-x-auto/);
    }
    // 横向滚动的容器都带 overscroll-x-contain，滑动不会带动整页
    const scrollers = text.match(/overflow-x-auto[^"]*"/g) ?? [];
    expect(scrollers.length).toBeGreaterThan(0);
    for (const scroller of scrollers) {
      expect(scroller).toContain("overscroll-x-contain");
    }
  });
});
