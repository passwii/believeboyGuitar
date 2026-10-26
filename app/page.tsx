import Link from "next/link";
import { home, lessons } from "@/content/manifest";
import { recentLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";
import { QuickPractice } from "@/components/QuickPractice";
import { ToolPages } from "@/components/ToolPages";
import { Icon } from "@/components/icons";

/**
 * 首页 = 练习台（2026-10-25，D3）。
 *
 * 左列是「现在要做的」：先节拍器，再今天的目标。
 * 右列是「接着读的」：最近整理的资料。
 * 顺序仍来自 content/manifest.ts 的 home.goals（唯一事实来源）。
 */
export default function HomePage() {
  const recent = recentLessons(lessons, 4);

  return (
    <main className="shell flex-1 pb-16 pt-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-display font-display text-balance text-ink-950">今天练什么</h1>
          <p className="mt-2 max-w-[34ch] text-body text-pretty text-ink-700">
            先定速度，再开始。练完再看资料。
          </p>
        </div>
        <Link
          href="/library"
          className="hidden min-h-11 items-center gap-1.5 text-label text-ink-700 transition-colors duration-150 hover:text-ink-950 sm:flex"
        >
          <Icon name="library" className="size-4 text-ink-500" />
          全部资料
        </Link>
      </header>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div className="min-w-0">
          <QuickPractice />

          <section className="mt-10" aria-labelledby="goals-heading">
            <h2 id="goals-heading" className="text-title text-ink-950">
              现在要练的
            </h2>
            {home.goals.length === 0 ? (
              <p className="measure mt-3 text-body text-ink-700">
                还没有设定目标。在 content/manifest.ts 的 home.goals 里补充。
              </p>
            ) : (
              <ol className="mt-3 border-t border-rule">
                {home.goals.map((goal, index) => (
                  <li key={goal.title} className="flex gap-4 border-b border-rule py-4">
                    <span
                      aria-hidden="true"
                      className="w-6 flex-none pt-1 text-right font-mono text-meta leading-6 text-ink-500 tabular-nums"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-pretty text-title text-ink-950">{goal.title}</p>
                      {goal.detail !== "" && (
                        <p className="mt-1 text-pretty text-body text-ink-700">{goal.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section aria-labelledby="recent-heading" className="min-w-0">
          <h2 id="recent-heading" className="text-title text-ink-950">
            最近整理
          </h2>
          {recent.length === 0 ? (
            <EmptyLibrary />
          ) : (
            <ul className="mt-3 divide-y divide-rule border-t border-rule">
              {recent.map((lesson) => (
                <li key={lesson.slug}>
                  <LessonCard lesson={lesson} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ToolPages />
    </main>
  );
}
