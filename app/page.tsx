import Link from "next/link";
import type { ReactNode } from "react";
import { lessons, practice } from "@/content/manifest";
import { SECTIONS, SITE, type SectionId } from "@/content/site";
import { recentLessons } from "@/lib/lessons";
import { BPM_MAX, BPM_MIN } from "@/lib/metronome";
import { summarizeTabSections, tabSummaryText, WEEK1_SECTIONS } from "@/lib/tab-exercises";
import { EmptyLibrary } from "@/components/EmptyLibrary";
import { SectionIcon, SiteIcon } from "@/components/SiteIcons";
import { TOOL_PAGES } from "@/components/ToolPages";

/** 分类入口都从 content/site.ts 取，页面里不另写一份路由清单 */
const section = (id: SectionId) => {
  const hit = SECTIONS.find((item) => item.id === id);
  if (hit === undefined) throw new Error(`content/site.ts 缺少分类：${id}`);
  return hit;
};

/** 收尾一行：计数 + 箭头。四个分类卡片共用，保证视线落点一致。 */
function TileFoot({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-end justify-between gap-2">
      <span className="font-mono text-meta tabular-nums text-ink-500">{children}</span>
      <SiteIcon
        name="arrow"
        className="size-4 flex-none text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </span>
  );
}

/**
 * 首页（BLF-1452 Stage 1 + 视觉重设计）。
 *
 * 打开先落到「练习」——第一分类不只是排在最前，它占整张卡片，带本周主题与
 * 曲谱摘要；知识、工具、节拍器是三个并列的分类卡片，图标 + 名称 + 一条计数。
 * 版式是「分类 → 最近整理」，不再有导语、区块小标签和编号行。
 *
 * 数据仍然只有一份：本周练什么来自 `content/manifest.ts` 的 practice，
 * 曲谱摘要由 `lib/tab-exercises.ts` 从谱面推出（品位、速度都不是页面里的
 * 字面量），知识条目来自 manifest，工具清单来自 `components/ToolPages.tsx`。
 */
export default function HomePage() {
  const recent = recentLessons(lessons, 5);
  const week = summarizeTabSections(WEEK1_SECTIONS);
  const metronome = TOOL_PAGES.find((tool) => tool.href === section("metronome").href);

  return (
    <main className="shell flex-1 pt-4 pb-10 sm:py-14">
      <h1 className="sr-only">{SITE.name}</h1>

      <nav aria-label="分类">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {/* 练习：首屏第一个分类，占满一行 */}
          <li className="col-span-2 sm:col-span-3">
            <Link
              id="home-practice"
              href={section("practice").href}
              className="tile group sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-10"
            >
              <span className="flex flex-col">
                <span className="flex items-center gap-2.5">
                  <SectionIcon id="practice" className="size-6 text-ink-500" />
                  <span className="text-title text-ink-950">练习</span>
                  <span className="rounded-pill bg-surface-muted px-2.5 py-0.5 font-mono text-meta tabular-nums text-ink-700">
                    第 {practice.current.week} 周
                  </span>
                </span>
                <span className="mt-5 block font-display text-display text-balance text-ink-950">
                  {practice.current.title}
                </span>
              </span>
              <span className="mt-5 flex sm:mt-0 sm:justify-end">
                <TileFoot>{tabSummaryText(week)}</TileFoot>
              </span>
            </Link>
          </li>

          <li>
            <Link id="home-knowledge" href={section("knowledge").href} className="tile group">
              <span className="flex items-center gap-2.5">
                <SectionIcon id="knowledge" className="size-6 text-ink-500" />
                <span className="text-title text-ink-950">知识</span>
              </span>
              <TileFoot>共 {lessons.length} 篇</TileFoot>
            </Link>
          </li>

          <li>
            <Link id="home-tools" href={section("tools").href} className="tile group">
              <span className="flex items-center gap-2.5">
                <SectionIcon id="tools" className="size-6 text-ink-500" />
                <span className="text-title text-ink-950">工具</span>
              </span>
              <TileFoot>共 {TOOL_PAGES.length} 个</TileFoot>
            </Link>
          </li>

          <li className="col-span-2 sm:col-span-1">
            <Link id="home-metronome" href={section("metronome").href} className="tile group">
              <span className="flex items-center gap-2.5">
                <SectionIcon id="metronome" className="size-6 text-ink-500" />
                <span className="text-title text-ink-950">
                  {metronome?.name ?? section("metronome").label}
                </span>
              </span>
              <TileFoot>
                {BPM_MIN}–{BPM_MAX} BPM
              </TileFoot>
            </Link>
          </li>
        </ul>
      </nav>

      <section aria-labelledby="recent-heading" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-heading" className="text-label font-medium text-ink-700">
            最近整理
          </h2>
          <Link
            href={section("knowledge").href}
            aria-label="全部知识"
            className="flex min-h-11 items-center text-label text-accent-700"
          >
            全部
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <ul className="mt-1 border-t border-rule">
            {recent.map((lesson) => (
              <li key={lesson.slug}>
                <Link
                  href={`/library/${lesson.slug}`}
                  className="flex min-h-11 items-center justify-between gap-4 border-b border-rule py-3 text-ink-950 transition-colors duration-150 hover:text-accent-700"
                >
                  <span className="min-w-0 flex-1 text-body text-pretty">{lesson.title}</span>
                  <span className="flex-none font-mono text-meta tabular-nums text-ink-500">
                    {lesson.updatedAt}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
