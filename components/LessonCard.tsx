import Link from "next/link";
import type { Lesson } from "@/content/manifest";
import { DifficultyMeter } from "@/components/DifficultyMeter";
import { Icon } from "@/components/icons";

/**
 * 资料条目。
 *
 * 标题优先，摘要其次，元数据最后；三者用字号与墨色分层，不用色块包住整行。
 * 整行是一个链接，hover 底由 `.row` 提供。
 */
export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link href={`/library/${lesson.slug}`} className="row">
      <span className="min-w-0 flex-1">
        <span className="block text-title text-balance text-ink-950">{lesson.title}</span>
        <span className="mt-1.5 block text-body text-ink-700 text-pretty">
          {lesson.summary}
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-500">
          <span>{lesson.stage}</span>
          <span aria-hidden="true" className="text-rule">
            ·
          </span>
          <DifficultyMeter value={lesson.difficulty} />
          <span aria-hidden="true" className="text-rule">
            ·
          </span>
          <span>{lesson.topics.join(" / ")}</span>
        </span>
      </span>
      <Icon name="chevron-right" className="mt-1.5 size-3.5 shrink-0 self-start text-ink-300" />
    </Link>
  );
}
