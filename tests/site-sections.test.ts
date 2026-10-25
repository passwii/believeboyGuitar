import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { HOME, SECTIONS } from "@/content/site";
import { TOOL_PAGES } from "@/components/ToolPages";

/**
 * 外壳与信息架构的守护（BLF-1452 视觉重设计）。
 *
 * 用户反馈的两条要求落成结构，而不是一句「已精简」：
 * 1. PWA / 窄屏顶部不再有标题栏，分类沉到底部 dock；
 * 2. 分类靠图标 + 名称辨认，不再靠一行行说明文字。
 *
 * 这些是源码结构测试：真正的排版与点击手感靠交付评论里的桌面 / 手机截图。
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const appDir = path.join(root, "app");

function routeExists(route: string): boolean {
  let dir = appDir;
  for (const segment of route.replace(/^\//, "").split("/")) {
    const hit = readdirSync(dir, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && entry.name === segment,
    );
    if (!hit) return false;
    dir = path.join(dir, segment);
  }
  return readdirSync(dir).includes("page.tsx");
}

describe("分类清单是唯一的入口来源", () => {
  it("顺序是练习 → 知识 → 工具 → 节拍器", () => {
    expect(SECTIONS.map((section) => section.id)).toEqual([
      "practice",
      "knowledge",
      "tools",
      "metronome",
    ]);
  });

  it("每个分类都有真实路由", () => {
    for (const section of SECTIONS) {
      expect(routeExists(section.href), `${section.label} 缺少路由 ${section.href}`).toBe(true);
    }
  });

  it("分类名称与工具清单里的名称不会走散", () => {
    const metronome = TOOL_PAGES.find((tool) => tool.href === "/tools/metronome");
    expect(metronome).toBeDefined();
    expect(SECTIONS.find((section) => section.id === "metronome")?.label).toBe(metronome?.name);
  });

  it("分类图标都在 SiteIcons 的图标表里", () => {
    const icons = read("components/SiteIcons.tsx");
    for (const section of SECTIONS) {
      expect(icons, `SiteIcons 缺少 ${section.id}`).toMatch(
        new RegExp(`^  ${section.id}: `, "m"),
      );
    }
  });
});

describe("窄屏 / PWA 顶部不再有标题栏", () => {
  const nav = read("components/SiteNav.tsx");
  const css = read("app/globals.css");

  it("站名栏在窄屏整条不渲染，宽屏才出现", () => {
    expect(nav).toMatch(/sticky top-0 z-30 hidden[^"]*sm:block/);
    // 窄屏用纯安全区留白接管状态栏
    expect(nav).toContain("h-[env(safe-area-inset-top)]");
  });

  it("锚点留白在窄屏归零，粘性目录在宽屏才需要让位", () => {
    expect(css).toContain("--nav-h: 0px;");
    const navBlock = css
      .match(/@media \(min-width: 640px\)\s*\{([\s\S]*?)\n  \}/g)
      ?.find((block) => block.includes("--nav-h"));
    expect(navBlock).toContain("max(56px, calc(44px + env(safe-area-inset-top)))");
  });

  it("底部 dock 是 首页 + 四个分类，图标在上、名称在下", () => {
    expect(nav).toContain("DOCK_ITEMS");
    expect(nav).toContain("[HOME, ...SECTIONS]");
    expect(HOME.href).toBe("/");
    expect(nav).toContain("grid-cols-5");
    // 图标与名称成对出现，不是纯文字 tab
    expect(nav).toMatch(/<SectionIcon[\s\S]*?<span>\{item\.label\}<\/span>/);
  });
});

describe("页面用图标 + 分类结构，不再堆文字", () => {
  it("重设计过的四个页面不再有眉标（eyebrow）小标签", () => {
    for (const file of [
      "app/page.tsx",
      "app/practice/page.tsx",
      "app/library/page.tsx",
      "app/tools/page.tsx",
    ]) {
      expect(read(file), `${file} 还在用 text-micro 眉标`).not.toContain("text-micro");
    }
  });

  it("知识页标题与导航一致，导语段落已删", () => {
    const library = read("app/library/page.tsx");
    expect(library).toContain(">知识</h1>");
    expect(library).not.toContain("全部整理后的资料");
  });

  it("分类卡片共用同一套 .tile 形状，不各写一份", () => {
    expect(read("app/globals.css")).toMatch(/\.tile\s*\{/);
    expect(read("app/page.tsx")).toContain("tile");
    expect(read("components/ToolPages.tsx")).toContain("tile");
  });

  it("首页不再渲染导语、区块说明与编号行", () => {
    const home = read("app/page.tsx");
    expect(home).not.toContain("text-micro");
    expect(home).not.toContain("padStart(");
    // 最近整理只给标题与日期，不给摘要
    expect(home).not.toContain("lesson.summary");
    expect(home).not.toContain("lesson.topics");
  });
});
