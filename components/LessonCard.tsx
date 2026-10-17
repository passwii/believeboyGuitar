import Link from "next/link";
import type { Lesson } from "@/content/manifest";

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link
      href={`/library/${lesson.slug}`}
      className="group block min-w-0 break-words py-6"
    >
      <h3 className="text-xl font-medium leading-snug text-ink underline decoration-rule underline-offset-4 group-hover:text-accent group-hover:decoration-accent">
        {lesson.title}
      </h3>
      <p className="mt-3 max-w-3xl text-base leading-[1.8] text-ink-muted">{lesson.summary}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span>{lesson.stage}</span>
        <span>难度 {lesson.difficulty}</span>
        <span>{lesson.topics.join(" / ")}</span>
      </p>
    </Link>
  );
}
