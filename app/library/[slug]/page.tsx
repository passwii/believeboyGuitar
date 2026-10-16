import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lessons } from "@/content/manifest";
import { LessonWidget } from "@/components/LessonWidget";
import { splitContentSections } from "@/lib/content-sections";
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
  const sections = splitContentSections(sanitizeContentHtml(html));

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/library" className="text-sm text-ink-500 hover:text-accent-700">
        ← 资料库
      </Link>

      <header className="mt-4 border-b border-ink-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 text-sm text-ink-700">{lesson.summary}</p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <div className="flex gap-1">
            <dt className="text-ink-500">阶段</dt>
            <dd className="text-ink-700">{lesson.stage}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-500">难度</dt>
            <dd className="text-ink-700">
              {"★".repeat(lesson.difficulty)}
              {"☆".repeat(5 - lesson.difficulty)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-500">主题</dt>
            <dd className="text-ink-700">{lesson.topics.join(" / ")}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-500">整理于</dt>
            <dd className="text-ink-700">{lesson.updatedAt}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-8 space-y-8">
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

      <footer className="mt-12 border-t border-ink-200 pt-6 text-xs text-ink-500">
        <p>来源：{lesson.source}</p>
        {lesson.tags.length > 0 && <p className="mt-1">标签：{lesson.tags.join(" · ")}</p>}
      </footer>
    </main>
  );
}
