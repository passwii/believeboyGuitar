import { describe, expect, it } from "vitest";
import { sanitizeContentHtml } from "@/lib/sanitize-content";

describe("sanitizeContentHtml", () => {
  it("保留正常的语义标签", () => {
    const html = '<article><h2>标题</h2><p>正文 <strong>加粗</strong></p></article>';
    expect(sanitizeContentHtml(html)).toBe(html);
  });

  it("保留组件标记", () => {
    const marker = '<lesson-widget name="c-major-three-notes-per-string"></lesson-widget>';
    expect(sanitizeContentHtml(marker)).toBe(marker);
  });

  it("连同内容删除成对的 script 与 style", () => {
    expect(sanitizeContentHtml('<p>a</p><script>alert(1)</script>')).toBe("<p>a</p>");
    expect(sanitizeContentHtml("<style>p{color:red}</style><p>a</p>")).toBe("<p>a</p>");
  });

  it("删除落单的 script、style、link 标签", () => {
    expect(sanitizeContentHtml('<p>a</p><link rel="stylesheet" href="x.css">')).toBe("<p>a</p>");
    expect(sanitizeContentHtml("<p>a</p></script>")).toBe("<p>a</p>");
  });

  it("删除行内 style 属性，保留标签本身", () => {
    expect(sanitizeContentHtml('<p style="color:red">a</p>')).toBe("<p>a</p>");
    expect(sanitizeContentHtml("<p style='color:red'>a</p>")).toBe("<p>a</p>");
  });

  it("删除事件处理器属性", () => {
    expect(sanitizeContentHtml('<p onclick="alert(1)">a</p>')).toBe("<p>a</p>");
    expect(sanitizeContentHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
  });

  it("不动正文里的普通文字", () => {
    expect(sanitizeContentHtml("<p>style 与 onclick 只是文字</p>")).toBe(
      "<p>style 与 onclick 只是文字</p>",
    );
  });
});
