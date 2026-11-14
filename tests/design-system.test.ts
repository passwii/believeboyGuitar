import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 设计系统的守护测试。
 *
 * 这一组防的不是「写错代码」，而是「设计系统慢慢漏气」：死令牌越积越多、
 * 字号阶梯被随手加一档、触摸目标被悄悄改小。规则来自 DESIGN.md，
 * 实现来自 astro/styles/global.css。
 */

const root = process.cwd();
const globalsPath = path.join(root, "astro", "styles", "global.css");
const css = readFileSync(globalsPath, "utf8");

/** @theme 块是令牌「声明」处，不能拿它自己当「使用」证据 */
const cssBody = css.replace(/@theme\s*\{[\s\S]*?\n\}/, "");

const SOURCES = ["astro", "components", "content"].flatMap((dir) =>
  readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(tsx?|css|astro|html)$/.test(name))
    .map((name) => ({
      file: path.join(dir, name),
      text: readFileSync(path.join(root, dir, name), "utf8"),
    })),
);

const CONSUMERS = [...SOURCES, { file: "astro/styles/global.css", text: cssBody }];

/**
 * 令牌 → 判定「被使用」的正则。
 * Tailwind v4 会把 @theme 里的令牌编译成同名工具类，所以不能只找 var()。
 */
function usagePattern(token: string): RegExp | null {
  const color = token.match(/^--color-(.+)$/);
  if (color) {
    // text-ink-950 / bg-surface / fill-accent-600 / stroke-rule …
    return new RegExp(`(?:^|[\\s"'\\-:])(?:text|bg|border|fill|stroke|ring|decoration|divide|from|to|via|outline|shadow)-${color[1]}\\b|var\\(${token}\\)`);
  }
  const font = token.match(/^--font-(.+)$/);
  if (font) return new RegExp(`\\bfont-${font[1]}\\b|var\\(${token}\\)`);
  const text = token.match(/^--text-(.+)$/);
  if (text) return new RegExp(`\\btext-${text[1]}\\b|var\\(${token}\\)`);
  const radius = token.match(/^--radius-(.+)$/);
  if (radius) return new RegExp(`\\brounded-${radius[1]}\\b|var\\(${token}\\)`);
  const shadow = token.match(/^--shadow-(.+)$/);
  if (shadow) return new RegExp(`\\bshadow-${shadow[1]}\\b|var\\(${token}\\)`);
  return new RegExp(`var\\(${token}\\)`);
}

