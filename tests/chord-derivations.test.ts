import { describe, expect, it } from "vitest";
import {
  CHORD_ROOTS,
  CHORD_TYPE_LIST,
  buildChordVoicings,
  chordTypeById,
  practicalChordVoicings,
  rootPitchClass,
  spellNote,
} from "@/lib/guitar";

/**
 * 和弦音位推导的守护。
 *
 * 这部分最容易出错的地方有三个，都是本轮实际踩过的：
 * 1. 音名拼写必须跟着「级」走——G 大七的七级是 F♯，不是 Gb；
 * 2. 音位必须完整——三和弦三个音、七和弦四个音，一个都不能少；
 * 3. 音名拼写里的升降号数量要对应音高差。
 */

describe("和弦性质", () => {
  it("每种性质的音程组合符合乐理", () => {
    expect(chordTypeById("major").semitones).toEqual([0, 4, 7]);
    expect(chordTypeById("minor").semitones).toEqual([0, 3, 7]);
    expect(chordTypeById("diminished").semitones).toEqual([0, 3, 6]);
    expect(chordTypeById("augmented").semitones).toEqual([0, 4, 8]);
    expect(chordTypeById("dominant7").semitones).toEqual([0, 4, 7, 10]);
    expect(chordTypeById("major7").semitones).toEqual([0, 4, 7, 11]);
    expect(chordTypeById("minor7").semitones).toEqual([0, 3, 7, 10]);
    expect(chordTypeById("halfDiminished7").semitones).toEqual([0, 3, 6, 10]);
    expect(chordTypeById("diminished7").semitones).toEqual([0, 3, 6, 9]);
  });

  it("每种性质的音级记号数量与音数一致", () => {
    for (const type of CHORD_TYPE_LIST) {
      expect(type.degreeLabels).toHaveLength(type.semitones.length);
      expect(type.size).toBe(type.semitones.length);
    }
  });

  it("根音到音高类的映射正确", () => {
    expect(rootPitchClass("C")).toBe(0);
    expect(rootPitchClass("F#")).toBe(6);
    expect(rootPitchClass("Bb")).toBe(10);
    expect(rootPitchClass("H")).toBeNull();
  });
});

describe("和弦音位", () => {
  it("C 大三和弦包含开放 C 的按法（3 弦 0 品 / 5 弦 3 品 / 4 弦 2 品）", () => {
    const voicings = buildChordVoicings("C", "major", 12);
    const open = voicings.find(
      (v) =>
        v.notes.length === 3 &&
        v.notes.some((n) => n.stringNumber === 5 && n.fret === 3) &&
        v.notes.some((n) => n.stringNumber === 3 && n.fret === 0),
    );
    expect(open).toBeDefined();
    expect(open?.notes.map((n) => n.name).sort()).toEqual(["C", "E", "G"]);
  });

  it("C 小三和弦的三音是 E♭ 而不是 E", () => {
    const voicings = buildChordVoicings("C", "minor", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const names = v.notes.map((n) => n.name);
      expect(names).toContain("E♭");
      expect(names).not.toContain("E");
    }
  });

  it("C 属七和弦的音是 C E G B♭", () => {
    const voicings = buildChordVoicings("C", "dominant7", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      expect(v.notes.map((n) => n.name).sort()).toEqual(["B♭", "C", "E", "G"]);
    }
  });

  it("C 减三和弦的音是 C E♭ G♭", () => {
    const voicings = buildChordVoicings("C", "diminished", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      expect(v.notes.map((n) => n.name).sort()).toEqual(["C", "E♭", "G♭"]);
    }
  });

  it("G 大七和弦的七级是 F♯ 而不是 G♭", () => {
    const voicings = buildChordVoicings("G", "major7", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const names = v.notes.map((n) => n.name);
      expect(names).toContain("F♯");
      expect(names).not.toContain("G♭");
      expect(names).toContain("B"); // 三级是 B，不是 C
    }
  });

  it("F 大三和弦的三音是 A（不是 B♭）", () => {
    const voicings = buildChordVoicings("F", "major", 12);
    for (const v of voicings) {
      expect(v.notes.map((n) => n.name)).toContain("A");
    }
  });

  it("A 小七和弦是 A C E G", () => {
    const voicings = buildChordVoicings("A", "minor7", 12);
    for (const v of voicings) {
      expect(v.notes.map((n) => n.name).sort()).toEqual(["A", "C", "E", "G"]);
    }
  });

  it("每个音位的音数正确，且每根弦只按一个音", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        const voicings = buildChordVoicings(root, type.id, 12);
        for (const v of voicings) {
          expect(v.notes, `${root} ${type.id}`).toHaveLength(type.size);
          const strings = v.notes.map((n) => n.stringIndex);
          expect(new Set(strings).size, `${root} ${type.id} 同一根弦按了两个音`).toBe(
            strings.length,
          );
        }
      }
    }
  });

  it("每个音位都包含根音", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        for (const v of buildChordVoicings(root, type.id, 12)) {
          expect(v.notes.some((n) => n.isRoot), `${root} ${type.id} 缺根音`).toBe(true);
        }
      }
    }
  });

  it("音位里的音都在标准调弦范围内", () => {
    for (const v of buildChordVoicings("C", "major7", 15)) {
      for (const n of v.notes) {
        expect(n.fret).toBeGreaterThanOrEqual(0);
        expect(n.fret).toBeLessThanOrEqual(15);
        expect(n.stringNumber).toBeGreaterThanOrEqual(1);
        expect(n.stringNumber).toBeLessThanOrEqual(6);
      }
    }
  });

  it("全量推导包含低把位音位（开放和弦类）", () => {
    // buildChordVoicings 是全量推导，不做筛选；
    // 排序偏好在 practicalChordVoicings 里。
    const voicings = buildChordVoicings("C", "major", 12);
    expect(Math.min(...voicings.map((v) => v.bassFret))).toBeLessThanOrEqual(3);
    expect(voicings.length).toBeGreaterThan(10);
  });
});

