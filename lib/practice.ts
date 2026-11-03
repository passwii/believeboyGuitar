import type { PracticeEntry } from "@/content/manifest";

/** 最新练习条目按目录顺序取最后一项；目录顺序由使用者维护。 */
export function latestPracticeEntry(
  entries: readonly PracticeEntry[],
): PracticeEntry | undefined {
  return entries.at(-1);
}

/** 首页的训练周摘要只从周练条目中取最新项。 */
export function latestPracticeWeek(
  entries: readonly PracticeEntry[],
): PracticeEntry | undefined {
  return entries.filter((entry) => entry.kind === "week").at(-1);
}

export function practiceHref(entry: PracticeEntry | undefined, fallback = "/practice") {
  return entry ? `/practice/${entry.slug}` : fallback;
}
