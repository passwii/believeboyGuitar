import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pwaManifest } from "@/lib/pwa-manifest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("四入口 PWA", () => {
  it("从首页启动，快捷入口只有练习、资料库、节拍器", () => {
    const data = pwaManifest;
    expect(data.id).toBe("/");
    expect(data.start_url).toBe("/");
    expect(data.orientation).toBe("any");
    expect(data.shortcuts?.map((item) => item.url)).toEqual([
      "/practice",
      "/library",
      "/metronome",
    ]);
  });

  it("Next transition route delegates to the shared manifest object", () => {
    expect(read("app/manifest.ts")).toContain("pwaManifest");
  });

  it("Service Worker 缓存首页与节拍器，并兼容旧节拍器地址", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain('REQUIRED_SHELL = ["/", "/metronome"]');
    expect(worker).toContain('"/tools/metronome": "/metronome"');
  });

  it("顶层导航只有四个入口", () => {
    const nav = read("astro/components/SiteNav.astro");
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

  it("has shared manifest data and a static Astro manifest endpoint", () => {
    const dataPath = path.join(process.cwd(), "lib/pwa-manifest.ts");
    const endpointPath = path.join(process.cwd(), "astro/pages/manifest.webmanifest.ts");
    expect(existsSync(dataPath)).toBe(true);
    expect(existsSync(endpointPath)).toBe(true);
    if (!existsSync(dataPath) || !existsSync(endpointPath)) return;
    expect(read("lib/pwa-manifest.ts")).toContain("pwaManifest");
    expect(read("astro/pages/manifest.webmanifest.ts")).toContain("application/manifest+json");
  });

  it("Service Worker routes cache Astro build assets", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain("/_astro/");
    expect(worker).not.toContain("/_next/static/");
  });
});
