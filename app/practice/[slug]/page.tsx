import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { LessonWidget } from "@/components/LessonWidget";
import { PracticeEntryPicker } from "@/components/PracticeEntryPicker";
import { practiceEntries } from "@/content/manifest";
import { splitContentSections } from "@/lib/content-sections";
import { addLessonHeadingIds } from "@/lib/content-headings";
import { sanitizeContentHtml } from "@/lib/sanitize-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return practiceEntries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = practiceEntries.find((item) => item.slug === slug);
  return {
    title: entry
      ? entry.label
        ? `${entry.label}：${entry.title}`
        : entry.title
      : "练习",
  };
}

export default async function PracticeEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = practiceEntries.find((item) => item.slug === slug);
  if (!entry) notFound();

  const html = await readFile(
    path.join(process.cwd(), "content", "lessons", `${slug}.html`),
    "utf8",
  );
  const content = addLessonHeadingIds(sanitizeContentHtml(html));
  const sections = splitContentSections(content.html);

  return (
    <main className="practice-focus shell flex-1 py-4 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="返回首页"
          title="返回首页"
          className="grid size-11 place-items-center rounded-full border border-rule bg-surface text-ink-700"
        >
          <Icon name="home" className="size-4" />
        </Link>
        <PracticeEntryPicker items={practiceEntries} currentSlug={entry.slug} />
      </div>

      <header className="mt-4">
        <h1 className="text-display font-display text-ink-950">
          <span className="sm:hidden">{entry.label ?? entry.title}</span>
          <span className="max-sm:hidden">
            {entry.label ? `${entry.label}：` : ""}{entry.title}
          </span>
        </h1>
      </header>

      <article className="mt-4 min-w-0">
        <div className="space-y-4 sm:space-y-6">
          {sections.map((section, index) =>
            section.kind === "prose" ? (
              <div
                key={`prose-${index}`}
                className="lesson measure"
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            ) : (
              <LessonWidget key={`widget-${index}`} name={section.name} />
            ),
          )}
        </div>
      </article>
    </main>
  );
}
