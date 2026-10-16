import Link from "next/link";
import { home, lessons } from "@/content/manifest";
import { recentLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";

export default function HomePage() {
  const recent = recentLessons(lessons, 4);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">电吉他学习资料库</h1>
      <p className="mt-2 text-sm text-ink-700">
        把收集到的资料整理改写成可以直接阅读、能长期积累的学习内容。
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-ink-500">近期学习目标</h2>
        {home.goals.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-ink-200 bg-white p-4 text-sm text-ink-500">
            还没有设定目标。在 content/manifest.ts 的 home.goals 里补充。
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {home.goals.map((goal) => (
              <li key={goal.title} className="rounded-md border border-ink-200 bg-white p-4">
                <p className="font-medium text-ink-950">{goal.title}</p>
                {goal.detail !== "" && (
                  <p className="mt-1 text-sm text-ink-700">{goal.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-500">最近整理</h2>
          <Link href="/library" className="text-sm text-accent-700 hover:underline">
            全部资料 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
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