describe("实用音位筛选", () => {
  it("C 大三只留一个形状：标准开放 C", () => {
    const voicings = practicalChordVoicings("C", "major", { maxFret: 12, maxSpan: 4 });
    expect(voicings).toHaveLength(1);
    const v = voicings[0];
    expect(v.notes.map((n) => `${n.stringNumber}弦${n.fret}品${n.name}`)).toEqual([
      "5弦3品C",
      "4弦2品E",
      "3弦0品G",
    ]);
  });

  it("C 小三的形状是 Eb 而不是 E", () => {
    const voicings = practicalChordVoicings("C", "minor", { maxFret: 12, maxSpan: 4 });
    expect(voicings).toHaveLength(1);
    expect(voicings[0].notes.map((n) => n.name)).toEqual(["C", "E♭", "G"]);
  });

  it("位宽筛选生效：跨度不超过 maxSpan", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        for (const v of practicalChordVoicings(root, type.id, {
          maxFret: 12,
          maxSpan: 4,
        })) {
          const frets = v.notes.map((n) => n.fret);
          expect(
            Math.max(...frets) - Math.min(...frets),
            `${root} ${type.id} 位宽超了`,
          ).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("默认只留根音在最低音的音位", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        for (const v of practicalChordVoicings(root, type.id, { maxFret: 12 })) {
          expect(v.notes[0].isRoot, `${root} ${type.id} 最低音不是根音`).toBe(true);
        }
      }
    }
  });

  it("形状去重后，每个和弦的音位数量在合理范围", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        const count = practicalChordVoicings(root, type.id, {
          maxFret: 12,
          maxSpan: 4,
        }).length;
        expect(count, `${root} ${type.id} 音位数异常：${count}`).toBeGreaterThan(0);
        expect(count, `${root} ${type.id} 音位数过多：${count}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("每个根音都能算出至少一个实用音位", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        expect(
          practicalChordVoicings(root, type.id, { maxFret: 12, maxSpan: 4 }).length,
          `${root} ${type.id} 没有可用音位`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("音名拼写", () => {
  it("升号与降号两种拼写都可用", () => {
    expect(spellNote(66, "sharp")).toBe("F#");
    expect(spellNote(66, "flat")).toBe("Gb");
    expect(spellNote(60, "sharp")).toBe("C");
    expect(spellNote(61, "flat")).toBe("Db");
  });

  it("降号体系用降号拼法：C 减三的 ♭5 读 Gb 而不是 F♯", () => {
    const voicings = buildChordVoicings("C", "diminished", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      expect(v.notes.map((n) => n.name)).toContain("G♭");
      expect(v.notes.map((n) => n.name)).not.toContain("F♯");
    }
  });

  it("升号体系用升号拼法：C♯ 大三的三级读 E♯ 而不是 F", () => {
    const voicings = buildChordVoicings("C#", "major", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const names = v.notes.map((n) => n.name);
      expect(names).toContain("E♯");
      expect(names).not.toContain("F");
    }
  });

  it("大七的七级保留升号读法：G 大七是 F♯ 不是 Gb", () => {
    const voicings = buildChordVoicings("G", "major7", 12);
    expect(voicings.length).toBeGreaterThan(0);
    for (const v of voicings) {
      const names = v.notes.map((n) => n.name);
      expect(names).toContain("F♯");
      expect(names).not.toContain("Gb");
    }
  });

  it("不产出双记号（E♯♯ 这类）", () => {
    for (const root of CHORD_ROOTS) {
      for (const type of CHORD_TYPE_LIST) {
        for (const v of buildChordVoicings(root, type.id, 12)) {
          for (const n of v.notes) {
            expect(n.name, `${root} ${type.id} 出现双记号 ${n.name}`).not.toMatch(
              /[♯♭]{2}/,
            );
          }
        }
      }
    }
  });
});
