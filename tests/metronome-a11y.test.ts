import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Metronome } from "@/components/Metronome";
import { BPM_DEFAULT, DEFAULT_METER } from "@/lib/metronome";

/**
 * Stage 3 的可访问性与动效契约。
 *
 * 仓库 vitest 是 `environment: "node"`，没有 DOM：能用服务端渲染就不要靠源码猜测，
 * 只能用源码顺序表达的东西（钩子、事件监听、条件分支）才读源码。
 */
const source = readFileSync(new URL("../components/Metronome.tsx", import.meta.url), "utf8");
const html = renderToStaticMarkup(createElement(Metronome));

/** 只取拍点那一段 JSX，避免命中文件里其它同名类名 */
function beatDotsBlock(): string {
  const from = source.indexOf("flex min-h-6 items-center justify-center");
  const to = source.indexOf("第 {Math.min(activeBeat + 1, beats)} 拍");
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

/** 只取 Space 的按键分支 */
function spaceBranch(): string {
  const from = source.indexOf('if (event.key !== " " && event.key !== "Spacebar") return;');
  const to = source.indexOf("window.addEventListener(\"keydown\"");
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("拍点指示（方案 §3 / §10）", () => {
  it("按拍号渲染对应数量的圆点，整组对读屏隐藏", () => {
    const dots = html.match(/class="size-3 rounded-full/g) ?? [];
    expect(dots).toHaveLength(DEFAULT_METER.beatsPerBar);
    // 圆点是纯视觉冗余，读屏靠旁边的 sr-only 文本
    expect(html).toContain('items-center justify-center gap-3" aria-hidden="true"');
  });

  it("首屏 sr-only 文本与当前拍一致（第 1 拍）", () => {
    expect(html).toContain(`第 1 拍，共 ${DEFAULT_METER.beatsPerBar} 拍`);
  });

  it("当前拍只换颜色，高亮不依赖形状或额外图形", () => {
    // 当前拍是 bg-accent-600，其余是 bg-ink-100 + ring；全部复用现有颜色令牌
    expect(html).toContain("bg-accent-600");
    expect(html).toContain("bg-ink-100");
  });
});

describe("减弱动态效果：reduce 下拍点不做缩放/淡入（方案 §10）", () => {
  it("缩放类只在高亮且未开启减弱动态效果时出现", () => {
    const block = beatDotsBlock();
    expect(block).toMatch(/active && !reducedMotion \? "scale-125" : ""/);
    // 必须只有这一个缩放类，不能有第二个来源
    expect(block.match(/scale-125/g)).toHaveLength(1);
  });

  it("过渡类只由 reducedMotion 决定，不跟高亮绑在一起", () => {
    const block = beatDotsBlock();
    // 绑定在一起（旧写法）会让退场从 1.25 硬跳回 1：失去高亮那一帧同时摘掉了
    // transition-property，只剩入场有动画。实测见交付评论的 MOTION_TIMELINE 探针。
    expect(block).toMatch(/reducedMotion \? "" : "transition-transform"/);
    expect(block).not.toMatch(/active && !reducedMotion \? "scale-125 transition-transform"/);
  });

  it("偏好由 useSyncExternalStore 提供，服务端快照返回 false（静态预渲染没有 matchMedia）", () => {
    const from = source.indexOf("function usePrefersReducedMotion");
    const to = source.indexOf("export function Metronome");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const hook = source.slice(from, to);

    expect(hook).toContain("useSyncExternalStore");
    expect(hook).toContain("(prefers-reduced-motion: reduce)");
    expect(hook).toContain('query.addEventListener("change", onChange)');
    expect(hook).toContain("() => query.removeEventListener(\"change\", onChange)");
    // 第三个参数是服务端快照
    expect(hook).toMatch(/\n\s*\(\) => false,\n/);
  });
});

describe("读屏播报（方案 §10）", () => {
  it("状态播报区只有一个，且不占视觉空间", () => {
    const statusRegions = html.match(/role="status"/g) ?? [];
    expect(statusRegions).toHaveLength(1);
    expect(html).toMatch(/<p role="status" class="sr-only">/);
  });

  it("BPM 播报区是 aria-live=polite，不与状态播报区合并", () => {
    expect(html.match(/aria-live="polite"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<p aria-live="polite" class="sr-only">/);
  });

  it("四种状态转换都有播报文案", () => {
    for (const text of ["已开始", "已继续", "已暂停", "已结束"]) {
      expect(source).toContain(`"${text}"`);
    }
  });

  it("BPM 播报节流到 400ms，并在再次变化时清掉上一次的定时器", () => {
    const throttle = source.match(/const BPM_ANNOUNCE_MS = (\d+);/)?.[1];
    expect(Number(throttle)).toBeGreaterThanOrEqual(400);

    const from = source.indexOf("BPM 播报节流：拖动滑杆时");
    const effect = source.slice(from);
    const setTimeoutAt = effect.indexOf("window.setTimeout(");
    const setAnnounced = effect.indexOf("setAnnouncedBpm(bpm)");
    const clearAt = effect.indexOf("window.clearTimeout(timer)");

    expect(setTimeoutAt).toBeGreaterThan(-1);
    expect(setAnnounced).toBeGreaterThan(setTimeoutAt);
    // 清理：下一次变化要作废上一次的定时器，否则快速拖动会连播
    expect(clearAt).toBeGreaterThan(setAnnounced);
    expect(effect).toContain("}, [bpm]);");
  });

  it("圆环速度控件有可访问名、范围与 aria-valuetext", () => {
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-label="速度"');
    expect(html).toContain(`aria-valuenow="${BPM_DEFAULT}"`);
    expect(html).toContain('aria-valuemin="30"');
    expect(html).toContain('aria-valuemax="240"');
    expect(html).toContain(`aria-valuetext="每分钟 ${BPM_DEFAULT} 拍"`);
    // 原生 range 换成了自定义圆环：键盘可达性必须自己补，不能靠 input 的默认行为
    expect(html).toContain('tabindex="0"');
  });

  it("圆环的键盘操作覆盖方向键、PageUp/Down 与 Home/End", () => {
    const dial = readFileSync(new URL("../components/BpmDial.tsx", import.meta.url), "utf8");
    for (const key of [
      "ArrowUp",
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "PageUp",
      "PageDown",
      "Home",
      "End",
    ]) {
      expect(dial).toContain(`case "${key}":`);
    }
    // 方向键必须 preventDefault，否则方向键会滚动页面
    expect(dial).toContain("event.preventDefault();");
    // Shift 走 10 拍，与 PageUp/PageDown 一致
    expect(dial).toContain("event.shiftKey ? 10 : 1");
  });

  it("分段控件用 aria-pressed 表达选中，并各自挂了可见标签", () => {
    // 拍号 6 个 + 音色 3 个 = 9 个 aria-pressed 按钮，其中各有一个选中
    expect(html.match(/aria-pressed="/g) ?? []).toHaveLength(9);
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(2);
    expect(html).toContain('aria-labelledby="metronome-meter-label"');
    expect(html).toContain('aria-labelledby="metronome-timbre-label"');
  });
});

describe("键盘（方案 §4 / §10）", () => {
  it("Space 在原生控件上不劫持，避免和原生激活打架", () => {
    const branch = spaceBranch();
    expect(branch).toContain(
      '"input, textarea, select, button, a, [contenteditable=\'true\']"',
    );
    // 命中原生控件时直接返回，不 preventDefault
    expect(branch).toMatch(/if \(interactive\) return;/);
    expect(branch.indexOf("if (interactive) return;")).toBeLessThan(
      branch.indexOf("event.preventDefault();"),
    );
  });

  it("Space 在其它位置切开始/暂停", () => {
    expect(spaceBranch()).toContain("toggle();");
  });

  it("Esc 结束，且 idle 时是无操作（按钮此时也是 disabled）", () => {
    const from = source.indexOf('if (event.key === "Escape")');
    const to = source.indexOf('if (event.key !== " " && event.key !== "Spacebar") return;');
    expect(from).toBeGreaterThan(-1);
    const branch = source.slice(from, to);

    expect(branch).toContain('if (phaseRef.current === "idle") return;');
    expect(branch.indexOf('if (phaseRef.current === "idle") return;')).toBeLessThan(
      branch.indexOf("void stop();"),
    );
    // idle 时「结束」本身也是 disabled，两个入口同时挡住
    expect(html).toMatch(/<button[^>]*disabled[^>]*>结束<\/button>/);
  });

  it("带修饰键的组合键不劫持", () => {
    expect(source).toContain("if (event.metaKey || event.ctrlKey || event.altKey) return;");
  });

  it("监听挂在 window 上，卸载时移除", () => {
    expect(source).toContain('window.addEventListener("keydown", onKeyDown)');
    expect(source).toContain('window.removeEventListener("keydown", onKeyDown)');
  });
});

describe("触摸目标与颜色来源（方案 §1 / §9.1）", () => {
  it("每个按钮的命中高度都在 44px 以上，主按钮 64px", () => {
    const buttons = [...html.matchAll(/<button\b[^>]*?class="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(buttons.length).toBeGreaterThanOrEqual(11);

    for (const className of buttons) {
      expect(className).toMatch(/\b(h-16|min-h-11|size-11)\b/);
    }
    expect(html).toContain("h-16 w-full");
    // 桌面圆环是整块命中区（size-60 = 240px），远大于 44px；
    // 原生 range 已换成自定义控件，不能再指望 input 自带 44px
    expect(html).toMatch(
      /class="bpm-dial relative cursor-pointer rounded-full size-60 sm:size-64"/,
    );
    // 命中区是整圆的 HTML 拖拽层（touch-action:none 在 HTML 上才生效），
    // 圆心盘盖住中间区域，留给页面滚动
    expect(html).toContain("absolute inset-0 rounded-full touch-none");
    expect(html).toContain("size-[60%]");
    expect(html).toContain("size-[76%]");
    expect(source).not.toMatch(/<input/);
  });

  it("不写颜色字面量，只用现有令牌类（对比度门禁继续覆盖）", () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\b(?:bg|text|border)-\[/);
    expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });
});
