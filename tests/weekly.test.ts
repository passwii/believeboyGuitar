import { describe, expect, it } from "vitest";
import { practiceWeeks } from "@/content/manifest";
import { latestPracticeWeek, practiceHref } from "@/lib/weekly";

describe("周练目录", () => {
  it("最新周取目录最后一项，并生成练习路由", () => {
    const latest = latestPracticeWeek(practiceWeeks);
    expect(latest?.slug).toBe("week-2-alternate-picking");
    expect(practiceHref(latest)).toBe("/practice/week-2-alternate-picking");
  });

  it("没有周练时退回练习中心", () => {
    expect(latestPracticeWeek([])).toBeUndefined();
    expect(practiceHref(undefined)).toBe("/practice");
  });
});
