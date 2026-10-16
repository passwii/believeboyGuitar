import { describe, expect, it } from "vitest";
import type { Lesson } from "@/content/manifest";
import { filterLessons, matchesFilter, recentLessons, sortByUpdatedAt } from "@/lib/lessons";

function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, "slug">): Lesson {
  return {
    title: overrides.slug,
    summary: "",
    stage: "入门",
    topics: ["技巧"],
    tags: [],
    difficulty: 1,
    source: "测试",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("sortByUpdatedAt", () => {
  it("按整理时间倒序排列", () => {
    const result = sortByUpdatedAt([
      makeLesson({ slug: "old", updatedAt: "2026-01-01" }),
      makeLesson({ slug: "new", updatedAt: "2026-03-01" }),
      makeLesson({ slug: "mid", updatedAt: "2026-02-01" }),
    ]);
    expect(result.map((lesson) => lesson.slug)).toEqual(["new", "mid", "old"]);
  });

  it("不修改传入的数组", () => {
    const input = [
      makeLesson({ slug: "a", updatedAt: "2026-01-01" }),
      makeLesson({ slug: "b", updatedAt: "2026-02-01" }),
    ];
    sortByUpdatedAt(input);
    expect(input.map((lesson) => lesson.slug)).toEqual(["a", "b"]);
  });
});

describe("recentLessons", () => {
  it("返回最近的若干篇", () => {
    const result = recentLessons(
      [
        makeLesson({ slug: "old", updatedAt: "2026-01-01" }),
        makeLesson({ slug: "new", updatedAt: "2026-03-01" }),
      ],
      1,
    );
    expect(result.map((lesson) => lesson.slug)).toEqual(["new"]);
  });
});

describe("matchesFilter", () => {
  const lesson = makeLesson({
    slug: "pentatonic",
    title: "五声音阶",
    summary: "小调五声音阶的指型",
    stage: "基础",
    topics: ["音阶与指板"],
    tags: ["音阶", "即兴"],
    difficulty: 3,
  });

  it("空筛选条件匹配一切", () => {
    expect(matchesFilter(lesson, {})).toBe(true);
  });

  it("按标题匹配关键词", () => {
    expect(matchesFilter(lesson, { query: "五声" })).toBe(true);
    expect(matchesFilter(lesson, { query: "和弦" })).toBe(false);
  });

  it("按标签匹配关键词，且忽略大小写与首尾空格", () => {
    expect(matchesFilter(lesson, { query: "  即兴  " })).toBe(true);
    expect(matchesFilter(makeLesson({ slug: "x", tags: ["BPM"] }), { query: "bpm" })).toBe(true);
  });

  it("按主题筛选，命中任一即可", () => {
    expect(matchesFilter(lesson, { topics: ["音阶与指板", "乐理"] })).toBe(true);
    expect(matchesFilter(lesson, { topics: ["乐理"] })).toBe(false);
  });

  it("按阶段筛选", () => {
    expect(matchesFilter(lesson, { stages: ["基础"] })).toBe(true);
    expect(matchesFilter(lesson, { stages: ["进阶"] })).toBe(false);
  });

  it("按难度筛选", () => {
    expect(matchesFilter(lesson, { difficulty: [3, 4] })).toBe(true);
    expect(matchesFilter(lesson, { difficulty: [1] })).toBe(false);
  });

  it("多个维度之间是且的关系", () => {
    expect(matchesFilter(lesson, { query: "五声", stages: ["基础"] })).toBe(true);
    expect(matchesFilter(lesson, { query: "五声", stages: ["进阶"] })).toBe(false);
  });
});

describe("filterLessons", () => {
  it("筛选后仍按时间倒序", () => {
    const result = filterLessons(
      [
        makeLesson({ slug: "a", stage: "基础", updatedAt: "2026-01-01" }),
        makeLesson({ slug: "b", stage: "基础", updatedAt: "2026-03-01" }),
        makeLesson({ slug: "c", stage: "进阶", updatedAt: "2026-02-01" }),
      ],
      { stages: ["基础"] },
    );
    expect(result.map((lesson) => lesson.slug)).toEqual(["b", "a"]);
  });
});
