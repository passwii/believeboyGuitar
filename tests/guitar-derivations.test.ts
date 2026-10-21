import { describe, expect, it } from "vitest";
import {
  BEND_UNITS,
  CAGED_SHAPES_BY_POSITION,
  STANDARD_TUNING,
  buildBendTargets,
  buildScaleNeckNotes,
  cagedShapeForName,
} from "@/lib/guitar";

/**
 * 音位推导的守护。
 *
 * 这些断言全部是「用调弦与音高算一遍」的结果，而不是抄来的常量。
 * 目的很具体：CLAUDE.md 要求「错一个音就练错」的内容必须由推导得出，
 * 所以推导本身也要有测试守着——改动调弦或音阶定义时，这里会先红。
 */

describe("指板音位由调弦推出", () => {
  it("C 大调音位落在正确的品位上", () => {
    const notes = buildScaleNeckNotes(15, "major");
    const c3 = notes.find(
      (note) => note.stringNumber === 6 && note.fret === 8 && note.name === "C",
    );
    expect(c3).toBeDefined();
    expect(c3?.midi).toBe(48); // C3

    // 6 弦空弦是 E2（40），3 品是 G2（43），不是 G3
    const g2 = notes.find(
      (note) => note.stringNumber === 6 && note.fret === 3 && note.name === "G",
    );
    expect(g2?.midi).toBe(43);
  });

  it("每个弦上 C 大调音级的相对位置与调弦一致", () => {
    const notes = buildScaleNeckNotes(12, "major");
    for (const note of notes) {
      const open = STANDARD_TUNING.find((s) => s.number === note.stringNumber);
      expect(open).toBeDefined();
      // 音高 = 空弦音高 + 品位，这是推导链的最后一环
      expect(note.midi).toBe(open!.openMidi + note.fret);
    }
  });

  it("布鲁斯音阶用降号拼写，且比大调多一个降五音", () => {
    const blues = buildScaleNeckNotes(12, "blues");
    const names = new Set(blues.map((note) => note.name));
    expect(names).toEqual(new Set(["C", "Eb", "F", "Gb", "G", "Bb"]));

    // 小调五声是布鲁斯音阶去掉降五音（Gb）
    const pentatonic = new Set(
      buildScaleNeckNotes(12, "minorPentatonic").map((note) => note.name),
    );
    expect(pentatonic).toEqual(new Set(["C", "Eb", "F", "G", "Bb"]));
  });

  it("每个音阶的根音在同一根弦上构成八度", () => {
    const notes = buildScaleNeckNotes(15, "blues");
    // 5 弦空弦是 A2（45），3 品是 C3，15 品是 C4
    const roots = notes.filter((note) => note.isRoot && note.stringNumber === 5);
    expect(roots.length).toBe(2);
    // 同一根弦上相邻的根音必须差 12 个半音
    for (let i = 1; i < roots.length; i += 1) {
      expect(roots[i].midi - roots[i - 1].midi).toBe(12);
    }
  });
});

