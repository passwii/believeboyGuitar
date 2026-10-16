import { describe, expect, it } from "vitest";
import type { Lesson } from "@/content/manifest";
import {
  checkManifestAgainstFiles,
  runContentCheck,
  validateContentHtml,
  validateLessonMetadata,
} from "@/lib/content-check";

function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, "slug">): Lesson {
  return {
    title: "标题",
    summary: "简介",
    stage: "入门",
    topics: ["技巧"],
    tags: [],
    difficulty: 1,
    source: "某本书",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("validateLessonMetadata", () => {
  it("接受一条合法记录", () => {
    expect(validateLessonMetadata(makeLesson({ slug: "pentatonic" }))).toEqual([]);
  });

  it("拒绝非 kebab-case 的 slug", () => {
    const issues = validateLessonMetadata(makeLesson({ slug: "Penta_Tonic" }));
    expect(issues.some((issue) => issue.includes("slug"))).toBe(true);
  });

  it("拒绝空的 title、summary、source", () => {
    const issues = validateLessonMetadata(
      makeLesson({ slug: "a", title: "  ", summary: "", source: "" }),
    );
    expect(issues.filter((issue) => issue.includes("不能为空"))).toHaveLength(3);
  });

  it("拒绝非法日期格式", () => {
    const issues = validateLessonMetadata(makeLesson({ slug: "a", updatedAt: "2026/1/1" }));
    expect(issues.some((issue) => issue.includes("YYYY-MM-DD"))).toBe(true);
  });

  it("拒绝越界难度", () => {
    const issues = validateLessonMetadata(
      makeLesson({ slug: "a", difficulty: 9 as unknown as Lesson["difficulty"] }),
    );
    expect(issues.some((issue) => issue.includes("difficulty"))).toBe(true);
  });

  it("要求至少一个主题，且主题在允许值内", () => {
    expect(
      validateLessonMetadata(makeLesson({ slug: "a", topics: [] })).some((issue) =>
        issue.includes("至少需要一个 topic"),
      ),
    ).toBe(true);
    expect(
      validateLessonMetadata(
        makeLesson({ slug: "a", topics: ["不存在"] as unknown as Lesson["topics"] }),
      ).some((issue) => issue.includes("不在允许值内")),
    ).toBe(true);
  });
});

describe("checkManifestAgainstFiles", () => {
  it("清单与文件一一对应时无问题", () => {
    expect(
      checkManifestAgainstFiles(
        [makeLesson({ slug: "a" }), makeLesson({ slug: "b" })],
        ["a.html", "b.html"],
      ),
    ).toEqual([]);
  });

  it("报告重复 slug", () => {
    const issues = checkManifestAgainstFiles(
      [makeLesson({ slug: "a" }), makeLesson({ slug: "a" })],
      ["a.html"],
    );
    expect(issues).toEqual(["slug 重复：a"]);
  });

  it("报告缺失的内容文件", () => {
    const issues = checkManifestAgainstFiles([makeLesson({ slug: "a" })], []);
    expect(issues.some((issue) => issue.includes("缺少 content/lessons/a.html"))).toBe(true);
  });

  it("报告游离的内容文件", () => {
    const issues = checkManifestAgainstFiles([], ["orphan.html"]);
    expect(issues.some((issue) => issue.includes("游离内容文件"))).toBe(true);
  });
});

describe("validateContentHtml", () => {
  const valid = "<article>\n<h2>标题</h2>\n<p>正文</p>\n</article>";

  it("接受只含语义标签的正文", () => {
    expect(validateContentHtml(valid, "a")).toEqual([]);
  });

  it("拒绝 script、style、link 与行内 style 属性", () => {
    expect(validateContentHtml(valid + "<script>x</script>", "a")).toHaveLength(1);
    expect(validateContentHtml('<p style="color:red">x</p><article></article>', "a")).toHaveLength(1);
    expect(validateContentHtml('<link rel="x"><article></article>', "a")).toHaveLength(1);
    expect(validateContentHtml("<style>p{}</style><article></article>", "a")).toHaveLength(1);
  });

  it("要求 article 根元素且闭合", () => {
    expect(validateContentHtml("<p>没有根元素</p>", "a").some((i) => i.includes("缺少 <article>"))).toBe(true);
    expect(validateContentHtml("<article><p>未闭合", "a").some((i) => i.includes("未闭合"))).toBe(true);
  });

  it("接受已注册的组件标记", () => {
    const html = `${valid}<lesson-widget name="c-major-three-notes-per-string"></lesson-widget>`;
    expect(validateContentHtml(html, "a")).toEqual([]);
  });

  it("拒绝未注册的组件标记", () => {
    const html = `${valid}<lesson-widget name="not-registered"></lesson-widget>`;
    expect(validateContentHtml(html, "a").some((i) => i.includes("未注册的组件"))).toBe(true);
  });
});

describe("runContentCheck", () => {
  it("汇总额外校验，合法输入返回空数组", () => {
    expect(
      runContentCheck({
        lessons: [makeLesson({ slug: "a" })],
        files: ["a.html"],
        readHtml: () => "<article><p>正文</p></article>",
      }),
    ).toEqual([]);
  });

  it("汇总元数据、文件与正文三类问题", () => {
    const issues = runContentCheck({
      lessons: [makeLesson({ slug: "a", source: "" }), makeLesson({ slug: "b" })],
      files: ["a.html", "orphan.html"],
      readHtml: () => "<p>缺少根元素</p>",
    });
    expect(issues.some((issue) => issue.includes("source 不能为空"))).toBe(true);
    expect(issues.some((issue) => issue.includes("缺少 content/lessons/b.html"))).toBe(true);
    expect(issues.some((issue) => issue.includes("游离内容文件"))).toBe(true);
    expect(issues.some((issue) => issue.includes("缺少 <article>"))).toBe(true);
  });
});
