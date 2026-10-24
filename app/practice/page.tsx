import type { Metadata } from "next";
import Link from "next/link";
import { practice } from "@/content/manifest";
import { PracticePlanner } from "@/components/PracticePlanner";
import { TabExercise } from "@/components/TabExercise";

export const metadata: Metadata = {
  title: "练习",
};

/**
 * 练习（BLF-1452 Stage 1）。
 *
 * 首页打开后的第一个分类。只留三块：本周目标（练什么）、本周曲谱
 * （基本要求 + 注释 + TAB）、练习计划（怎么分配时间）。
 *
 * 刻意不写导语：这一页是拿来照着练的，不是拿来读的。曲谱与要求都来自
 * `lib/tab-exercises.ts`，本周练哪一节来自 `content/manifest.ts` 的 practice，
 * 页面里不写死第二条清单。
 *
 * 打卡 / 进度统计仍不做（CLAUDE.md「刻意不做」）：要加时由使用者明确要求。
 */
export default function PracticeSpacePage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <div className="measure">
        <h1 className="text-display font-display text-balance text-ink-950">练习</h1>

        <section className="mt-8" aria-labelledby="practice-goals-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="practice-goals-heading"
              className="font-mono text-micro font-medium uppercase text-ink-500"
            >
              本周目标
            </h2>
            <Link
              href={`/library/${practice.current.lessonSlug}`}
              className="flex min-h-11 items-center text-label text-accent-700 underline underline-offset-4"
            >
              练习顺序与易错点
            </Link>
          </div>
          <ol className="mt-3 border-t border-rule">
            {practice.goals.map((goal, index) => (
              <li key={goal.title} className="flex gap-4 border-b border-rule py-4">
                <span
                  aria-hidden="true"
                  className="w-7 flex-none pt-1 text-right font-mono text-meta leading-6 text-ink-500"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-title text-pretty text-ink-950">{goal.title}</p>
                  {goal.detail !== "" && (
                    <p className="mt-1.5 text-body text-pretty text-ink-700">{goal.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="practice-week-heading">
          <h2
            id="practice-week-heading"
            className="font-mono text-micro font-medium uppercase text-ink-500"
          >
            本周练习 · 第 {practice.current.week} 周
          </h2>
          <p className="mt-3 text-title text-balance text-ink-950">{practice.current.title}</p>
          <div className="mt-5">
            <TabExercise />
          </div>
        </section>

        <section className="mt-14" aria-labelledby="practice-plan-heading">
          <h2
            id="practice-plan-heading"
            className="font-mono text-micro font-medium uppercase text-ink-500"
          >
            练习计划
          </h2>
          <PracticePlanner />
        </section>
      </div>
    </main>
  );
}
