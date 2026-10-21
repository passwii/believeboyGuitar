import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BEND_UNITS,
  CAGED_SHAPES_BY_POSITION,
  FRET_COUNT,
  PATTERNS,
  STANDARD_TUNING,
  buildBendTargets,
  buildScaleNeckNotes,
  practicalChordVoicings,
} from "@/lib/guitar";
import { BPM_MAX, BPM_MIN, METERS, accentIndexes, tempoName } from "@/lib/metronome";
import {
  bendRows,
  cagedRows,
  chordRows,
  meterRows,
  scalePositionRows,
  tempoBands,
  tuningRows,
} from "@/lib/cheatsheet";
import { CheatsheetTable } from "@/components/CheatsheetTable";
import { CheatsheetTuning } from "@/components/CheatsheetTuning";

/**
 * 速查页的守护。
 *
 * 这一页的价值全在数字可信，所以测试盯的是两件事：
 * 1. **数据来源**：页面上出现的每个音位、品位、速度区间，都能从
 *    lib/guitar.ts 与 lib/metronome.ts 的现有导出重新算一遍；
 * 2. **结构**：折叠区块用原生 details/summary，表格有 caption 与行标题，
 *    宽表自己横向滚动。
 */

const root = process.cwd();

/** 七个区块组件 */
const CHEATSHEET_COMPONENTS = [
  "CheatsheetTuning",
  "CheatsheetScalePositions",
  "CheatsheetBendTargets",
  "CheatsheetCaged",
  "CheatsheetChords",
  "CheatsheetTempo",
  "CheatsheetMeters",
];

/* ==========================================================================
   数据来源
   ========================================================================== */

describe("调弦速查来自标准调弦", () => {
  const rows = tuningRows();

  it("六根弦的音名与 MIDI 音高与 STANDARD_TUNING 一致", () => {
    expect(rows).toHaveLength(STANDARD_TUNING.length);
    rows.forEach((row, index) => {
      const string = STANDARD_TUNING[index];
      expect(row.stringNumber).toBe(string.number);
      expect(row.openName).toBe(string.openName);
      expect(row.openMidi).toBe(string.openMidi);
    });
  });

  it("八度由 MIDI 音高推出，与中央 C = 60 一致", () => {
    const e4 = rows.find((row) => row.openNote === "E4");
    expect(e4?.openMidi).toBe(64);
    const e2 = rows.find((row) => row.stringNumber === 6);
    expect(e2?.openMidi).toBe(40);
  });

  it("音级与唱名对应 C 大调里该弦空弦的位置", () => {
    // 6 弦空弦 E2 是 C 大调的第 3 级 mi
    const lowE = rows.find((row) => row.stringNumber === 6);
    expect(lowE?.degree).toBe(3);
    expect(lowE?.degreeNote).toBe("E");
    expect(lowE?.solfege).toBe("mi");

    // 5 弦空弦 A2 是第 6 级 la
    const a = rows.find((row) => row.stringNumber === 5);
    expect(a?.degree).toBe(6);
    expect(a?.solfege).toBe("la");
  });
});

describe("音级速查来自 C 大调音阶", () => {
  const rows = scalePositionRows();

  it("七个音级各一行，音名与调式与 PATTERNS 一致", () => {
    expect(rows).toHaveLength(PATTERNS.length);
    rows.forEach((row, index) => {
      const pattern = PATTERNS[index];
      expect(row.degree).toBe(pattern.degree);
      expect(row.mode).toBe(pattern.mode);
      expect(row.modeZh).toBe(pattern.modeZh);
      expect(row.noteName).toBe(pattern.notes[0][0].name);
    });
  });

  it("每个品位都是真实可按的位置：音高等于空弦音高加品位", () => {
    for (const row of rows) {
      for (const cell of row.fretsByString) {
        const open = STANDARD_TUNING.find((s) => s.number === cell.stringNumber);
        expect(open).toBeDefined();
        for (const fret of cell.frets) {
          const midi = open!.openMidi + fret;
          const name = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][
            midi % 12
          ];
          expect(name, `${cell.stringNumber} 弦 ${fret} 品不是 ${row.noteName}`).toBe(
            row.noteName,
          );
        }
      }
    }
  });

  it("品位集合与 buildScaleNeckNotes 的结果一致（该弦空弦就是该音级时再加 0 品）", () => {
    const scaleNotes = buildScaleNeckNotes(FRET_COUNT, "major");
    const openDegree = new Map(
      STANDARD_TUNING.map((string) => [
        string.number,
        ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][
          string.openMidi % 12
        ],
      ]),
    );

    for (const row of rows) {
      for (const cell of row.fretsByString) {
        const fromScale = scaleNotes
          .filter(
            (note) =>
              note.stringNumber === cell.stringNumber && note.degree === row.degree,
          )
          .map((note) => note.fret)
          .sort((a, b) => a - b);

        // buildScaleNeckNotes 从第 1 品起算；空弦本身正好是该音级时才补上 0 品
        const expected =
          openDegree.get(cell.stringNumber) === row.noteName
            ? [0, ...fromScale]
            : fromScale;
        expect(cell.frets).toEqual(expected);
      }
    }
  });
});

