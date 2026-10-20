import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 模块边界的守护测试。
 *
 * 背景：`lib/guitar.ts`、`lib/content-sections.ts`、`content/manifest.ts` 里
 * 曾有一批「只在本文件内使用却写成 export」的符号。它们不会被 `tsc` 报错，
 * 但会让读者误以为存在外部契约，也让 knip 之类工具持续报警。
 *
 * 这组测试把「哪些符号是模块私有」固化下来：如果以后有人重新加回 `export`，
 * 测试会提醒他要么接上真实调用方，要么保持私有。
 */

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exportedNames(relativePath: string): string[] {
  return [...source(relativePath).matchAll(/^export\s+(?:const|function|type|interface)\s+([A-Za-z0-9_]+)/gm)].map(
    ([, name]) => name,
  );
}

describe("模块私有符号不应重新导出", () => {
  // 这些符号只被各自模块内部使用（2026-10-18 收敛）
  const PRIVATE = {
    "lib/guitar.ts": [
      "NOTE_NAMES",
      "NoteName",
      "C_MAJOR_SEMITONES",
      "pitchClass",
      "noteName",
      "scaleDegree",
      "noteWithOctave",
      "Mode",
      "MODES",
      "PatternNote",
      "buildPattern",
    ],
    "lib/content-sections.ts": ["isWidgetName"],
    "content/manifest.ts": ["Difficulty"],
  };

  for (const [file, names] of Object.entries(PRIVATE)) {
    it(`${file} 不再导出模块私有符号`, () => {
      const exported = exportedNames(file);
      const leaked = names.filter((name) => exported.includes(name));
      expect(leaked, `${file} 又导出了：${leaked.join(", ")}`).toEqual([]);
    });
  }
});

describe("跨模块契约仍然导出", () => {
  it("lib/guitar.ts 保留真正被外部使用的入口", () => {
    const exported = exportedNames("lib/guitar.ts");
    for (const name of ["STANDARD_TUNING", "FRET_COUNT", "PATTERNS", "buildNeckNotes", "patternKeys"]) {
      expect(exported).toContain(name);
    }
  });

  it("lib/content-sections.ts 保留正文拆分入口", () => {
    const exported = exportedNames("lib/content-sections.ts");
    for (const name of ["splitContentSections", "stripArticleWrapper", "widgetMarkerNames"]) {
      expect(exported).toContain(name);
    }
  });
});

describe("被测试与页面共用的模块不会被误判为死文件", () => {
  it("lib/sanitize-content.ts 同时被页面与测试引用", () => {
    const consumers = ["app", "components", "tests"].flatMap((dir) =>
      readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
        .filter((name) => /\.(tsx?)$/.test(name))
        .map((name) => path.join(root, dir, name)),
    );

    const referencing = consumers.filter((file) =>
      readFileSync(file, "utf8").includes("@/lib/sanitize-content"),
    );

    const hasPage = referencing.some((file) => file.startsWith(path.join(root, "app")));
    const hasTest = referencing.some((file) => file.startsWith(path.join(root, "tests")));
    expect(hasPage, "缺少页面引用").toBe(true);
    expect(hasTest, "缺少测试引用").toBe(true);
  });
});
