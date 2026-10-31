import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe("mini program boundaries", () => {
  it("keeps wx APIs out of guitar-core", () => {
    for (const path of files("packages/guitar-core/src")) {
      expect(readFileSync(path, "utf8")).not.toMatch(/\bwx\./);
    }
  });

  it("keeps React and Next out of the mini program", () => {
    for (const path of files("miniprogram")) {
      if (!/\.(ts|wxml|wxss)$/.test(path)) continue;
      expect(readFileSync(path, "utf8")).not.toMatch(/from ["']react|next\//);
    }
  });

  it("stops both tools on hide", () => {
    expect(readFileSync("miniprogram/pages/metronome/index.ts", "utf8")).toContain("onHide()");
    expect(readFileSync("miniprogram/pages/tuner/index.ts", "utf8")).toContain("onHide()");
  });
});
