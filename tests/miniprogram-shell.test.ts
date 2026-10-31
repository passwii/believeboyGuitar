import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("mini program shell", () => {
  it("has exactly the metronome and tuner tabs", () => {
    const app = JSON.parse(read("miniprogram/app.json"));
    expect(app.pages).toEqual([
      "pages/metronome/index",
      "pages/tuner/index",
    ]);
    expect(app.tabBar.list.map((item: { text: string }) => item.text)).toEqual([
      "节拍器",
      "调音器",
    ]);
  });

  it("uses native TypeScript compilation and base library 2.19.0", () => {
    const project = JSON.parse(read("miniprogram/project.config.json"));
    expect(project.setting.useCompilerPlugins).toContain("typescript");
    expect(project.libVersion).toBe("2.19.0");
  });
});
