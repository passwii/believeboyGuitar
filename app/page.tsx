import Link from "next/link";
import { home, lessons } from "@/content/manifest";
import { recentLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";

export default function HomePage() {
  const recent = recentLessons(lessons, 4);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        电吉他学习资料库
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-[1.8] text-ink-muted">
        把收集到的资料整理改写成可以直接阅读、能长期积累的学习内容。
      </p>

      <section className="mt-10 grid gap-4 border-t border-rule py-8 sm:mt-12 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
        <h2 className="text-lg font-medium">近期学习目标</h2>
        {home.goals.length === 0 ? (
          <p className="text-base leading-[1.8] text-ink-muted">
            还没有设定目标。在 content/manifest.ts 的 home.goals 里补充。
          </p>
        ) : (
          <ul className="min-w-0 divide-y divide-rule">
            {home.goals.map((goal) => (
              <li key={goal.title} className="py-5 first:pt-0 last:pb-0">
                <p className="text-lg font-medium text-ink">{goal.title}</p>
                {goal.detail !== "" && (
                  <p className="mt-2 max-w-3xl text-base leading-[1.8] text-ink-muted">
                    {goal.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-rule pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-lg font-medium">最近整理</h2>
          <Link
            href="/library"
            className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4"
          >
            全部资料 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <ul className="mt-3 divide-y divide-rule">
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
