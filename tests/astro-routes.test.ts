import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const requiredPages = [
  "astro/layouts/BaseLayout.astro",
  "astro/pages/index.astro",
  "astro/pages/practice/index.astro",
  "astro/pages/library/index.astro",
  "astro/pages/404.astro",
];

function read(relativePath: string): string {
  return readFileSync(root + "/" + relativePath, "utf8");
}

describe("Astro static route shell", () => {
  it("has a layout, home, directory, and not-found route", () => {
    const missing = requiredPages.filter((route) => !existsSync(root + "/" + route));
    expect(missing).toEqual([]);
  });

  it("preserves the site document and PWA metadata in the shared layout", () => {
    const layoutPath = root + "/astro/layouts/BaseLayout.astro";
    expect(existsSync(layoutPath)).toBe(true);
    if (!existsSync(layoutPath)) return;

    const layout = read("astro/layouts/BaseLayout.astro");
    expect(layout).toContain('<html lang="zh-CN">');
    expect(layout).toContain('rel="manifest"');
    expect(layout).toContain('name="theme-color"');
    expect(layout).toContain("viewport-fit=cover");
    expect(layout).toContain("content/content.css");
    expect(layout).toContain("astro/styles/global.css");
  });

  it("derives home and directory data from the canonical manifest", () => {
    const homePath = root + "/astro/pages/index.astro";
    const practicePath = root + "/astro/pages/practice/index.astro";
    const libraryPath = root + "/astro/pages/library/index.astro";
    for (const path of [homePath, practicePath, libraryPath]) {
      expect(existsSync(path)).toBe(true);
    }
    if (![homePath, practicePath, libraryPath].every(existsSync)) return;

    expect(read("astro/pages/index.astro")).toContain("content/manifest");
    expect(read("astro/pages/practice/index.astro")).toContain("content/manifest");
    expect(read("astro/pages/library/index.astro")).toContain("content/manifest");
  });

  it("uses the canonical library entry count in the homepage quick link", () => {
    const homePath = root + "/astro/pages/index.astro";
    expect(existsSync(homePath)).toBe(true);
    if (!existsSync(homePath)) return;
    const home = read("astro/pages/index.astro");
    expect(home).toContain("libraryEntries.length");
    expect(home).not.toContain("指板音阶 · 1 份");
  });

  it("generates lesson pages from manifest entries and preserves the content pipeline", () => {
    const routePath = root + "/astro/pages/practice/[slug].astro";
    expect(existsSync(routePath)).toBe(true);
    if (!existsSync(routePath)) return;
    const route = read("astro/pages/practice/[slug].astro");
    for (const contract of ["getStaticPaths", "practiceEntries", "import.meta.glob", "sanitizeContentHtml", "addLessonHeadingIds", "splitContentSections", "LessonWidget", "PracticeEntryPicker"]) {
      expect(route).toContain(contract);
    }
  });

  it("keeps the hydrated practice picker independent of the Next router", () => {
    const picker = readFileSync(root + "/components/PracticeEntryPicker.tsx", "utf8");
    expect(picker).not.toContain("next/link");
    expect(picker).toContain("<a");
  });
});
