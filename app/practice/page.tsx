import Link from "next/link";
import { Icon } from "@/components/icons";
import { practiceEntries } from "@/content/manifest";
import { practiceSections } from "@/lib/practice-sections";
import { latestPracticeEntry, practiceHref } from "@/lib/practice";

export const metadata = { title: "练习" };

export default function PracticePage() {
  const latest = latestPracticeEntry(practiceEntries);

  return (
    <main className="shell flex-1 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-micro font-medium uppercase text-ink-500">Practice</p>
          <h1 className="mt-2 text-display font-display text-ink-950">练习</h1>
          <p className="mt-2 text-body text-ink-700">按谱练习，每次只推进一段。</p>
        </div>
        {latest ? (
          <Link
            href={practiceHref(latest)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-accent-700 px-4 text-label font-semibold text-on-accent"
          >
            继续 {latest.label ?? latest.title}
            <Icon name="chevron-right" className="size-3.5" />
          </Link>
        ) : null}
      </header>

      <ol className="mt-8 border-t border-rule">
        {practiceEntries.map((entry, entryIndex) => {
          const sections = practiceSections(entry.slug);
          return (
            <li key={entry.slug} className="border-b border-rule">
              <Link href={`/practice/${entry.slug}`} className="practice-entry-row">
                <span className="practice-entry-row__number">
                  {String(entryIndex + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{entry.label ? `${entry.label} · ` : ""}{entry.title}</strong>
                  <small>{sections.length} 段谱例 · {entry.focus}</small>
                </span>
                <Icon name="chevron-right" className="size-4 text-ink-300" />
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
