import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 宽表与横向滚动的守护。
 *
 * DESIGN.md §6：「表格在窄屏内部横向滚动，页面本身不产生横向溢出」。
 * 踩过的坑：表格用 `display: table` 时宽度由内容决定，
 * 放进 `overflow-x-auto` 的容器里仍会撑破页面——
 * 必须让表格自己成为滚动区（`display: block` + 自身 overflow-x）。
 */

const root = process.cwd();
const componentsDir = path.join(root, "components");

const sources = readdirSync(componentsDir)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => ({ name, text: readFileSync(path.join(componentsDir, name), "utf8") }));

describe("widget 里的宽表不会撑破页面", () => {
  it("带 min-w 的表格必须自己承担横向滚动", () => {
    const offenders: string[] = [];

    for (const { name, text } of sources) {
      // 找出同时带 min-w-[...] 和 overflow-x-auto 的表格
      const tableTags = text.match(/<table[^>]*>/g) ?? [];
      for (const tag of tableTags) {
        if (!/min-w-\[/.test(tag)) continue;
        const hasOwnScroll = /display:block|overflow-x-auto/.test(tag);
        if (!hasOwnScroll) {
          offenders.push(`${name}: ${tag.slice(0, 120)}`);
        }
      }
    }

    expect(
      offenders,
      "带 min-w 的表格要么去掉 min-w，要么让表格自己横向滚动（display: block + overflow-x-auto）",
    ).toEqual([]);
  });

  it("组件里没有内联样式与任意字号", () => {
    const offenders: string[] = [];
    for (const { name, text } of sources) {
      if (/\sstyle\s*=/.test(text)) offenders.push(`${name}: 内联 style`);
      const arbitrary = text.match(/\btext-\[[^\]]+\]/g);
      if (arbitrary) offenders.push(`${name}: 任意字号 ${arbitrary.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("正文里的宽表", () => {
  it("content.css 让 .lesson table 自己横向滚动", () => {
    const css = readFileSync(path.join(root, "content", "content.css"), "utf8");
    const rule = css.match(/\.lesson table\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/display:\s*block/);
    expect(rule).toMatch(/overflow-x:\s*auto/);
  });
});
