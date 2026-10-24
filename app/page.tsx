import Link from "next/link";
import { home, lessons } from "@/content/manifest";
import { recentLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";
import { ToolPages } from "@/components/ToolPages";

/**
 * 书桌（首页，BLF-1451）。
 *
 * 顺序是拍板过的：学习目标永远第一屏，然后才是最近整理与工具。
 * 目标来自 content/manifest.ts 的 home.goals（唯一事实来源），
 * 编号排版取方向 C 的编目感：等宽数字 + 发丝线行。
 */
export default function HomePage() {
  const recent = recentLessons(lessons, 4);

  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <p className="font-mono text-micro font-medium uppercase text-ink-500">
          Studio field notes
        </p>
        <h1 className="mt-3 text-display font-display text-balance text-ink-950">
          电吉他学习资料库
        </h1>
        <p className="mt-4 text-body text-pretty text-ink-700">
          把收集到的资料整理改写成可以直接阅读、能长期积累的学习内容。
        </p>
      </header>

      {/* 第一屏：学习目标（2026-10 拍板） */}
      <section className="mt-10" aria-labelledby="goals-heading">
        <h2
          id="goals-heading"
          className="font-mono text-micro font-medium uppercase text-ink-500"
        >
          近期学习目标
        </h2>
        {home.goals.length === 0 ? (
          <p className="measure mt-3 text-body text-ink-700">
            还没有设定目标。在 content/manifest.ts 的 home.goals 里补充。
          </p>
        ) : (
          <ol className="mt-3 border-t border-rule">
            {home.goals.map((goal, index) => (
              <li
                key={goal.title}
                className="flex gap-4 border-b border-rule py-5"
              >
                <span
                  aria-hidden="true"
                  className="w-7 flex-none pt-1 text-right font-mono text-meta leading-6 text-ink-500"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-pretty text-title text-ink-950">
                    {goal.title}
                  </p>
                  {goal.detail !== "" && (
                    <p className="mt-1.5 text-body text-pretty text-ink-700">
                      {goal.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-12" aria-labelledby="recent-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="recent-heading"
            className="font-mono text-micro font-medium uppercase text-ink-500"
          >
            最近整理
          </h2>
          <Link
            href="/library"
            className="flex min-h-11 items-center text-label text-accent-700 underline underline-offset-4"
          >
            全部资料
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <ul className="divide-y divide-rule border-t border-rule">
            {recent.map((lesson) => (
              <li key={lesson.slug}>
                <LessonCard lesson={lesson} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ToolPages />
    </main>
  );
}
