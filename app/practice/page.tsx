import type { Metadata } from "next";
import Link from "next/link";
import { practice } from "@/content/manifest";
import { PracticePlanner } from "@/components/PracticePlanner";
import { SectionIcon, SiteIcon } from "@/components/SiteIcons";
import { TabExercise } from "@/components/TabExercise";

export const metadata: Metadata = {
  title: "练习",
};

/**
 * 练习（BLF-1452 Stage 1 + 视觉重设计）。
 *
 * 首页打开后的第一个分类。一页三块：本周目标（练什么）、本周曲谱
 * （基本要求 + 注释 + TAB）、练习计划（怎么分配时间）。
 *
 * 版式：图标 + 标题 + 周次胶囊作为页头，接着是本周主题；目标收成可展开的
 * 三行——标题一眼看完，怎么练的细节按需展开。目标详情不删，只是不再一次性
 * 铺满一屏。曲谱卡自己给一条由谱面推出的摘要（条数 / 速度 / 弦与品位）。
 *
 * 曲谱与要求都来自 `lib/tab-exercises.ts`，本周练哪一节来自
 * `content/manifest.ts` 的 practice，页面里不写死第二条清单。
 * 打卡 / 进度统计仍不做（CLAUDE.md「刻意不做」）。
 */
export default function PracticeSpacePage() {
  const lesson = practice.current.lessonSlug;

  return (
    <main className="shell flex-1 pt-4 pb-10 sm:py-14">
      <div className="sheet">
        <header className="flex items-center gap-2.5">
          <SectionIcon id="practice" className="size-6 flex-none text-ink-500" />
          <h1 className="text-title font-display text-ink-950">练习</h1>
          <span className="ml-auto rounded-pill bg-surface-muted px-3 py-1 font-mono text-meta tabular-nums text-ink-700">
            第 {practice.current.week} 周
          </span>
        </header>
        <p className="mt-6 font-display text-display text-balance text-ink-950">
          {practice.current.title}
        </p>

        <section className="mt-8" aria-labelledby="practice-goals-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="practice-goals-heading" className="text-label font-medium text-ink-700">
              本周目标
            </h2>
            <Link
              href={`/library/${lesson}`}
              aria-label="本周练习的顺序与易错点"
              className="flex min-h-11 items-center text-label text-accent-700"
            >
              易错点
            </Link>
          </div>
          <ol className="mt-1 border-t border-rule">
            {practice.goals.map((goal, index) => (
              <li key={goal.title} className="border-b border-rule">
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden="true"
                      className="w-6 flex-none font-mono text-meta tabular-nums text-ink-500"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-body font-medium text-ink-950">
                      {goal.title}
                    </span>
                    <SiteIcon
                      name="chevron"
                      className="size-3.5 flex-none rotate-90 text-ink-300 transition-transform duration-150 group-open:-rotate-90"
                    />
                  </summary>
                  <p className="mb-4 ml-9 mr-1 text-body text-pretty text-ink-700">
                    {goal.detail}
                  </p>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10">
          <TabExercise heading="本周曲谱" />
        </div>

        <section className="mt-12" aria-labelledby="practice-plan-heading">
          <h2
            id="practice-plan-heading"
            className="text-label font-medium text-ink-700"
          >
            练习计划
          </h2>
          <PracticePlanner />
        </section>
      </div>
    </main>
  );
}
