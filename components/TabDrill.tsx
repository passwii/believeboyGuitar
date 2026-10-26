import { TabStaff } from "@/components/TabStaff";
import type { TabSection } from "@/lib/tab-practice";

export type TabDrillLegendItem = {
  symbol: string;
  label: string;
};

export type TabDrillProps = {
  idPrefix: string;
  eyebrow: string;
  title: string;
  summary: string;
  sections: readonly TabSection[];
  legend?: readonly TabDrillLegendItem[];
};

export function TabDrill({
  idPrefix,
  eyebrow,
  title,
  summary,
  sections,
  legend = [],
}: TabDrillProps) {
  const headingId = `${idPrefix}-heading`;
  const totalMeasures = sections.reduce((total, section) => total + section.measures.length, 0);

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 scroll-mt-24 overflow-hidden rounded-card border border-rule bg-surface"
    >
      <header className="border-b border-rule px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-micro font-medium text-ink-500">{eyebrow}</p>
            <h2 id={headingId} className="mt-1 scroll-mt-24 text-title text-ink-950">
              {title}
            </h2>
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-500">
            <div className="flex gap-1">
              <dt>练习</dt>
              <dd className="font-mono text-ink-950 tabular-nums">{sections.length} 段</dd>
            </div>
            <div className="flex gap-1">
              <dt>小节</dt>
              <dd className="font-mono text-ink-950 tabular-nums">{totalMeasures}</dd>
            </div>
            <div className="flex gap-1">
              <dt>弦</dt>
              <dd className="font-mono text-ink-950 tabular-nums">6 弦</dd>
            </div>
          </dl>
        </div>
        <p className="mt-3 text-meta leading-relaxed text-ink-700">{summary}</p>
        {legend.length > 0 ? (
          <ul aria-label="谱面记号图例" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {legend.map((item) => (
              <li key={`${item.symbol}-${item.label}`} className="flex items-center gap-1.5">
                <span className="min-w-5 font-mono text-label font-semibold text-ink-700">
                  {item.symbol}
                </span>
                <span className="text-meta text-ink-500">{item.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="divide-y divide-rule">
        {sections.map((section, index) => {
          const sectionHeadingId = `${idPrefix}-${section.id}`;

          return (
            <section
              key={section.id}
              aria-labelledby={sectionHeadingId}
              className="scroll-mt-24 px-4 py-6 sm:px-6"
            >
              <header className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 w-6 shrink-0 font-mono text-label text-ink-500 tabular-nums"
                >
                  {String(index).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3
                      id={sectionHeadingId}
                      className="scroll-mt-24 text-title text-ink-950"
                    >
                      {section.title}
                    </h3>
                    <span className="inline-flex items-center rounded-pill bg-surface-muted px-2.5 py-1 font-mono text-meta text-ink-700 tabular-nums">
                      ♩ = {section.bpm}
                    </span>
                  </div>
                  <p className="mt-2 text-body text-ink-700 text-pretty">{section.focus}</p>
                </div>
              </header>

              <div className="mt-4 sm:ml-9">
                <TabStaff
                  measures={section.measures}
                  bpm={section.bpm}
                  cdStart={section.cdStart}
                  title={`${section.title} TAB 谱`}
                  meta={[section.rhythm, ...(section.labels ?? [])]}
                />
                <div className="mt-3 border-l-2 border-control-edge pl-3">
                  <p className="text-meta leading-relaxed text-ink-500">
                    <strong className="font-medium text-ink-700">练习提示：</strong>
                    {section.tip}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
