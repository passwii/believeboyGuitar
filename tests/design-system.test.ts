import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 设计系统的守护测试。
 *
 * 这一组防的不是「写错代码」，而是「设计系统慢慢漏气」：死令牌越积越多、
 * 字号阶梯被随手加一档、触摸目标被悄悄改小。规则来自 DESIGN.md，
 * 实现来自 app/globals.css。
 */

const root = process.cwd();
const globalsPath = path.join(root, "app", "globals.css");
const css = readFileSync(globalsPath, "utf8");

/** @theme 块是令牌「声明」处，不能拿它自己当「使用」证据 */
const cssBody = css.replace(/@theme\s*\{[\s\S]*?\n\}/, "");

const SOURCES = ["app", "components", "content"].flatMap((dir) =>
  readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(tsx?|css)$/.test(name))
    .map((name) => ({
      file: path.join(dir, name),
      text: readFileSync(path.join(root, dir, name), "utf8"),
    })),
);

const CONSUMERS = [...SOURCES, { file: "app/globals.css", text: cssBody }];

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
          `${ink} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(token("on-accent"), token("accent-700"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("accent-700"), token("canvas"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("accent-700"), token("accent-50"))).toBeGreaterThanOrEqual(4.5);
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
      if (!file.endsWith(".tsx")) continue;
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
  const FAMILIES = ["ink", "accent", "surface", "canvas", "rule", "control", "board"];

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

describe("工具页与外壳组件不写死颜色", () => {
  /**
   * 工具页与外壳组件只用语义令牌类，不写颜色字面量。
   *
   * 2026-10-25 起全站一个世界，这条守护的目的从「暗区换皮不漏色」变成
   * 「换令牌时整站真的跟着换」：写死的 fill-white 或 #fff 不随令牌走，
   * 换色后会留下一块对不上的白（BLF-1451 就踩过同类问题）。
   *
   * 渲染面不手工维护：从 app/tools/** 的 page / layout 出发，沿
   * @/ 与相对导入走完整张组件图谱；SiteNav / SiteFooter 不被 tools 页
   * 导入，但外壳同样使用这套令牌，作为额外根加入。
   * 正文流里的 lesson widget（如 Fretboard 的 fill-white）不在此列：
   * 它画在指板木色上，白色是实物决定，对比度由各自的页面测试守护。
   */

  const resolveImport = (fromFile: string, spec: string): string | null => {
    const base = spec.startsWith("@/")
      ? path.join(root, spec.slice(2))
      : spec.startsWith(".")
        ? path.resolve(path.dirname(fromFile), spec)
        : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  };

  const collectReachable = (entries: string[]): Set<string> => {
    const seen = new Set<string>();
    const queue = [...entries];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file) || !file.endsWith(".tsx")) continue;
      seen.add(file);
      for (const match of readFileSync(file, "utf8").matchAll(
        /(?:\bfrom|\bimport)\s*["']([^"']+)["']/g,
      )) {
        const resolved = resolveImport(file, match[1]);
        if (resolved) queue.push(resolved);
      }
    }
    return seen;
  };

  const toolDir = path.join(root, "app", "tools");
  const toolEntries = readdirSync(toolDir, { recursive: true, encoding: "utf8" })
    .filter((name) => /(^|\/)(page|layout)\.tsx$/.test(name))
    .map((name) => path.join(toolDir, name));
  const toolFiles = collectReachable([
    ...toolEntries,
    path.join(root, "components", "SiteNav.tsx"),
    path.join(root, "components", "SiteFooter.tsx"),
  ]);

  it("图谱确实覆到工具页与外壳（防收集逻辑静默失效）", () => {
    for (const must of [
      "components/ChordLibrary.tsx",
      "components/Metronome.tsx",
      "components/SiteNav.tsx",
    ]) {
      expect(
        [...toolFiles].map((file) => path.relative(root, file)),
      ).toContain(must);
    }
    // 正文流的 Fretboard 不该被卷进来：它的 fill-white 画在指板木色上
    expect(
      [...toolFiles].map((file) => path.relative(root, file)),
    ).not.toContain("components/Fretboard.tsx");
  });

  it("工具页与外壳组件里没有颜色字面量", () => {
    /** 四种形态：hex、rgb()/hsl()/oklch()、任意值颜色类、
        Tailwind 内置色名（transparent / current / inherit 只表达
        「不选色」，不参与换皮，放行）。 */
    const colorPrefix =
      "(?:text|bg|border|fill|stroke|ring|outline|decoration|divide|from|via|to|accent|caret)";
    const literalPatterns: RegExp[] = [
      /#[0-9a-f]{3,8}\b/i,
      /\b(?:rgba?|hsla?|oklch)\s*\(/i,
      new RegExp(`\\b${colorPrefix}-\\[`),
      new RegExp(
        `\\b${colorPrefix}-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\\d{2,3})?\\b`,
      ),
    ];

    const offenders: string[] = [];
    for (const file of [...toolFiles].sort()) {
      const text = readFileSync(file, "utf8");
      for (const pattern of literalPatterns) {
        const match = text.match(pattern);
        if (match) offenders.push(`${path.relative(root, file)}: ${match[0]}`);
      }
    }
    expect(
      offenders,
      "工具页组件必须只用语义令牌类，写死颜色不会随令牌一起换",
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