describe("设计令牌", () => {
  const declared = [...css.matchAll(/^\s*(--(?:color|text|radius|shadow|ease|container|font)-[a-z0-9-]+):/gm)]
    .map(([, token]) => token)
    // Tailwind 由 --text-* 派生的修饰符不是独立令牌
    .filter((token) => !/--(line-height|letter-spacing|font-weight)$/.test(token));

  it("每个声明的令牌都至少被引用一次（不允许死令牌堆积）", () => {
    const unused = declared.filter((token) => {
      const pattern = usagePattern(token);
      if (!pattern) return true;
      return !CONSUMERS.some(({ text }) => pattern.test(text));
    });

    expect(unused, `未被使用的令牌：${unused.join(", ")}`).toEqual([]);
  });

  it("墨色三级在三种底色上都达到 AA", () => {
    const token = (name: string) => {
      const value = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      if (!value) throw new Error(`缺少颜色令牌：${name}`);
      return value;
    };
    const luminance = (hex: string) => {
      const channels = hex.match(/[0-9a-f]{2}/gi) ?? [];
      const [r, g, b] = channels.map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    for (const background of ["canvas", "surface", "surface-muted"]) {
      for (const ink of ["ink-950", "ink-700", "ink-500"]) {
        expect(
          contrast(token(ink), token(background)),
          `Light: ${ink} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(token("on-accent"), token("accent-700"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("accent-700"), token("canvas"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("accent-700"), token("accent-50"))).toBeGreaterThanOrEqual(4.5);

    // 验证 Dark 模式对比度守护
    const darkSection = css.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const darkToken = (name: string) => {
      const value = darkSection.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      if (!value) throw new Error(`缺少 Dark 颜色令牌：${name}`);
      return value;
    };

    for (const background of ["canvas", "surface", "surface-muted"]) {
      for (const ink of ["ink-950", "ink-700", "ink-500"]) {
        expect(
          contrast(darkToken(ink), darkToken(background)),
          `Dark: ${ink} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(darkToken("on-accent"), darkToken("accent-700"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkToken("accent-700"), darkToken("canvas"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkToken("accent-700"), darkToken("accent-50"))).toBeGreaterThanOrEqual(4.5);
  });

});

describe("排版阶梯", () => {
  const SCALE = ["display", "title", "body", "label", "meta", "micro"];

  it("只声明六档字号", () => {
    const declared = [...css.matchAll(/^\s*--text-([a-z]+):/gm)].map(([, name]) => name);
    expect(declared.sort()).toEqual([...SCALE].sort());
  });

  it("界面代码不出现任意字号（阶梯漏气的典型迹象）", () => {
    const offenders: string[] = [];
    for (const { file, text } of SOURCES) {
      if (!file.endsWith(".tsx") && !file.endsWith(".astro")) continue;
      for (const match of text.matchAll(/\btext-\[[^\]]+\]/g)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("令牌引用完整性", () => {
  /**
   * 反向检查：源码里用到的每个颜色工具类，必须在 @theme 里有对应声明。
   *
   * Tailwind 对未声明的颜色类是「静默丢弃」：不报错，只是少一条样式。
   * 本仓库真实踩过这个坑——完善调色板时删掉了 ink-200 / ink-300，
   * 而节拍器组件仍在引用它们：编译通过、测试通过，颜色却没了。
   */

  /** 本项目自己的颜色族；white / black / transparent 等交给 Tailwind 内置 */
  const FAMILIES = ["ink", "accent", "surface", "canvas", "rule", "control", "board", "glass"];

  const declaredColors = new Set(
    [...css.matchAll(/^\s*--color-([a-z0-9-]+):/gm)].map(([, name]) => name),
  );

  it("源码引用的颜色工具类都有对应令牌", () => {
    const offenders: string[] = [];

    for (const { file, text } of SOURCES) {
      for (const match of text.matchAll(
        /(?:^|[\s"'`:[(])(?:text|bg|border|fill|stroke|ring|divide|from|to|via|decoration|outline)-([a-z][a-z0-9-]*)/gm,
      )) {
        const name = match[1];
        // 只关心本项目自己定义的颜色族，不误判 Tailwind 内置与结构类（border-t、ring-1…）
        const family = FAMILIES.find(
          (candidate) => name === candidate || name.startsWith(`${candidate}-`),
        );
        if (!family) continue;
        if (declaredColors.has(name)) continue;
        offenders.push(`${file}: ${match[0].trim()}`);
      }
    }

    expect(
      [...new Set(offenders)],
      "以下颜色工具类没有对应的 --color-* 令牌（Tailwind 会静默丢弃）",
    ).toEqual([]);
  });
});

describe("触摸目标", () => {
  it("选择型控件以 44px 为下限", () => {
    expect(css).toMatch(/\.chip\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.segment\s*\{[^}]*min-height:\s*40px/);
    expect(css).toMatch(
      /@media \(hover: none\)\s*\{[^}]*\.segment\s*\{[^}]*min-height:\s*44px/,
    );
  });
});

describe("Neo-Studio 磨砂玻璃材质与双模降级守护", () => {
  it("声明 @custom-variant dark 支持 Tailwind 双模变体", () => {
    expect(css).toMatch(/@custom-variant\s+dark\s+\(&:where\(\[data-theme="dark"\]/);
  });

  it("导航栏与底部 Dock 采用亚克力磨砂玻璃并配置 1px 镜面发丝高光", () => {
    expect(css).toMatch(/\.shell-nav-glass\s*\{[^}]*backdrop-filter:\s*blur\(24px\)\s+saturate\(160%\)/);
    expect(css).toMatch(/\.shell-nav-glass\s*\{[^}]*box-shadow:[^}]*var\(--color-glass-specular\)/);
    expect(css).toMatch(/\.dock-glass\s*\{[^}]*backdrop-filter:\s*blur\(24px\)\s+saturate\(160%\)/);
    expect(css).toMatch(/\.dock-glass\s*\{[^}]*box-shadow:[^}]*var\(--color-glass-specular\)/);
  });

  it("磨砂玻璃卡片 studio-glass-panel 包含 24px 模糊、发丝受光与弹簧回弹", () => {
    expect(css).toMatch(/\.studio-glass-panel\s*\{[^}]*backdrop-filter:\s*blur\(24px\)\s+saturate\(160%\)/);
    expect(css).toMatch(/\.studio-glass-panel\s*\{[^}]*box-shadow:[^}]*var\(--color-glass-specular\)/);
  });

  it("prefers-reduced-transparency 下玻璃材质优雅降级为实底无滤镜", () => {
    const reducedTransparency = css.match(/@media\s*\(prefers-reduced-transparency:\s*reduce\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(reducedTransparency).toContain("backdrop-filter: none");
    expect(reducedTransparency).toContain("background-color: var(--color-surface)");
  });

  it("prefers-reduced-motion 下强制重置所有动画与过渡时长至 0.01ms", () => {
    const reducedMotion = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\n\s*\})\s*\}/)?.[1] ?? "";
    expect(reducedMotion).toContain("animation-duration: 0.01ms");
    expect(reducedMotion).toContain("transition-duration: 0.01ms");
    expect(reducedMotion).toContain("scroll-behavior: auto");
  });
});