describe("推弦速查来自 buildBendTargets", () => {
  const rows = bendRows();

  it("每一行的起音与目标音都能在 buildBendTargets 里找到", () => {
    const all = buildBendTargets(FRET_COUNT, "sharp");
    for (const row of rows) {
      const found = all.find(
        (target) =>
          target.stringNumber === row.stringNumber && target.fret === row.fret,
      );
      expect(found, `${row.stringNumber} 弦 ${row.fret} 品找不到`).toBeDefined();
      expect(found?.fromName).toBe(row.fromName);
      row.targets.forEach((target, index) => {
        const source = found!.targets[index];
        expect(target.name).toBe(source.name);
        expect(target.units).toBe(source.units);
        expect(target.targetFret).toBe(source.targetFret);
        expect(target.inKey).toBe(source.inKey);
      });
    }
  });

  it("推的档位就是 BEND_UNITS 定义的那几档", () => {
    for (const row of rows) {
      expect(row.targets.map((target) => target.units)).toEqual([...BEND_UNITS]);
    }
  });

  it("常用起音覆盖了 3 弦 0 / 2 / 3 品与 6 弦 0 品", () => {
    const keys = rows.map((row) => `${row.stringNumber}-${row.fret}`);
    expect(keys).toContain("6-0");
    expect(keys).toContain("3-0");
    expect(keys).toContain("3-2");
    expect(keys).toContain("3-3");
  });

  it("推 1 音等于目标高 1 品", () => {
    for (const row of rows) {
      const wholeTone = row.targets.find((target) => target.units === 1);
      expect(wholeTone?.targetFret).toBe(row.fret + 1);
    }
  });
});

describe("CAGED 速查来自形状推导", () => {
  const rows = cagedRows();

  it("五个形状与 CAGED_SHAPES_BY_POSITION 一一对应", () => {
    expect(rows).toHaveLength(CAGED_SHAPES_BY_POSITION.length);
    rows.forEach((row, index) => {
      const shape = CAGED_SHAPES_BY_POSITION[index];
      expect(row.name).toBe(shape.name);
      expect(row.baseFret).toBe(shape.baseFret);
      expect(row.minFret).toBe(shape.minFret);
      expect(row.maxFret).toBe(shape.maxFret);
      expect(row.origin).toBe(shape.origin);
      expect(row.rootNote).toBe(shape.rootNote);
    });
  });

  it("基准品位沿指板递增（C → A → G → E → D）", () => {
    const baseFrets = rows.map((row) => row.baseFret);
    for (let i = 1; i < baseFrets.length; i += 1) {
      expect(baseFrets[i]).toBeGreaterThan(baseFrets[i - 1]);
    }
  });

  it("每根弦的品位与形状的音位一致，空弦弦位为 null", () => {
    rows.forEach((row, index) => {
      const shape = CAGED_SHAPES_BY_POSITION[index];
      for (const cell of row.fretsByString) {
        const note = shape.notes.find((item) => item.stringNumber === cell.stringNumber);
        expect(cell.fret).toBe(note ? note.fret : null);
      }
    });
  });
});

