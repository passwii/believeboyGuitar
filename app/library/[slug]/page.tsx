import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lessons } from "@/content/manifest";
import { LessonWidget } from "@/components/LessonWidget";
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
  return { title: lesson ? `${lesson.title} · 电吉他学习资料库` : "电吉他学习资料库" };
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
  const showToc = shouldShowLessonToc(content.headings);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:py-14">
      <Link href="/library" className="text-sm text-ink-muted hover:text-accent">
        ← 资料库
      </Link>

      <header className="mt-6 border-b border-rule pb-8">
        <h1 className="max-w-[28em] font-display text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
          {lesson.title}
        </h1>
        <p className="mt-4 max-w-[42em] text-base leading-[1.8] text-ink-muted">
          {lesson.summary}
        </p>
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <div className="flex gap-1">
            <dt className="text-ink-muted">阶段</dt>
            <dd className="text-ink">{lesson.stage}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-muted">难度</dt>
            <dd className="text-ink">
              {"★".repeat(lesson.difficulty)}
              {"☆".repeat(5 - lesson.difficulty)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-muted">主题</dt>
            <dd className="text-ink">{lesson.topics.join(" / ")}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-muted">整理于</dt>
            <dd className="text-ink">{lesson.updatedAt}</dd>
          </div>
        </dl>
      </header>

      <div className={`mt-8 grid gap-8 md:gap-12 ${showToc ? "md:grid-cols-[13rem_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {showToc && <LessonTableOfContents headings={content.headings} />}
        <div className="min-w-0 max-w-[42em]">
          <div className="space-y-8">
            {sections.map((section, index) =>
              section.kind === "prose" ? (
                <div
                  key={`prose-${index}`}
                  className="lesson"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              ) : (
                <LessonWidget key={`widget-${index}`} name={section.name} />
              ),
            )}
          </div>

          <footer className="mt-12 border-t border-rule pt-6 text-xs text-ink-muted">
            <p>来源：{lesson.source}</p>
            {lesson.tags.length > 0 && <p className="mt-1">标签：{lesson.tags.join(" · ")}</p>}
          </footer>
        </div>
      </div>
    </main>
  );
}
