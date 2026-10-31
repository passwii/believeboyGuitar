import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildScaleNotes, SCALE_PATHS } from "@/lib/fretboard-scale";

describe("六色指板音阶", () => {
  it("六条路径各有六组两音与回到起始弦的 AB", () => {
    const finalAb: Record<number, readonly [number, number]> = {
      1: [1, 5],
      2: [2, 10],
      3: [3, 2],
      4: [4, 7],
      5: [5, 12],
      6: [6, 5],
    };
    expect(SCALE_PATHS).toHaveLength(6);
    for (const path of SCALE_PATHS) {
      expect(path.notes).toHaveLength(14);
      const startString = path.notes[0][0];
      const [abString, abFret] = finalAb[startString];
      expect(path.notes.slice(-2)).toEqual([
        [abString, abFret],
        [abString, abFret + 2],
      ]);
    }
  });

  it("所有音位都属于 C 大调", () => {
    const notes = buildScaleNotes();
    expect(notes.length).toBeGreaterThan(30);
    for (const note of notes) {
      expect(note.degree).toBeGreaterThanOrEqual(1);
      expect(note.degree).toBeLessThanOrEqual(7);
    }
  });

  it("一弦画在最上方，六弦画在最下方", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "FretboardScale.tsx"),
      "utf8",
    );
    expect(source).toContain("30 + (stringNumber - 1) * 31");
    expect(source).toContain('const STRINGS = [1, 2, 3, 4, 5, 6]');
  });

  it("横屏按钮先请求全屏，再尝试锁定真实横屏", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "FretboardScale.tsx"),
      "utf8",
    );
    expect(source).toContain("requestFullscreen({ navigationUI: \"hide\" })");
    expect(source).toContain('orientation.lock("landscape")');
    expect(source).toContain("浏览器不支持方向锁定，已切换横屏布局");
    expect(source).toContain('document.addEventListener("fullscreenchange"');
  });
});