describe("和弦速查来自 practicalChordVoicings", () => {
  const rows = chordRows();

  it("九个和弦覆盖要求的大调与小调", () => {
    expect(rows.map((row) => row.symbol)).toEqual([
      "C",
      "G",
      "D",
      "A",
      "E",
      "F",
      "Am",
      "Em",
      "Dm",
    ]);
  });

  it("指法与 practicalChordVoicings 给出的第一个音位一致", () => {
    for (const row of rows) {
      const typeId = row.symbol.endsWith("m") ? "minor" : "major";
      const root = typeId === "minor" ? row.symbol.slice(0, -1) : row.symbol;
      const voicings = practicalChordVoicings(root, typeId, {
        maxFret: FRET_COUNT,
        maxSpan: 4,
      });
      expect(row.voicing.length).toBe(voicings[0].notes.length);
      row.voicing.forEach((note, index) => {
        expect(note.stringNumber).toBe(voicings[0].notes[index].stringNumber);
        expect(note.fret).toBe(voicings[0].notes[index].fret);
        expect(note.name).toBe(voicings[0].notes[index].name);
      });
    }
  });

  it("每个指法位宽不超过 4 品，且最低音是根音", () => {
    for (const row of rows) {
      const frets = row.voicing.map((note) => note.fret);
      expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(4);
      expect(row.voicing[0].isRoot).toBe(true);
    }
  });

  it("小调的三音是降三度，不是大三度", () => {
    const am = rows.find((row) => row.symbol === "Am");
    expect(am?.voicing.map((note) => note.name)).toEqual(["A", "C", "E"]);
    const em = rows.find((row) => row.symbol === "Em");
    expect(em?.voicing.map((note) => note.name)).toEqual(["E", "G", "B"]);
  });
});

describe("速度术语速查来自 tempoName", () => {
  const bands = tempoBands();

  it("区间的上下限与 tempoName 的判定一致", () => {
    for (const band of bands) {
      expect(tempoName(band.min)).toBe(band.name);
      expect(tempoName(band.max)).toBe(band.name);
    }
  });

  it("覆盖整个可调范围且不重叠", () => {
    expect(bands[0].min).toBe(BPM_MIN);
    expect(bands[bands.length - 1].max).toBe(BPM_MAX);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i].min).toBe(bands[i - 1].max + 1);
    }
  });

  it("六个术语齐全", () => {
    expect(bands.map((band) => band.name)).toEqual([
      "Largo",
      "Adagio",
      "Andante",
      "Moderato",
      "Allegro",
      "Presto",
    ]);
  });
});

describe("重音模型速查来自 METERS", () => {
  const rows = meterRows();

  it("拍号与重音位置与节拍器的模型一致", () => {
    expect(rows).toHaveLength(METERS.length);
    rows.forEach((row, index) => {
      const meter = METERS[index];
      expect(row.label).toBe(meter.label);
      expect(row.beatsPerBar).toBe(meter.beatsPerBar);
      expect(row.beatUnit).toBe(meter.beatUnit);
      expect(row.accentBeats).toEqual(accentIndexes(meter).map((i) => i + 1));
    });
  });

  it("重音位置落在小节内，且第一个拍总是重音", () => {
    for (const row of rows) {
      expect(row.accentBeats.length).toBeGreaterThan(0);
      expect(row.accentBeats[0]).toBe(1);
      for (const beat of row.accentBeats) {
        expect(beat).toBeGreaterThanOrEqual(1);
        expect(beat).toBeLessThanOrEqual(row.beatsPerBar);
      }
    }
  });

  it("复合拍的重音不止一个：6/8 与 7/8 有多个重音", () => {
    const sixEight = rows.find((row) => row.label === "6/8");
    expect(sixEight?.accentBeats).toEqual([1, 4]);
    const sevenEight = rows.find((row) => row.label === "7/8");
    expect(sevenEight?.accentBeats).toEqual([1, 3, 5]);
  });
});

/* ==========================================================================
   结构与可访问性
   ========================================================================== */

