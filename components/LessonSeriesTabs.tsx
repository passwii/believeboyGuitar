import Link from "next/link";
import type { Lesson } from "@/content/manifest";

export function LessonSeriesTabs({
  items,
  currentSlug,
}: {
  items: readonly Lesson[];
  currentSlug: string;
}) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="训练周次" className="segment-track shrink-0">
      {items.map((item) => {
        const current = item.slug === currentSlug;
        return (
          <Link
            key={item.slug}
            href={`/library/${item.slug}`}
            aria-current={current ? "page" : undefined}
            className={`segment ${
              current ? "bg-surface text-ink-950 shadow-segment" : ""
            }`}
          >
            {item.series?.label ?? item.title}
          </Link>
        );
      })}
    </nav>
  );
}
