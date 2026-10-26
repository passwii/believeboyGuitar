import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonSeriesTabs } from "@/components/LessonSeriesTabs";
import { lessons } from "@/content/manifest";

describe("训练周次切换", () => {
  const items = lessons.filter((lesson) => lesson.series?.id === "finger-training-weeks");

  it("周次来自 manifest，并按顺序链接到两篇资料", () => {
    expect(items.map((lesson) => lesson.series?.label)).toEqual(["第 1 周", "第 2 周"]);

    const html = renderToStaticMarkup(
      createElement(LessonSeriesTabs, {
        items,
        currentSlug: "week-2-alternate-picking",
      }),
    );
    expect(html).toContain('aria-label="训练周次"');
    expect(html).toContain('href="/library/week-1-finger-independence"');
    expect(html).toContain('href="/library/week-2-alternate-picking"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">第 1 周</a>");
    expect(html).toContain(">第 2 周</a>");
  });
});
