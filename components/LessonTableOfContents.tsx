import type { LessonHeading } from "@/lib/content-toc";

export function LessonTableOfContents({ headings }: { headings: LessonHeading[] }) {
  const links = (
    <ol className="space-y-1">
      {headings.map(({ id, title }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            className="block py-1 text-sm leading-relaxed text-ink-muted underline-offset-4 hover:text-accent hover:underline"
          >
            {title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav aria-label="本文目录" className="min-w-0 md:sticky md:top-8 md:self-start">
      <div className="hidden max-h-[calc(100vh-4rem)] overflow-y-auto border-l border-rule pl-4 pr-2 md:block">
        <p className="mb-3 text-xs font-semibold tracking-widest text-ink">本文目录</p>
        {links}
      </div>
      <details className="border-y border-rule bg-surface px-4 md:hidden">
        <summary className="cursor-pointer py-3 text-sm font-semibold text-ink">
          本文目录
        </summary>
        <div className="pb-4">{links}</div>
      </details>
    </nav>
  );
}
