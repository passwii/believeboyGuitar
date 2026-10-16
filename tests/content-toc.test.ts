import { describe, expect, it } from "vitest";
import { addLessonHeadingIds, shouldShowLessonToc } from "@/lib/content-toc";

describe("addLessonHeadingIds", () => {
  it("为 H2 添加稳定锚点并提取纯文本标题", () => {
    const result = addLessonHeadingIds(
      "<article><h2>1. 基础 <code>FX</code></h2><p>正文</p></article>",
    );
    expect(result.headings).toEqual([
      { id: "lesson-heading-1", title: "1. 基础 FX" },
    ]);
    expect(result.html).toContain('<h2 id="lesson-heading-1">');
    expect(result.html).toContain("<p>正文</p>");
  });

  it("没有 H2 时返回空目录", () => {
    expect(addLessonHeadingIds("<article><p>正文</p></article>").headings).toEqual([]);
  });

  it("重复标题仍获得不同锚点，并保留 widget 标记", () => {
    const result = addLessonHeadingIds(
      '<article><h2>重复</h2><lesson-widget name="c-major-three-notes-per-string"></lesson-widget><h2>重复</h2></article>',
    );
    expect(result.headings.map(({ id }) => id)).toEqual([
      "lesson-heading-1",
      "lesson-heading-2",
    ]);
    expect(result.html).toContain(
      '<lesson-widget name="c-major-three-notes-per-string"></lesson-widget>',
    );
  });

  it("保留 H2 的其他属性，解码基本实体并折叠空白", () => {
    const result = addLessonHeadingIds(
      '<h2 class="section">  &lt;FX&gt; &amp; &quot;音色&quot;\n&nbsp;&#39;A&#x42;\'  </h2><h3>小节</h3>',
    );
    expect(result.headings).toEqual([
      { id: "lesson-heading-1", title: '<FX> & "音色" \'AB\'' },
    ]);
    expect(result.html).toContain('<h2 class="section" id="lesson-heading-1">');
    expect(result.html).toContain("<h3>小节</h3>");
  });

  it("替换已有 H2 id，重复调用不产生重复属性且结果幂等", () => {
    const first = addLessonHeadingIds(
      '<h2 id="old" class="section">第一节</h2><h2 id=other>第二节</h2><h2 id=\'third\'>第三节</h2>',
    );
    expect(first.html).toBe(
      '<h2 class="section" id="lesson-heading-1">第一节</h2><h2 id="lesson-heading-2">第二节</h2><h2 id="lesson-heading-3">第三节</h2>',
    );
    expect(addLessonHeadingIds(first.html)).toEqual(first);
  });
});

describe("shouldShowLessonToc", () => {
  it("仅当 H2 数量达到 6 个时显示", () => {
    const headings = Array.from({ length: 6 }, (_, index) => ({
      id: `lesson-heading-${index + 1}`,
      title: `章节 ${index + 1}`,
    }));
    expect(shouldShowLessonToc(headings.slice(0, 5))).toBe(false);
    expect(shouldShowLessonToc(headings)).toBe(true);
  });
});
