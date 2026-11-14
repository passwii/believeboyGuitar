import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("练习台与舞台面板", () => {
  const page = read("astro/pages/practice/index.astro");
  const home = read("astro/pages/index.astro");
  const styles = read("astro/styles/global.css");

  it("练习中心卡片从 manifest 与谱面数据派生，不复制目录", () => {
    expect(page).toContain("practiceEntries");
    expect(page).toContain("practiceSections(entry.slug)");
    expect(page).toContain("practice-card__mini-tab");
    expect(page).not.toContain("第 1 周 · 手指独立");
  });

  it("首页练琴台使用玻璃主卡与本周序列，不回到卡片墙", () => {
    expect(home).toContain("home-hero studio-glass-panel");
    expect(home).toContain("home-section-row");
    expect(home).toContain("home-quick-link studio-glass-panel");
    expect(home).toContain("libraryEntries.length");
  });

  it("练习卡与快捷入口带材质、光斑和 44px 主操作", () => {
    expect(styles).toMatch(/\.practice-card\s*\{[^}]*background:\s*var\(--color-surface-glass\)/);
    expect(styles).toMatch(/\.practice-card__glow\s*\{[^}]*radial-gradient/);
    expect(styles).toMatch(/@keyframes practice-card-sheen/);
    expect(styles).toMatch(/\.practice-card:hover::after\s*\{[^}]*practice-card-sheen/);
    expect(styles).toMatch(/\.home-primary-action\s*\{[^}]*min-height:\s*46px/);
    expect(styles).toMatch(/\.practice-console__resume\s*\{[^}]*background:\s*var\(--color-surface-glass\)/);
  });
});
