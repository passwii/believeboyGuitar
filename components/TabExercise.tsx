import { useId } from "react";
import { TabStaff } from "@/components/TabStaff";
import { WEEK1_SECTIONS, type TabSection } from "@/lib/tab-exercises";

export type TabExerciseProps = {
  /** 默认展示 lib/tab-exercises.ts 中的第 1 周练习。 */
  sections?: readonly TabSection[];
};

export function TabExercise({ sections = WEEK1_SECTIONS }: TabExerciseProps) {
  const idPrefix = useId().replaceAll(":", "");

  return (
    <section
      aria-labelledby={`${idPrefix}-heading`}
      className="rounded-card border border-rule bg-surface p-4 sm:p-6"
    >
      <h2 id="week1-tab-drill-heading" className="text-title text-ink-950">
        第 1 周指法练习
      </h2>
      <div className="mt-4 divide-y divide-rule">
        {sections.map((section, index) => (
          <section
            key={section.id}
            aria-labelledby={`${idPrefix}-section-${section.id}`}
            className={index === 0 ? "py-4 first:pt-0" : "py-4"}
          >
            <h3
              id={`${idPrefix}-section-${section.id}`}
              className="text-label font-semibold text-ink-950"
            >
              {section.title}
            </h3>
            <TabStaff
              notes={section.notes}
              bpm={section.bpm}
              beatsPerMeasure={section.beatsPerMeasure}
              cdStart={section.cdStart}
            />
            <p className="mt-3 text-body text-ink-700">
              <strong className="font-semibold text-ink-950">练习要点：</strong>
              {section.focus}
            </p>
            <p className="mt-2 text-meta leading-relaxed text-ink-500">
              <strong className="font-medium text-ink-700">提示：</strong>
              {section.tip}
            </p>
          </section>
        ))}
      </div>
    </section>
  );
}
