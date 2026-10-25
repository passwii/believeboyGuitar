import { TabStaff } from "@/components/TabStaff";
import {
  summarizeTabSections,
  tabSummaryText,
  WEEK1_SECTIONS,
  type TabSection,
} from "@/lib/tab-exercises";

export type TabExerciseProps = {
  /** 默认展示 lib/tab-exercises.ts 中的第 1 周练习。 */
  sections?: readonly TabSection[];
  /** 卡片标题：练习页用「本周曲谱」，正文里的 widget 用默认的第 1 周曲谱。 */
  heading?: string;
};

/**
 * 第 1 周曲谱卡片。
 *
 * 标题下面那行摘要由 `summarizeTabSections` 从谱面算出来（条数 / 速度 /
 * 弦与品位），不再手写——换一周练习时摘要跟着数据走，不会说谎。
 * 每条练习仍是「标题 → 基本要求 → TAB → 注释」四层，不删内容，只压掉
 * 冗余的说明句。
 */
export function TabExercise({
  sections = WEEK1_SECTIONS,
  heading = "第 1 周曲谱",
}: TabExerciseProps) {
  return (
    <section className="rounded-card border border-rule bg-surface p-4 sm:p-6">
      <h2 className="text-title text-ink-950">{heading}</h2>
      <p className="mt-1.5 font-mono text-meta tabular-nums text-ink-500">
        {tabSummaryText(summarizeTabSections(sections))}
      </p>

      <div className="mt-4 divide-y divide-rule">
        {sections.map((section) => (
          <section key={section.id} className="py-5 first:pt-2 last:pb-0">
            <h3 className="text-body font-semibold text-ink-950">{section.title}</h3>
            <p className="mt-1 text-body text-pretty text-ink-700">{section.focus}</p>
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
