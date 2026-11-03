import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeEntryPicker } from "@/components/PracticeEntryPicker";
import { practiceEntries } from "@/content/manifest";

const root = process.cwd();

describe("练习条目选择器", () => {
  it("显示当前独立练习名称，展开后链接到所有练习", () => {
    const html = renderToStaticMarkup(
      createElement(PracticeEntryPicker, {
        items: practiceEntries,
        currentSlug: "rock-rhythm-pattern",
      }),
    );
    expect(html).toContain("摇滚节奏型");
    expect(html).toContain('aria-label="切换练习，当前 摇滚节奏型"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('href="/practice/week-1-finger-independence"');
    expect(html).toContain('href="/practice/week-2-alternate-picking"');
    expect(html).toContain('href="/practice/rock-rhythm-pattern"');
    expect(html).toContain("选择练习");
    expect(html).toContain('aria-current="page"');
  });

  it("支持点击外部与 Esc 关闭", () => {
    const source = readFileSync(
      path.join(root, "components", "PracticeEntryPicker.tsx"),
      "utf8",
    );
    expect(source).toContain('document.addEventListener("pointerdown"');
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
  });
});
