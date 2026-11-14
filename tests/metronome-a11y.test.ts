import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Metronome } from "@/components/Metronome";
import { BPM_DEFAULT, BPM_STEP, DEFAULT_METER } from "@/lib/metronome";

/**
 * Stage 3 的可访问性与动效契约。
 *
 * 仓库 vitest 是 `environment: "node"`，没有 DOM：能用服务端渲染就不要靠源码猜测，
 * 只能用源码顺序表达的东西（钩子、事件监听、条件分支）才读源码。
 */
const source = readFileSync(new URL("../components/Metronome.tsx", import.meta.url), "utf8");
const html = renderToStaticMarkup(createElement(Metronome));

describe("拍点指示：柱状图即拍点，不再重复圆点", () => {
  it("拍点指示只由节拍柱状图承担，没有与柱状图重复的圆点指示器", () => {
    // 用户反馈：「开始」按钮上方那块指示器与节拍柱状图重复，已移除。
    expect(html).not.toContain("size-3 rounded-full");
    expect(html).not.toContain("min-h-6 items-center justify-center gap-3");
    expect(source).not.toContain("scale-125");
  });

  it("柱状图按拍号渲染，并在播放时高亮当前拍", () => {
    const barButtons = html.match(/第 \d+ 拍重音设置，当前为 [12] 格/g) ?? [];
    expect(barButtons).toHaveLength(DEFAULT_METER.beatsPerBar * 2);
  });

  it("sr-only 文本仍完整描述拍号与当前拍，读屏不因移除圆点而丢信息", () => {
    expect(html).toContain(`${DEFAULT_METER.label} 节奏型，第 1 拍，共 ${DEFAULT_METER.beatsPerBar} 拍`);
  });
});

describe("减弱动态效果：柱状图只换颜色（方案 §10）", () => {
  it("柱状图过渡类只由 reducedMotion 决定", () => {
    expect(source).toContain('reducedMotion ? "" : "transition-colors duration-150"');
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
    // 正常方向键走 5 拍，Shift 走 10 拍，与 PageUp/PageDown 一致
    expect(BPM_STEP).toBe(5);
    expect(dial).toContain("event.shiftKey ? BPM_STEP * 2 : BPM_STEP");
  });

  it("加减按钮在圆环外，并以 5 BPM 为一步", () => {
    expect(html).toContain(`aria-label="减速 ${BPM_STEP} BPM"`);
    expect(html).toContain(`aria-label="加速 ${BPM_STEP} BPM"`);
    expect(html).toContain(`>−${BPM_STEP}</button>`);
    expect(html).toContain(`>+${BPM_STEP}</button>`);
    expect(source).toContain("onClick={() => onChange(bpm - BPM_STEP)}");
    expect(source).toContain("onClick={() => onChange(bpm + BPM_STEP)}");
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
    expect(source).toContain("bindMetronomeSpaceShortcut(window, toggle)");
    expect(html).toContain('aria-keyshortcuts="Space"');
    expect(html).toContain("空格开始/暂停");
    expect(html).toContain("Esc 结束");
  });

  it("Space 在其它位置切开始/暂停", () => {
    expect(source).toContain("bindMetronomeSpaceShortcut(window, toggle)");
  });

  it("Esc 结束，且 idle 时是无操作（按钮此时也是 disabled）", () => {
    const from = source.indexOf('if (event.key === "Escape")');
    const to = source.indexOf("window.addEventListener(\"keydown\"", from);
    expect(from).toBeGreaterThan(-1);
    const branch = source.slice(from, to);

    expect(branch).toContain('if (phaseRef.current === "idle") return;');
    expect(branch.indexOf('if (phaseRef.current === "idle") return;')).toBeLessThan(
      branch.indexOf("void stop();"),
    );
    // idle 时「结束」本身也是 disabled，两个入口同时挡住
    expect(html).toMatch(/<button[^>]*disabled[^>]*>结束<\/button>/);
  });

  it("Space 的共享监听随组件生命周期绑定与清理", () => {
    expect(source).toContain("bindMetronomeSpaceShortcut(window, toggle)");
    expect(readFileSync(new URL("../lib/metronome-keyboard.ts", import.meta.url), "utf8")).toContain(
      'host.removeEventListener("keydown", onKeyDown)',
    );
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
    // 圆盘是整块命中区（不小于 15rem），远大于 44px；
    // 原生 range 已换成自定义控件，不能再指望 input 自带 44px
    expect(html).toContain('class="bpm-dial relative cursor-pointer rounded-full metronome-dial"');
    // 命中区是整圆的 HTML 拖拽层（touch-action:none 在 HTML 上才生效），
    // 圆心盘盖住中间区域，留给页面滚动
    expect(html).toContain("absolute inset-0 rounded-full touch-none");
    // 控制台两种形态共用同一圆盘：读数放大、环带收在 76% 内圈
    expect(html).toContain("size-[76%]");
    expect(source).not.toMatch(/<input/);
  });

  it("不写颜色字面量，只用现有令牌类（对比度门禁继续覆盖）", () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\b(?:bg|text|border)-\[/);
    expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });
});
