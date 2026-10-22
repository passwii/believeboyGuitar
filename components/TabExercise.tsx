import { TabStaff } from "@/components/TabStaff";
import { WEEK1_SECTIONS, type TabSection } from "@/lib/tab-exercises";

export type TabExerciseProps = {
  /** 默认展示 lib/tab-exercises.ts 中的第 1 周练习。 */
  sections?: readonly TabSection[];
};

export function TabExercise({ sections = WEEK1_SECTIONS }: TabExerciseProps) {
  return (
    <section className="rounded-card border border-rule bg-surface p-4 sm:p-6">
      <h2 className="text-title text-ink-950">第 1 周曲谱</h2>
      <p className="mt-2 text-meta text-ink-500">
        原书第 6 页 · CD TRACK 01 · 四条练习都在 6 弦 5–8 品，速度 ♩=100
      </p>

      <div className="mt-4 divide-y divide-rule">
        {sections.map((section) => (
          <section key={section.id} className="py-5 first:pt-0 last:pb-0">
            <h3 className="text-body font-semibold text-ink-950">{section.title}</h3>
            <p className="mt-1 text-body text-ink-700">{section.focus}</p>
            <div className="mt-3">
              <TabStaff
                measures={section.measures}
                bpm={section.bpm}
                cdStart={section.cdStart}
                title={`${section.title} TAB 谱`}
              />
            </div>
            <p className="mt-3 text-meta leading-relaxed text-ink-500">
              <strong className="font-medium text-ink-700">提示：</strong>
              {section.tip}
            </p>
          </section>
        ))}
      </div>
    </section>
  );
}
