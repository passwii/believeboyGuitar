import Link from "next/link";
import type { Lesson } from "@/content/manifest";

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link
      href={`/library/${lesson.slug}`}
      className="block h-full rounded-md border border-ink-200 bg-white p-4 transition-colors hover:border-accent-600"
    >
      <h3 className="font-medium leading-snug text-ink-950">{lesson.title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-700">{lesson.summary}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        <span>{lesson.stage}</span>
        <span aria-label={`难度 ${lesson.difficulty}`}>{"★".repeat(lesson.difficulty)}</span>
        <span>{lesson.topics.join(" / ")}</span>
      </p>
    </Link>
  );
}
