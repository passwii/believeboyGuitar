import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_PAGES } from "@/components/ToolPages";

/**
 * 工具页清单的守护。
 *
 * 工具页不进 content/manifest.ts（它们不是资料），但有一个自己的清单：
 * components/ToolPages.tsx。这组测试保证清单与实际路由不会脱节——
 * 清单里写了、页面不存在，是最容易被忽略的一种错误。
 */

const root = process.cwd();
const appDir = path.join(root, "app");

function routeExists(route: string): boolean {
  return readdirSync(appDir, { withFileTypes: true }).some(
    (entry) => entry.isDirectory() && entry.name === route.replace(/^\//, ""),
  );
}

describe("工具页清单", () => {
  it("每个工具页都有对应的路由目录", () => {
    const missing = TOOL_PAGES.filter((tool) => !routeExists(tool.href));
    expect(missing, `这些工具页没有对应路由：${missing.map((t) => t.href).join(", ")}`)
      .toEqual([]);
  });

  it("每个工具页都有页面文件", () => {
    for (const tool of TOOL_PAGES) {
      const page = path.join(appDir, tool.href.replace(/^\//, ""), "page.tsx");
      expect(() => readFileSync(page, "utf8"), `${tool.href} 缺少 page.tsx`).not.toThrow();
    }
  });

  it("工具页不重复", () => {
    const hrefs = TOOL_PAGES.map((tool) => tool.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("每条都有名称与说明", () => {
    for (const tool of TOOL_PAGES) {
      expect(tool.name.trim()).not.toBe("");
      expect(tool.detail.trim().length).toBeGreaterThan(10);
    }
  });

  it("工具页不在主导航里（DESIGN.md §5：导航只保留三个主要入口）", () => {
    const nav = readFileSync(path.join(root, "components", "SiteNav.tsx"), "utf8");
    for (const tool of TOOL_PAGES) {
      if (tool.href === "/metronome") continue; // 节拍器本来就是导航入口
      expect(nav, `导航里不该有 ${tool.href}`).not.toContain(`"${tool.href}"`);
    }
  });

  it("工具页不登记进 manifest（它们不是资料）", () => {
    const manifest = readFileSync(path.join(root, "content", "manifest.ts"), "utf8");
    for (const tool of TOOL_PAGES) {
      expect(manifest, `manifest 里不该有 ${tool.href}`).not.toContain(tool.href);
    }
  });
});
