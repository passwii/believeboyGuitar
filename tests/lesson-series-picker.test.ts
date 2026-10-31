import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonSeriesPicker } from "@/components/LessonSeriesPicker";
import { lessons } from "@/content/manifest";

const root = process.cwd();

describe("训练周次切换", () => {
  const items = lessons.filter((lesson) => lesson.series?.id === "finger-training-weeks");

  it("只显示当前周，展开后保留全部周次的链接", () => {
    expect(items.map((lesson) => lesson.series?.label)).toEqual(["第 1 周", "第 2 周"]);

    const html = renderToStaticMarkup(
      createElement(LessonSeriesPicker, {
        items,
        currentSlug: "week-2-alternate-picking",
      }),
    );
    expect(html).toContain('aria-label="切换训练周次，当前 第 2 周"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('aria-label="训练周次"');
    expect(html).toContain('href="/library/week-1-finger-independence"');
    expect(html).toContain('href="/library/week-2-alternate-picking"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">第 1 周</a>");
    expect(html).toContain(">第 2 周</a>");
    expect(html).not.toContain("segment-track");
  });

  it("周数增加后仍保持一个固定宽度的选择按钮", () => {
    const manyItems = Array.from({ length: 12 }, (_, index) => {
      const number = index + 1;
      return {
        ...items[0],
        slug: `week-${number}-test`,
        title: `第 ${number} 周：测试`,
        series: { id: "finger-training-weeks", label: `第 ${number} 周` },
      };
    });
    const html = renderToStaticMarkup(
      createElement(LessonSeriesPicker, {
        items: manyItems,
        currentSlug: "week-6-test",
      }),
    );

    expect(html.match(/<button\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('aria-label="切换训练周次，当前 第 6 周"');
    expect(html.match(/class="week-picker__link/g) ?? []).toHaveLength(12);
    expect(html).toContain('href="/library/week-12-test"');
  });

  it("支持点击外部与 Esc 关闭", () => {
    const source = readFileSync(
      path.join(root, "components", "LessonSeriesPicker.tsx"),
      "utf8",
    );
    expect(source).toContain('document.addEventListener("pointerdown"');
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
  });
});
