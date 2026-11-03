import { describe, expect, it } from "vitest";
import { practiceEntries } from "@/content/manifest";
import { latestPracticeEntry, latestPracticeWeek, practiceHref } from "@/lib/practice";

describe("练习条目目录", () => {
  it("最新条目取目录最后一项，并生成练习路由", () => {
    const latest = latestPracticeEntry(practiceEntries);
    expect(latest?.slug).toBe("rock-rhythm-pattern");
    expect(practiceHref(latest)).toBe("/practice/rock-rhythm-pattern");
  });

  it("没有练习条目时退回练习中心", () => {
    expect(latestPracticeEntry([])).toBeUndefined();
    expect(practiceHref(undefined)).toBe("/practice");
  });

  it("新专项练习独立列入目录，首页周摘要仍取第 2 周", () => {
    expect(practiceEntries.at(-1)).toMatchObject({
      kind: "standalone",
      title: "摇滚节奏型",
      slug: "rock-rhythm-pattern",
    });
    expect(latestPracticeWeek(practiceEntries)?.slug).toBe("week-2-alternate-picking");
  });
});
