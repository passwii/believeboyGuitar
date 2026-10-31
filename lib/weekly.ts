import type { PracticeWeek } from "@/content/manifest";

/** 最新一周按目录顺序取最后一项；目录顺序由使用者维护。 */
export function latestPracticeWeek(
  weeks: readonly PracticeWeek[],
): PracticeWeek | undefined {
  return weeks.at(-1);
}

export function practiceHref(week: PracticeWeek | undefined, fallback = "/practice") {
  return week ? `/practice/${week.slug}` : fallback;
}
