import Link from "next/link";
import { lessons, practice } from "@/content/manifest";
import { SITE } from "@/content/site";
import { recentLessons } from "@/lib/lessons";
import { WEEK1_SECTIONS } from "@/lib/tab-exercises";
import { EmptyLibrary } from "@/components/EmptyLibrary";
import { TOOL_PAGES } from "@/components/ToolPages";

/**
 * 首页（BLF-1452 Stage 1）。
 *
 * 打开先落到「练习」——这是这一轮重设计拍板的第一件事。顺序是
 * 练习 → 知识 → 工具（节拍器是工具之一，但它是高频入口，单独一行）。
 *
 * 版式刻意精简：分类靠区块标注 + 编号行区分，条目只给标题与必要元数据。
 * 不再有导语段落——首页是入口，不是说明书。文案与清单都来自
 * `content/manifest.ts`、`content/site.ts` 与 `components/ToolPages.tsx`，
 * 页面里不另立一份资料列表。
 */
export default function HomePage() {
  const recent = recentLessons(lessons, 4);
  const metronome = TOOL_PAGES.find((tool) => tool.href === "/tools/metronome");

  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <h1 className="text-display font-display text-balance text-ink-950">{SITE.name}</h1>
      </header>

      {/* 第一屏：练习 */}
      <section className="measure mt-8" aria-labelledby="practice-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="practice-heading"
            className="font-mono text-micro font-medium uppercase text-ink-500"
          >
            练习
          </h2>
          <Link
            href="/practice"
            className="flex min-h-11 items-center text-label text-accent-700 underline underline-offset-4"
          >
            进入练习
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          <li>
            <Link href="/practice" className="row">
              <span className="min-w-0 flex-1">
                <span className="block text-title text-balance text-ink-950">
                  第 {practice.current.week} 周 · {practice.current.title}
                </span>
                <span className="mt-1.5 block text-meta text-ink-500">
                  {WEEK1_SECTIONS.length} 条练习 · 6 弦 5–8 品 · ♩=
                  {WEEK1_SECTIONS[0]?.bpm ?? 100}
                </span>
              </span>
            </Link>
          </li>
        </ul>
        <ol className="mt-5 space-y-2">
          {practice.goals.map((goal, index) => (
            <li key={goal.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="w-6 flex-none text-right font-mono text-meta leading-7 text-ink-500"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-body text-pretty text-ink-700">{goal.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="measure mt-12" aria-labelledby="knowledge-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="knowledge-heading"
            className="font-mono text-micro font-medium uppercase text-ink-500"
          >
            知识
          </h2>
          <Link
            href="/library"
            className="flex min-h-11 items-center text-label text-accent-700 underline underline-offset-4"
          >
            全部知识
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {recent.map((lesson) => (
              <li key={lesson.slug}>
                <Link href={`/library/${lesson.slug}`} className="row">
                  <span className="min-w-0 flex-1">
                    <span className="block text-title text-balance text-ink-950">
                      {lesson.title}
                    </span>
                    <span className="mt-1 block text-meta text-ink-500">
                      {lesson.topics.join(" / ")} · {lesson.updatedAt}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="measure mt-12" aria-labelledby="tools-heading">
        <h2
          id="tools-heading"
          className="font-mono text-micro font-medium uppercase text-ink-500"
        >
          工具
        </h2>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          <li>
            <Link href="/tools" className="row">
              <span className="min-w-0 flex-1">
                <span className="block text-title text-balance text-ink-950">工具间</span>
                <span className="mt-1 block text-meta text-ink-500">
                  {TOOL_PAGES.filter((tool) => tool.href !== "/tools/metronome")
                    .map((tool) => tool.name)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          </li>
          {metronome !== undefined && (
            <li>
              <Link href={metronome.href} className="row">
                <span className="min-w-0 flex-1">
                  <span className="block text-title text-balance text-ink-950">
                    {metronome.name}
                  </span>
                  <span className="mt-1 block text-meta text-ink-500">
                    拍号 · BPM · 音色
                  </span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
