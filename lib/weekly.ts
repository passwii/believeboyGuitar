import type { Lesson } from "@/content/manifest";

/**
 * 每周练习（2026-10-26）。
 *
 * 「练习」入口只认 manifest 里的 series 数据，不额外维护一份周次清单：
 * 新加一周时只在 manifest 里补 series，导航与资料页的周次切换都会跟上。
 *
 * 取最新一周的规则：先按 updatedAt，再按 series.label。两者都是字符串比较，
 * 因为标签是「第 1 周」「第 2 周」这类固定中文格式，顺序稳定。
 */
export function weeklyLessons(all: readonly Lesson[]): Lesson[] {
  return all.filter((lesson) => lesson.series !== undefined);
}

export function latestWeeklyLesson(all: readonly Lesson[]): Lesson | undefined {
  const weekly = weeklyLessons(all);
  if (weekly.length === 0) return undefined;
  return [...weekly].sort((a, b) => {
    const byDate = a.updatedAt.localeCompare(b.updatedAt);
    if (byDate !== 0) return byDate;
    return (a.series?.label ?? "").localeCompare(b.series?.label ?? "");
  })[weekly.length - 1];
}

export function weeklyHref(all: readonly Lesson[], fallback = "/library"): string {
  const latest = latestWeeklyLesson(all);
  return latest ? `/library/${latest.slug}` : fallback;
}