describe("CAGED 五个形状", () => {
  it("CAGED 的名字顺序就是它们沿指板由低到高的顺序", () => {
    expect(CAGED_SHAPES_BY_POSITION.map((shape) => shape.name)).toEqual([
      "C",
      "A",
      "G",
      "E",
      "D",
    ]);
  });

  it("C 大调下五个形状的基准品位依次递增", () => {
    const frets = CAGED_SHAPES_BY_POSITION.map((shape) => shape.baseFret);
    for (let i = 1; i < frets.length; i += 1) {
      expect(frets[i]).toBeGreaterThan(frets[i - 1]);
    }
  });

  it("每个形状的根音都是 C", () => {
    for (const shape of CAGED_SHAPES_BY_POSITION) {
      const root = shape.notes.find((note) => note.isRoot);
      expect(root, `${shape.name} 形状没有根音`).toBeDefined();
      expect(root?.name).toBe("C");
    }
  });

  it("每个形状弹出来的音都是 C 大调里的音", () => {
    const majorPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const shape of CAGED_SHAPES_BY_POSITION) {
      for (const note of shape.notes) {
        expect(
          majorPitchClasses.has(((note.midi % 12) + 12) % 12),
          `${shape.name} 形状的 ${note.stringNumber} 弦 ${note.fret} 品不是大调音`,
        ).toBe(true);
      }
    }
  });

  it("C 形状的品位形状与开放 C 和弦一致（3 弦 2 品 / 5 弦 3 品）", () => {
    const c = cagedShapeForName("C");
    expect(c.baseFret).toBe(0);
    const fretByString = new Map(c.notes.map((n) => [n.stringNumber, n.fret]));
    expect(fretByString.get(5)).toBe(3); // 5 弦 3 品 = C
    expect(fretByString.get(4)).toBe(2); // 4 弦 2 品 = E
    expect(fretByString.get(3)).toBe(0); // 3 弦空弦 = G
    expect(fretByString.get(2)).toBe(1); // 2 弦 1 品 = C
    expect(fretByString.get(1)).toBe(0); // 1 弦空弦 = E
  });

  it("A 形状的品位形状与开放 A 和弦一致", () => {
    const a = cagedShapeForName("A");
    expect(a.baseFret).toBe(3);
    const fretByString = new Map(a.notes.map((n) => [n.stringNumber, n.fret]));
    expect(fretByString.get(5)).toBe(3);
    expect(fretByString.get(4)).toBe(5);
    expect(fretByString.get(3)).toBe(5);
    expect(fretByString.get(2)).toBe(5);
    expect(fretByString.get(1)).toBe(3);
  });

  it("五个形状的根音落在同一条「同名音」链上", () => {
    // CAGED 的几何：相邻两个形状在指板上首尾相接，根音落在同一条 C 链上。
    // 算出来的基准品位是 0 / 3 / 5 / 8 / 10 —— 这不是常量，是推导的结果。
    expect(CAGED_SHAPES_BY_POSITION.map((shape) => shape.baseFret)).toEqual([
      0, 3, 5, 8, 10,
    ]);

    // 相邻形状的根音音高相同或差一个八度（它们共享根音）
    const roots = CAGED_SHAPES_BY_POSITION.map((shape) => {
      const root = shape.notes.find((note) => note.isRoot)!;
      return root.midi;
    });
    for (let i = 1; i < roots.length; i += 1) {
      const gap = roots[i] - roots[i - 1];
      expect([0, 12]).toContain(gap);
    }
  });
});

describe("推弦目标音", () => {
  it("推 1 音（全音）等于目标高 1 品", () => {
    const targets = buildBendTargets(12, "sharp");
    const e2 = targets.find((t) => t.stringNumber === 6 && t.fret === 0);
    expect(e2).toBeDefined();
    const wholeTone = e2!.targets.find((t) => t.units === 1)!;
    expect(wholeTone.targetFret).toBe(1);
    // E 弦空弦是 E2，全音上去是 F#，不是 F
    expect(wholeTone.name).toBe("F#");
    expect(wholeTone.semitones).toBe(2);
  });

  it("推 2 音等于目标高 2 品", () => {
    const targets = buildBendTargets(12, "sharp");
    const e2 = targets.find((t) => t.stringNumber === 6 && t.fret === 0)!;
    const twoTones = e2.targets.find((t) => t.units === 2)!;
    expect(twoTones.targetFret).toBe(2);
    // 2 音 = 4 个半音：E2（40）+ 4 = 44 = G#，降号读法是 Ab
    expect(twoTones.name).toBe("G#");
    expect(twoTones.semitones).toBe(4);
  });

  it("E 弦空弦推 1 音到 F# 不在 C 大调里，推 1.5 音到 G 才是", () => {
    const targets = buildBendTargets(12, "sharp");
    const e2 = targets.find((t) => t.stringNumber === 6 && t.fret === 0)!;
    const wholeTone = e2.targets.find((t) => t.units === 1)!;
    const oneAndHalf = e2.targets.find((t) => t.units === 1.5)!;
    expect(wholeTone.name).toBe("F#");
    expect(wholeTone.inKey).toBe(false);
    expect(oneAndHalf.name).toBe("G");
    expect(oneAndHalf.inKey).toBe(true);
  });

  it("降号拼写下同一个音高读法不同", () => {
    const sharp = buildBendTargets(12, "sharp");
    const flat = buildBendTargets(12, "flat");
    const sharpTarget = sharp.find((t) => t.stringNumber === 6 && t.fret === 0)!.targets.find(
      (t) => t.units === 1,
    )!;
    const flatTarget = flat.find((t) => t.stringNumber === 6 && t.fret === 0)!.targets.find(
      (t) => t.units === 1,
    )!;
    expect(sharpTarget.name).toBe("F#");
    expect(flatTarget.name).toBe("Gb");
    // 音高不变，只是读法不同
    expect(sharpTarget.semitones).toBe(flatTarget.semitones);
  });

  it("可用的推弦量就是定义的那几档", () => {
    expect(BEND_UNITS).toEqual([0.5, 1, 1.5, 2]);
  });
});
