import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThreeNotesPerString } from "@/components/ThreeNotesPerString";
import { buildNeckNotes, FRET_COUNT } from "@/lib/guitar";

/**
 * 指板的键盘可达性守护。
 *
 * 设计决策（DESIGN.md §7）：不给几十个音位加 tab 焦点，改用「音名选择器」——
 * 7 个 44pt 按钮点亮全部同名音。这组测试防的是它被无意删掉或退化成纯悬停。
 */

const html = renderToStaticMarkup(createElement(ThreeNotesPerString));

function pitchButtons(): string[] {
  return [...html.matchAll(/<button\b[^>]*aria-label="点亮所有 [A-G] 音"[^>]*>/g)].map(
    ([button]) => button,
  );
}

describe("指板音名选择器", () => {
  it("C 大调七个音级各有一个按钮", () => {
    const pitchClasses = new Set(buildNeckNotes(FRET_COUNT).map((note) => note.pitchClass));
    expect(pitchButtons()).toHaveLength(pitchClasses.size);
    expect(pitchClasses.size).toBe(7);
  });

  it("每个按钮都有可访问名与开关语义", () => {
    for (const button of pitchButtons()) {
      expect(button).toMatch(/aria-label="点亮所有 [A-G] 音"/);
      // 初始都未选中；开关状态交给 aria-pressed，而不是只靠颜色
      expect(button).toMatch(/aria-pressed="false"/);
      expect(button).toContain('type="button"');
    }
  });

  it("按钮是 44pt 触摸目标", () => {
    for (const button of pitchButtons()) {
      expect(button).toMatch(/\bsize-11\b/);
    }
  });

  it("音位本身不进入 tab 序列（避免几十个停靠点）", () => {
    // Fretboard 的音位分组不得带 tabIndex
    expect(html).not.toMatch(/<g[^>]*tabindex/i);
  });
});
