import Link from "next/link";
import { Icon } from "@/components/icons";
import { practiceWeeks } from "@/content/manifest";
import { practiceSections, practiceSectionAnchor } from "@/lib/practice-sections";
import { latestPracticeWeek, practiceHref } from "@/lib/weekly";

export default function HomePage() {
  const latest = latestPracticeWeek(practiceWeeks);
  const sections = latest ? practiceSections(latest.slug) : [];
  const weekNumber = latest?.label.match(/\d+/)?.[0]?.padStart(2, "0") ?? "—";

  return (
    <main className="shell flex-1 py-8 sm:py-12">
      <section className="home-hero">
        <div>
          <p className="text-micro font-medium uppercase text-ink-500">练习台 · {latest?.label}</p>
          <span className="home-week-number">{weekNumber}</span>
          <h1 className="text-display font-display text-ink-950">{latest?.title ?? "开始练习"}</h1>
          <p className="mt-3 text-body text-ink-700">{latest?.focus}</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              href={practiceHref(latest)}
              className="inline-flex min-h-11 items-center rounded-control bg-accent-700 px-5 text-label font-semibold text-on-accent"
            >
              开始练习
            </Link>
            <Link
              href="/metronome"
              className="inline-flex min-h-11 items-center rounded-control border border-rule bg-surface px-5 text-label font-medium text-ink-700"
            >
              打开节拍器
            </Link>
          </div>
        </div>
        <aside className="home-hero__aside">
          <strong>{String(sections.length).padStart(2, "0")}</strong>
          <span>本周练习段</span>
          <div>
            <b>{practiceWeeks.length}</b>
            <small>个训练周</small>
          </div>
        </aside>
      </section>

      <div className="home-grid">
        <section aria-labelledby="week-sections-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 id="week-sections-heading" className="text-title text-ink-950">
              本周谱例
            </h2>
            <Link href="/practice" className="text-label font-medium text-accent-700">
              全部周次
            </Link>
          </div>
          <ol className="mt-3 border-t border-rule">
            {sections.map((section, index) => (
              <li key={section.id} className="border-b border-rule">
                <Link
                  href={
                    latest
                      ? `${practiceHref(latest)}#${practiceSectionAnchor(latest.slug, section.id)}`
                      : "/practice"
                  }
                  className="grid min-h-14 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-1 text-ink-950"
                >
                  <span className="font-mono text-meta text-ink-300 tabular-nums">
                    {String(index).padStart(2, "0")}
                  </span>
                  <span className="text-label font-semibold">{section.title}</span>
                  <span className="font-mono text-meta text-ink-500 tabular-nums">
                    {section.bpm}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <aside aria-labelledby="quick-links-heading">
          <h2 id="quick-links-heading" className="text-title text-ink-950">
            快捷入口
          </h2>
          <div className="mt-3 border-t border-rule">
            <Link href="/library" className="home-quick-link">
              <span className="home-quick-link__icon">
                <Icon name="library" className="size-[18px]" />
              </span>
              <span>
                <strong>资料库</strong>
                <small>指板音阶 · 1 份</small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/metronome" className="home-quick-link">
              <span className="home-quick-link__icon">
                <Icon name="metronome" className="size-[18px]" />
              </span>
              <span>
                <strong>节拍器</strong>
                <small>专注单屏 · 可后台运行</small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
