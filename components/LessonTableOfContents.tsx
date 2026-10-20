import type { LessonHeading } from "@/lib/content-toc";

export function LessonTableOfContents({ headings }: { headings: LessonHeading[] }) {
  const links = (
    <ol className="space-y-0.5">
      {headings.map(({ id, title }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            className="-ml-2 flex min-h-11 items-start rounded-control px-2 py-2 text-meta leading-snug text-ink-700 transition-colors duration-150 hover:bg-surface-muted hover:text-ink-950"
          >
            {title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav
      aria-label="本文目录"
      className="min-w-0 md:sticky md:top-[calc(var(--nav-h)+1rem)] md:self-start"
    >
      <div className="hidden max-h-[calc(100svh-var(--nav-h)-2rem)] overflow-y-auto md:block">
        <p className="mb-2 pl-0 text-micro font-medium uppercase text-ink-500">本文目录</p>
        {links}
      </div>
      <details className="group rounded-card bg-surface-muted md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-label text-ink-950">
          本文目录
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            fill="none"
            className="size-3 text-ink-700 transition-transform duration-200 group-open:rotate-180"
          >
            <path
              d="M1 1.5L6 6.5l5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="max-h-[50svh] overflow-y-auto px-2 pb-2">{links}</div>
      </details>
    </nav>
  );
}
