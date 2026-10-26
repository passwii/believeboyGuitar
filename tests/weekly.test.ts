import { describe, expect, it } from "vitest";
import { lessons } from "@/content/manifest";
import { latestWeeklyLesson, weeklyHref, weeklyLessons } from "@/lib/weekly";

describe("每周练习入口", () => {
  it("只收有 series 的资料", () => {
    const weekly = weeklyLessons(lessons);
    expect(weekly.length).toBeGreaterThanOrEqual(2);
    for (const lesson of weekly) {
      expect(lesson.series?.id).toBe("finger-training-weeks");
    }
  });

  it("取最新一周，并把入口指向它的详情页", () => {
    const latest = latestWeeklyLesson(lessons);
    expect(latest?.slug).toBe("week-2-alternate-picking");
    expect(weeklyHref(lessons)).toBe("/library/week-2-alternate-picking");
  });

  it("没有周次资料时回落到资料库", () => {
    expect(latestWeeklyLesson([])).toBeUndefined();
    expect(weeklyHref([], "/library")).toBe("/library");
  });
});
