import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lessons } from "@/content/manifest";
import { DifficultyMeter } from "@/components/DifficultyMeter";
import { LessonWidget } from "@/components/LessonWidget";
import { LessonSeriesTabs } from "@/components/LessonSeriesTabs";
import { Icon } from "@/components/icons";
import { LessonTableOfContents } from "@/components/LessonTableOfContents";
import { splitContentSections } from "@/lib/content-sections";
import { addLessonHeadingIds, shouldShowLessonToc } from "@/lib/content-toc";
import { sanitizeContentHtml } from "@/lib/sanitize-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return lessons.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessons.find((item) => item.slug === slug);
  return { title: lesson ? lesson.title : "电吉他学习资料库" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessons.find((item) => item.slug === slug);
  if (!lesson) notFound();

  const html = await readFile(
    path.join(process.cwd(), "content", "lessons", `${slug}.html`),
    "utf8",
  );
  // 正文来自仓库里的 content/lessons/*.html，不是用户输入；渲染前仍按内容约定清一遍。
  const content = addLessonHeadingIds(sanitizeContentHtml(html));
  const sections = splitContentSections(content.html);
  const isWeeklyPractice = lesson.series?.id === "finger-training-weeks";
  const showToc = shouldShowLessonToc(content.headings) && !isWeeklyPractice;
  const seriesLessons = lesson.series
    ? lessons.filter((item) => item.series?.id === lesson.series?.id)
    : [];

  return (
    <main
      className={`lesson-focus shell flex-1 py-4 sm:py-12 ${
        isWeeklyPractice ? "lesson-focus--weekly" : ""
      }`}
    >
      <div className="lesson-focus__chrome flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="返回首页"
          title="返回首页"
          className="grid size-11 place-items-center rounded-full border border-rule bg-surface text-ink-700"
        >
          <Icon name="home" className="size-4" />
        </Link>
        <LessonSeriesTabs items={seriesLessons} currentSlug={lesson.slug} />
      </div>

      <header className="mt-4 max-w-3xl">
        <h1 className="text-display font-display text-ink-950 text-balance">
          <span className="sm:hidden">{lesson.series?.label ?? lesson.title}</span>
          <span className="max-sm:hidden">{lesson.title}</span>
        </h1>
        <p className="mt-4 measure text-body text-ink-700 text-pretty max-sm:hidden">
          {lesson.summary}
        </p>
        <dl className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4 text-meta text-ink-500 max-sm:hidden">
          <div className="flex items-center gap-1.5">
            <dt>阶段</dt>
            <dd className="text-ink-950">{lesson.stage}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>难度</dt>
            <dd>
              <DifficultyMeter value={lesson.difficulty} />
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>主题</dt>
            <dd className="text-ink-950">{lesson.topics.join(" / ")}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>整理于</dt>
            <dd className="text-ink-950 tabular-nums">{lesson.updatedAt}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-5 border-t-0 pt-0 sm:mt-8 sm:border-t sm:border-rule sm:pt-8">
        <div
          className={`grid gap-6 sm:gap-10 ${
            showToc
              ? "md:grid-cols-[var(--container-rail)_minmax(0,1fr)] md:gap-12"
              : "grid-cols-1"
          }`}
        >
          {showToc && <LessonTableOfContents headings={content.headings} />}
          <article className="min-w-0">
            <div className="space-y-4 sm:space-y-8">
              {sections.map((section, index) =>
                section.kind === "prose" ? (
                  <div
                    key={`prose-${index}`}
                    className="lesson measure"
                    // 正文已由 sanitizeContentHtml 清过，且只来自仓库内 content/lessons/*.html，
                    // 不接受外部输入；见 lib/sanitize-content.ts 与 tests/sanitize-content.test.ts。
                    // pi-lens-ignore: dangerously-set-inner-html
                    dangerouslySetInnerHTML={{ __html: section.html }}
                  />
                ) : (
                  <LessonWidget key={`widget-${index}`} name={section.name} />
                ),
              )}
            </div>

            <footer
              className={`measure mt-14 border-t border-rule pt-5 text-meta text-ink-500 ${
                isWeeklyPractice ? "max-sm:hidden" : ""
              }`}
            >
              <p className="text-pretty">来源：{lesson.source}</p>
              {lesson.tags.length > 0 && (
                <p className="mt-1.5">标签：{lesson.tags.join(" · ")}</p>
              )}
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
