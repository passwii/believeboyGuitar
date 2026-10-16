import type { Lesson, Stage, Topic } from "@/content/manifest";

export interface LessonFilter {
  query?: string;
  topics?: Topic[];
  stages?: Stage[];
  difficulty?: number[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function sortByUpdatedAt(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

export function recentLessons(lessons: Lesson[], count: number): Lesson[] {
  return sortByUpdatedAt(lessons).slice(0, count);
}

export function matchesFilter(lesson: Lesson, filter: LessonFilter): boolean {
  const query = normalize(filter.query ?? "");
  if (query !== "") {
    const haystack = [lesson.title, lesson.summary, ...lesson.topics, ...lesson.tags]
      .map(normalize)
      .join(" ");
    if (!haystack.includes(query)) return false;
  }

  const topics = filter.topics ?? [];
  if (topics.length > 0 && !topics.some((topic) => lesson.topics.includes(topic))) {
    return false;
  }

  const stages = filter.stages ?? [];
  if (stages.length > 0 && !stages.includes(lesson.stage)) {
    return false;
  }

  const difficulty = filter.difficulty ?? [];
  if (difficulty.length > 0 && !difficulty.includes(lesson.difficulty)) {
    return false;
  }

  return true;
}

export function filterLessons(lessons: Lesson[], filter: LessonFilter): Lesson[] {
  return sortByUpdatedAt(lessons.filter((lesson) => matchesFilter(lesson, filter)));
}
