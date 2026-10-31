import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("四入口 PWA", () => {
  it("从首页启动，快捷入口只有练习、资料库、节拍器", () => {
    const data = manifest();
    expect(data.id).toBe("/");
    expect(data.start_url).toBe("/");
    expect(data.orientation).toBe("any");
    expect(data.shortcuts?.map((item) => item.url)).toEqual([
      "/practice",
      "/library",
      "/metronome",
    ]);
  });

  it("Service Worker 缓存首页与节拍器，并兼容旧节拍器地址", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain('REQUIRED_SHELL = ["/", "/metronome"]');
    expect(worker).toContain('"/tools/metronome": "/metronome"');
  });

  it("顶层导航只有四个入口", () => {
    const nav = read("components/SiteNav.tsx");
    expect(nav.match(/label: "/g) ?? []).toHaveLength(4);
    expect(nav).toContain('href: "/practice"');
    expect(nav).toContain('href: "/library"');
    expect(nav).toContain('href: "/metronome"');
    expect(nav).not.toContain('href: "/tools"');
  });

  it("旧工具与旧资料路由已经下线", () => {
    for (const route of [
      "app/tools/page.tsx",
      "app/tools/cheatsheet/page.tsx",
      "app/tools/chords/page.tsx",
      "app/tools/practice/page.tsx",
      "app/tools/rhythms/page.tsx",
      "app/library/[slug]/page.tsx",
    ]) {
      expect(existsSync(path.join(process.cwd(), route)), route).toBe(false);
    }
  });
});
