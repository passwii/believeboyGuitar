import Link from "next/link";
import { home, lessons } from "@/content/manifest";
import { recentLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";

export default function HomePage() {
  const recent = recentLessons(lessons, 4);

  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <p className="text-micro font-medium uppercase text-ink-500">Studio field notes</p>
        <h1 className="mt-3 text-display font-display text-ink-950 text-balance">
          电吉他学习资料库
        </h1>
        <p className="mt-4 text-body text-ink-700 text-pretty">
          把收集到的资料整理改写成可以直接阅读、能长期积累的学习内容。
        </p>
      </header>

      <section className="mt-12" aria-labelledby="goals-heading">
        <h2
          id="goals-heading"
          className="text-micro font-medium uppercase text-ink-500"
        >
          近期学习目标
        </h2>
        {home.goals.length === 0 ? (
          <p className="mt-3 measure text-body text-ink-700">
            还没有设定目标。在 content/manifest.ts 的 home.goals 里补充。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {home.goals.map((goal) => (
              <li key={goal.title} className="measure py-5">
                <p className="text-title text-ink-950 text-pretty">{goal.title}</p>
                {goal.detail !== "" && (
                  <p className="mt-1.5 text-body text-ink-700 text-pretty">{goal.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="recent-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-heading" className="text-micro font-medium uppercase text-ink-500">
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
    </main>
  );
}
