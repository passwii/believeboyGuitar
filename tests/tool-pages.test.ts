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
 *
 * BLF-1451 起五个工具住在 /tools 下的工具间里；旧地址保留静态跳转壳
 * （静态导出用不了 redirects()，而已安装 PWA 的 start_url 可能还是旧地址）。
 */

const root = process.cwd();
const appDir = path.join(root, "app");

/** 按路径段逐层往下找目录：/tools/chords 要先有 tools/ 再有 chords/ */
function routeExists(route: string): boolean {
  let dir = appDir;
  for (const segment of route.replace(/^\//, "").split("/")) {
    const hit = readdirSync(dir, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && entry.name === segment,
    );
    if (!hit) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

/** 旧地址 = 清单地址去掉 /tools 前缀（节拍器原来是 /metronome，以此类推） */
function legacyHref(href: string): string {
  expect(href.startsWith("/tools/"), `${href} 应住在 /tools 下`).toBe(true);
  return href.replace(/^\/tools/, "");
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

  it("工具间入口页 /tools 存在", () => {
    expect(() => readFileSync(path.join(appDir, "tools", "page.tsx"), "utf8")).not.toThrow();
  });

  it("工具间入口页把清单里的每个工具都列出来", () => {
    const index = readFileSync(path.join(appDir, "tools", "page.tsx"), "utf8");
    expect(index).toContain("TOOL_PAGES");
    expect(index).toContain("map(");
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

  it("单独的工具页不在导航里（dock 与桌面导航放的是工具间入口，不是五个路由）", () => {
    const nav = readFileSync(path.join(root, "components", "SiteNav.tsx"), "utf8");
    for (const tool of TOOL_PAGES) {
      if (tool.href === "/tools/metronome") continue; // 节拍器本来就是导航入口
      expect(nav, `导航里不该有 ${tool.href}`).not.toContain(`"${tool.href}"`);
    }
  });

  it("导航上有练习、知识、工具间与节拍器，移动端 dock 四项齐全（BLF-1452）", () => {
    const nav = readFileSync(path.join(root, "components", "SiteNav.tsx"), "utf8");
    expect(nav).toContain('href: "/practice"');
    expect(nav).toContain('href: "/library"');
    expect(nav).toContain('href: "/tools"');
    expect(nav).toContain('href: "/tools/metronome"');
    // 站点名回到首页；dock 上不再单设「书桌」
    expect(nav).toContain('href="/"');
    expect(nav).toContain('aria-label="移动端导航"');
  });

  it("工具页不登记进 manifest（它们不是资料）", () => {
    const manifest = readFileSync(path.join(root, "content", "manifest.ts"), "utf8");
    for (const tool of TOOL_PAGES) {
      expect(manifest, `manifest 里不该有 ${tool.href}`).not.toContain(tool.href);
    }
  });
});

describe("旧地址的静态跳转壳", () => {
  it("每个旧地址都有跳转页，meta refresh 指向新地址", () => {
    for (const tool of TOOL_PAGES) {
      const legacy = legacyHref(tool.href);
      const page = readFileSync(
        path.join(appDir, legacy.replace(/^\//, ""), "page.tsx"),
        "utf8",
      );
      expect(
        page,
        `${legacy} 缺少跳转壳`,
      ).toContain(`content="0;url=${tool.href}"`);
      expect(page, `${legacy} 的无 JS 退化链接缺失`).toContain(`href="${tool.href}"`);
    }
  });

  it("跳转壳不吞掉旧地址：页面与 canonical 都指向新地址", () => {
    for (const tool of TOOL_PAGES) {
      const legacy = legacyHref(tool.href);
      const page = readFileSync(
        path.join(appDir, legacy.replace(/^\//, ""), "page.tsx"),
        "utf8",
      );
      expect(page).toContain(`canonical: "${tool.href}"`);
    }
  });
});
