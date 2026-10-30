import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 手机节拍器单屏稿。
 *
 * 页面在窄屏是一个独占视口的仪器：顶部节奏型、中间调速圆盘、
 * 底部 transport。这里锁住三件事：站点外壳确实让位、页面没有滚动出口、
 * 三个功能区都存在。真实尺寸与触摸行为由浏览器人工检查证明。
 */
const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const page = read("app/tools/metronome/page.tsx");
const globals = read("app/globals.css");
const metronome = read("components/Metronome.tsx");
const dial = read("components/BpmDial.tsx");
const nav = read("components/SiteNav.tsx");
const footer = read("components/SiteFooter.tsx");

describe("手机单屏节拍器", () => {
  it("窄屏隐藏站点顶部栏、底部 dock 与页脚", () => {
    expect(nav).toContain('const focusMode = pathname === "/tools/metronome";');
    expect(nav).toContain('focusMode ? "hidden sm:block " : ""');
    expect(nav).toContain('aria-label="移动端导航"');
    expect(footer).toContain('const focusMode = pathname === "/tools/metronome";');
    expect(footer).toContain('focusMode ? "hidden sm:block " : ""');
  });

  it("专注外壳占满 svh 且禁止页面滚动，同时保留安全区", () => {
    expect(globals).toMatch(/\.metronome-focus\s*\{[^}]*height:\s*100svh/);
    expect(globals).toMatch(/\.metronome-focus\s*\{[^}]*overflow:\s*hidden/);
    expect(globals).toMatch(
      /\.metronome-focus__panel\s*\{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/,
    );
    expect(page).toContain('className="metronome-focus"');
    expect(page).toContain('className="metronome-focus__panel"');
  });

  it("三个区域都在：顶部四拍、中央圆盘、底部 transport", () => {
    expect(metronome).toContain(
      'className="mobile-metronome flex h-full min-h-0 flex-col sm:hidden"',
    );
    expect(metronome).toContain('className="mt-2 flex gap-1.5"');
    expect(metronome).toContain("<BpmDial value={bpm} onChange={onBpmChange} instrument />");
    expect(metronome).toContain(
      'className="grid flex-none grid-cols-[1fr_auto_1fr] items-center gap-3"',
    );
    expect(metronome).toContain('aria-label={running ? "停止" : "开始"}');
    expect(metronome).toContain("切换拍号");
    expect(metronome).toContain("切换音色");
  });

  it("单屏版圆盘包含读数、BPM 标签和圆内微调按钮", () => {
    expect(dial).toContain("instrument?: boolean;");
    expect(dial).toContain("instrument ? \"text-7xl\" : \"text-6xl\"");
    expect(dial).toContain("BPM");
    expect(dial).toContain('aria-label="减速 1 BPM"');
    expect(dial).toContain('aria-label="加速 1 BPM"');
    expect(dial).toContain('instrument ? "size-[76%]" : "size-[60%]"');
  });
});
