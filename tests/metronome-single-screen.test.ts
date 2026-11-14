import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 节拍器单屏与横屏控制台契约。
 *
 * 手机竖屏与 iPad 竖屏沿用单栏「顶部柱状图 + 中央圆盘 + 底部 transport」，
 * iPad 横屏与桌面改用 2/3 读数区 + 1/3 调节区的双栏控制台。
 * 两种形态都必须在一个视口内显示完，页面不滚动。
 * 这里锁结构与断点；真实尺寸与触摸行为由浏览器截图检查证明。
 */
const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const page = read("astro/pages/metronome.astro");
const globals = read("astro/styles/global.css");
const metronome = read("components/Metronome.tsx");
const dial = read("components/BpmDial.tsx");
const layout = read("astro/layouts/BaseLayout.astro");
const footer = read("astro/components/SiteFooter.astro");

describe("节拍器沉浸式单屏外壳", () => {
  it("节拍器页在手机与平板上让位站点导航、底部 dock 与页脚", () => {
    expect(layout).toContain('pathname === "/metronome" && "is-metronome-page"');
    expect(globals).toContain("body.is-metronome-page > .shell-nav-glass");
    expect(globals).toContain("body.is-metronome-page > .dock-glass");
    expect(globals).toContain("body.is-metronome-page > .site-footer");
    expect(globals).toMatch(
      /\(max-width: 1023px\), \(pointer: coarse\)[\s\S]*?\.is-metronome-page[\s\S]*?display:\s*none\s*!important/,
    );
    expect(footer).toContain('focusMode && "hidden sm:block"');
  });

  it("专注外壳占满 svh 且禁止页面滚动，同时保留安全区", () => {
    expect(globals).toMatch(/\.metronome-focus\s*\{[^}]*height:\s*100svh/);
    expect(globals).toMatch(/\.metronome-focus\s*\{[^}]*overflow:\s*hidden/);
    expect(globals).toMatch(
      /\.metronome-focus__panel\s*\{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/,
    );
    expect(page).toContain('class="metronome-focus"');
    expect(page).toContain('class="metronome-focus__panel"');
  });
});

describe("竖屏单栏（手机与 iPad 竖屏）", () => {
  it("三段布局存在：拍号与柱状图、中央圆盘、底部 transport", () => {
    expect(metronome).toContain('className="metronome-compact h-full min-h-0 flex-col"');
    expect(metronome).toContain('className="mt-2 flex gap-1.5"');
    expect(metronome).toContain('className="metronome-compact__dial flex min-h-0 flex-1');
    expect(metronome).toContain("<BpmDial value={bpm} onChange={onBpmChange} />");
    expect(metronome).toContain(
      'className="grid flex-none grid-cols-[1fr_auto_1fr] items-center gap-3"',
    );
    expect(metronome).toContain('aria-label={running ? "停止" : "开始"}');
    expect(metronome).toContain("切换拍号");
    expect(metronome).toContain("切换音色");
    expect(metronome).toContain('href="/"');
    expect(metronome).toContain('aria-label="返回首页"');
  });

  it("单屏版圆盘按剩余高度缩放，避免把底部 transport 顶出视口", () => {
    expect(globals).toMatch(
      /\.metronome-compact .bpm-dial\s*\{[^}]*height:\s*min\(calc\(100svh - 20rem\)/,
    );
    expect(globals).toMatch(/\.metronome-compact__dial\s*\{[^}]*flex:\s*1 1 0%/);
  });

  it("拍柱高度放在组件层，短横屏规则能稳定覆盖工具类", () => {
    // 高度不能写成 Tailwind 任意值：utilities 层在 components 之后，
    // 会让短横屏的收缩规则失效（实测 740×360 拍柱仍是 128px）。
    expect(metronome).not.toContain("h-[clamp(6rem");
    expect(metronome).not.toContain("h-[clamp(8rem");
    expect(metronome).toContain("metronome-beat-bar--compact");
    expect(metronome).toContain("metronome-beat-bar--split");
    expect(globals).toMatch(/\.metronome-beat-bar\s*\{[^}]*height:\s*clamp\(8rem, 20svh, 11rem\)/);
    expect(globals).toMatch(
      /\.metronome-beat-bar--compact\s*\{[^}]*height:\s*clamp\(6rem, 9svh, 8rem\)/,
    );
    expect(globals).toMatch(
      /@media \(max-height: 480px\)[\s\S]*?\.metronome-split__bars > \.metronome-beat-bar\s*\{[\s\S]*?height:\s*5rem/,
    );
  });

  it("加减按钮放在圆环外，避免拖动圆环时误触", () => {
        expect(dial).toContain("text-7xl");
    expect(dial).toContain("size-[76%]");
    expect(metronome).toContain("<BpmDial value={bpm} onChange={onBpmChange} />");
    expect(metronome).toContain("<BpmStepControls bpm={bpm} onChange={onBpmChange} />");
  });
});

describe("横屏双栏（iPad 横屏与桌面）", () => {
  it("横屏渲染 2/3 读数区 + 1/3 调节区的控制台", () => {
    expect(metronome).toContain('className="metronome-split"');
    expect(metronome).toContain('className="metronome-split__display"');
    expect(metronome).toContain('className="metronome-split__controls"');
    expect(metronome).toContain('className="metronome-split__bars"');
    expect(metronome).toContain('aria-label="节拍器工作台"');
    expect(metronome).toContain('aria-label="节拍器调节"');
  });

  it("横屏断点覆盖 iPad 尺寸，把圆盘与柱状图留在左侧", () => {
    expect(globals).toMatch(
      /@media \(orientation: landscape\) and \(min-width: 640px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 2fr\) minmax\(15rem, 1fr\)/,
    );
    expect(globals).toMatch(
      /\.metronome-split__dial \.bpm-dial\s*\{[^}]*min\(36svh/,
    );
    expect(globals).toMatch(/\.metronome-split__controls\s*\{[^}]*overflow-y:\s*auto/);
  });

  it("短横屏（≤480px 高）收紧控制列，保证内部不滚动", () => {
    expect(globals).toMatch(/@media \(max-height: 480px\)/);
    expect(globals).toMatch(
      /@media \(max-height: 480px\)[\s\S]*?\.metronome-split__controls \{[\s\S]*?padding-right: 0/,
    );
    expect(globals).toMatch(
      /@media \(max-height: 480px\)[\s\S]*?\.metronome-split__shortcut-hint \{[\s\S]*?display: none/,
    );
  });

  it("横屏控制台整块在一个视口内，桌面控制台高度有上限", () => {
    expect(globals).toMatch(/\.metronome-split\s*\{[^}]*height:\s*100%/);
    expect(globals).toMatch(
      /\.metronome-console\s*\{[^}]*min-height:\s*clamp\(30rem, calc\(100svh - 16rem\), 42rem\)/,
    );
  });
});
