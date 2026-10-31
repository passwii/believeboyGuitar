import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeWeekPicker } from "@/components/PracticeWeekPicker";
import { practiceWeeks } from "@/content/manifest";

const root = process.cwd();

describe("练习周次选择器", () => {
  it("只显示当前周，展开后链接到练习路由", () => {
    const html = renderToStaticMarkup(
      createElement(PracticeWeekPicker, {
        items: practiceWeeks,
        currentSlug: "week-2-alternate-picking",
      }),
    );
    expect(html).toContain("第 2 周");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('href="/practice/week-1-finger-independence"');
    expect(html).toContain('href="/practice/week-2-alternate-picking"');
    expect(html).toContain('aria-current="page"');
  });

  it("支持点击外部与 Esc 关闭", () => {
    const source = readFileSync(
      path.join(root, "components", "PracticeWeekPicker.tsx"),
      "utf8",
    );
    expect(source).toContain('document.addEventListener("pointerdown"');
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
  });
});
