import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BendPitchMeter } from "@/components/BendPitchMeter";
import { CagedSystem } from "@/components/CagedSystem";
import { TwelveBarBlues } from "@/components/TwelveBarBlues";
import { WIDGET_NAMES } from "@/content/widgets";

/**
 * 新 widget 的可访问性与结构守护。
 *
 * 沿用既有 widget 的几条约定（见 tests/fretboard-keyboard.test.ts）：
 * · 交互控件有可访问名与开关语义；
 * · 状态由 aria-pressed 表达，不只靠颜色；
 * · 音位本身不进入 tab 序列。
 */

describe("CAGED 组件", () => {
  const html = renderToStaticMarkup(createElement(CagedSystem));

  it("五个形状各有一个筛选按钮，另有「全部」", () => {
    const chips = [...html.matchAll(/<button\b[^>]*aria-label="([^"]*)"/g)].map(([, l]) => l);
    // 「全部」按钮的说明是「显示全部五个形状」，要排除掉
    const shapeButtons = chips.filter((l) => /形，/.test(l));
    expect(shapeButtons).toHaveLength(5);
    expect(chips.some((l) => l.includes("全部"))).toBe(true);
  });

  it("形状按钮有可访问名与开关语义", () => {
    for (const [, label] of html.matchAll(/<button\b[^>]*aria-label="([^"]*)"/g)) {
      if (!/形，/.test(label)) continue;
      expect(label.length).toBeGreaterThan(2);
    }
    expect(html).toMatch(/aria-pressed="false"/);
    expect(html).toMatch(/aria-pressed="true"/);
  });

  it("指板有可访问名", () => {
    expect(html).toMatch(/role="img"[^>]*aria-label="CAGED/);
  });

  it("速查表有表头与行标题", () => {
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="col"/);
    expect(html).toMatch(/<th scope="row"/);
  });

  it("音位本身不进入 tab 序列", () => {
    expect(html).not.toMatch(/<g[^>]*tabindex/i);
  });
});

describe("12 小节布鲁斯组件", () => {
  const html = renderToStaticMarkup(createElement(TwelveBarBlues));

  it("12 个小节按钮都有可访问名", () => {
    const bars = [...html.matchAll(/aria-label="(第 \d+ 小节，[^"]*)"/g)].map(([, l]) => l);
    expect(bars).toHaveLength(12);
    expect(bars[0]).toBe("第 1 小节，C7");
    expect(bars[11]).toBe("第 12 小节，G7");
  });

  it("小节按钮有开关语义", () => {
    expect(html).toMatch(/aria-pressed="true"/);
    expect(html).toMatch(/aria-pressed="false"/);
  });

  it("指板有可访问名", () => {
    expect(html).toMatch(/role="img"[^>]*aria-label="布鲁斯音阶/);
  });

  it("音位本身不进入 tab 序列", () => {
    expect(html).not.toMatch(/<g[^>]*tabindex/i);
  });
});

describe("推弦目标音组件", () => {
  const html = renderToStaticMarkup(createElement(BendPitchMeter));

  it("有可访问名与说明的表格", () => {
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="col"/);
    expect(html).toMatch(/<th scope="row"/);
  });

  it("弦选择按钮有开关语义且是 44pt 目标", () => {
    for (const [, cls] of html.matchAll(/<button\b[^>]*class="([^"]*)"/g)) {
      if (!/size-11/.test(cls)) continue;
      expect(cls).toMatch(/size-11/);
    }
    expect(html).toMatch(/aria-pressed="true"/);
  });

  it("拼写切换有可访问组名", () => {
    expect(html).toContain('aria-label="音名拼写方式"');
    expect(html).toContain('aria-label="选择弦"');
  });

  it("调内调外音对读屏有文字说明", () => {
    expect(html).toContain("C 大调调内音");
    expect(html).toContain("C 大调调外音");
  });
});

describe("组件登记", () => {
  it("新增的三个 widget 都已登记", () => {
    expect(WIDGET_NAMES).toContain("caged-system");
    expect(WIDGET_NAMES).toContain("twelve-bar-blues");
    expect(WIDGET_NAMES).toContain("bend-pitch-meter");
  });
});