describe("速查页的结构", () => {
  const pagePath = path.join(root, "app", "cheatsheet", "page.tsx");
  const pageSource = readFileSync(pagePath, "utf8");

  it("页面用原生 details/summary 折叠，不依赖 JS 状态", () => {
    const sectionSource = readFileSync(
      path.join(root, "components", "CheatsheetSection.tsx"),
      "utf8",
    );
    expect(sectionSource).toContain("<details");
    expect(sectionSource).toContain("<summary");
    expect(sectionSource).not.toContain("useState");
    expect(sectionSource).not.toContain("use client");
  });

  it("七个区块都挂在页面上", () => {
    for (const id of [
      "tuning",
      "scale-positions",
      "bend-targets",
      "caged",
      "chords",
      "tempo",
      "meters",
    ]) {
      expect(pageSource).toContain(`"${id}"`);
    }
  });

  it("顶部索引的锚点与区块 id 对应", () => {
    // 索引表里的 id 必须与各区块 details 的 id 一致，否则锚点会落空
    const sectionIds = [
      ...pageSource.matchAll(/\{ id: "([a-z-]+)", label:/g),
    ].map(([, id]) => id);
    expect(sectionIds).toEqual([
      "tuning",
      "scale-positions",
      "bend-targets",
      "caged",
      "chords",
      "tempo",
      "meters",
    ]);

    // 索引链接指向这些锚点
    expect(pageSource).toContain('href={`#${section.id}`}');

    // 每个区块组件都把同一个 id 传给了 details
    for (const [name, id] of [
      ["CheatsheetTuning", "tuning"],
      ["CheatsheetScalePositions", "scale-positions"],
      ["CheatsheetBendTargets", "bend-targets"],
      ["CheatsheetCaged", "caged"],
      ["CheatsheetChords", "chords"],
      ["CheatsheetTempo", "tempo"],
      ["CheatsheetMeters", "meters"],
    ] as const) {
      const source = readFileSync(
        path.join(root, "components", `${name}.tsx`),
        "utf8",
      );
      expect(source, name).toContain(`id="${id}"`);
    }
  });

  it("索引链接是可访问名明确的触控目标", () => {
    expect(pageSource).toContain("min-h-11");
    expect(pageSource).toContain('aria-label="速查区块索引"');
  });

  it("动效只用项目的那一条曲线，且时长在 150/200ms 两档内", () => {
    const files = [
      "app/cheatsheet/page.tsx",
      "components/CheatsheetSection.tsx",
      ...CHEATSHEET_COMPONENTS.map((name) => `components/${name}.tsx`),
    ];

    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      for (const match of source.matchAll(/transition-[a-z]+/g)) {
        // 有 transition 就必须同时用上项目的曲线
        expect(source, `${file}: ${match[0]} 缺少 ease-[var(--ease-standard)]`).toContain(
          "ease-[var(--ease-standard)]",
        );
      }
      // 不允许自造时长
      const durations = [...source.matchAll(/duration-(\d+)/g)].map(([, d]) => Number(d));
      for (const duration of durations) {
        expect([150, 200], `${file}: duration-${duration}`).toContain(duration);
      }
    }
  });
});

describe("速查组件的表格结构", () => {
  const components = CHEATSHEET_COMPONENTS;

  it("每个区块都渲染出带 caption 与行标题的表格", () => {
    for (const name of components) {
      const source = readFileSync(
        path.join(root, "components", `${name}.tsx`),
        "utf8",
      );
      expect(source, name).toContain("CheatsheetTable");
      expect(source, name).toContain("CheatsheetColumn");
    }
  });

  it("速查表的外壳提供 caption 与表头", () => {
    const html = renderToStaticMarkup(
      createElement(CheatsheetTable, { caption: "示例" }),
    );
    expect(html).toContain("<caption");
    expect(html).toContain('class="sr-only"');
  });

  it("宽表自己承担横向滚动，不靠外层容器", () => {
    const source = readFileSync(
      path.join(root, "components", "CheatsheetTable.tsx"),
      "utf8",
    );
    const tableTag = source.match(/<table[^>]*>/)?.[0] ?? "";
    expect(tableTag).toContain("overflow-x-auto");
  });
});

describe("速查区块渲染成原生折叠", () => {
  const html = renderToStaticMarkup(createElement(CheatsheetTuning));

  it("渲染出 details 与 summary", () => {
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  it("summary 里有可读的区块标题", () => {
    expect(html).toContain("调弦与音名对照");
  });

  it("表格带 caption 与列头、行头", () => {
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="col"/);
    expect(html).toMatch(/<th scope="row"/);
  });

  it("宽表自己横向滚动", () => {
    const tableTag = html.match(/<table[^>]*>/)?.[0] ?? "";
    expect(tableTag).toContain("overflow-x-auto");
  });
});
