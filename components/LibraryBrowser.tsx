"use client";

import { useMemo, useState } from "react";
import {
  DIFFICULTIES,
  STAGES,
  TOPICS,
  type Lesson,
  type Stage,
  type Topic,
} from "@/content/manifest";
import { filterLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";
import { Icon } from "@/components/icons";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * 资料库浏览（2026-10-26 重排）。
 *
 * 顺序仍是「先看结果，再动工具」：搜索 → 结果计数 → 结果列表；
 * 筛选在手机上收进一个展开按钮（默认收起），桌面上常驻。
 *
 * 视觉上是信号台的一套：方角一点的输入框、发丝线、面板里分行的筛选，
 * 不再用一堆描边芯片堆成一面墙。
 */
export function LibraryBrowser({ lessons }: { lessons: Lesson[] }) {
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [difficulty, setDifficulty] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = useMemo(
    () => filterLessons(lessons, { query, topics, stages, difficulty }),
    [lessons, query, topics, stages, difficulty],
  );

  const activeCount = topics.length + stages.length + difficulty.length;
  const hasFilter = query.trim() !== "" || activeCount > 0;

  function reset() {
    setQuery("");
    setTopics([]);
    setStages([]);
    setDifficulty([]);
  }

  return (
    <section className="mt-8" aria-labelledby="library-search-label">
      <div className="relative">
        <label id="library-search-label" htmlFor="library-search" className="sr-only">
          搜索资料
        </label>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500">
          <Icon name="search" className="size-4" />
        </span>
        <input
          id="library-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、简介、主题、标签"
          autoComplete="off"
          className="h-12 w-full rounded-control border border-rule bg-surface pl-11 pr-12 text-body text-ink-950 transition-colors duration-150 placeholder:text-ink-500 focus-visible:border-accent-700 [&::-webkit-search-cancel-button]:hidden"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="清除搜索内容"
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-ink-500 transition-colors duration-150 hover:text-ink-950"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
              <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.16" />
              <path
                d="M5.5 5.5l5 5m0-5l-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="library-filters"
          className="chip md:hidden"
        >
          <Icon name="filter" className="size-4" />
          筛选
          {activeCount > 0 && <span className="tabular-nums opacity-70">{activeCount}</span>}
        </button>
        <p className="ml-auto text-meta text-ink-500 tabular-nums" role="status">
          {hasFilter ? `筛选出 ${visible.length} / ${lessons.length} 篇` : `共 ${lessons.length} 篇`}
        </p>
      </div>

      <div
        id="library-filters"
        className={`${filtersOpen ? "block" : "hidden"} mt-4 md:block`}
      >
        <div className="divide-y divide-rule rounded-card border border-rule bg-surface">
          <FilterRow label="主题">
            {TOPICS.map((topic) => (
              <FilterChip
                key={topic}
                active={topics.includes(topic)}
                onClick={() => setTopics(toggle(topics, topic))}
              >
                {topic}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="阶段">
            {STAGES.map((stage) => (
              <FilterChip
                key={stage}
                active={stages.includes(stage)}
                onClick={() => setStages(toggle(stages, stage))}
              >
                {stage}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="难度">
            {DIFFICULTIES.map((level) => (
              <FilterChip
                key={level}
                active={difficulty.includes(level)}
                onClick={() => setDifficulty(toggle(difficulty, level))}
              >
                {level} 级
              </FilterChip>
            ))}
          </FilterRow>
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="mt-2 min-h-11 px-1 text-label text-ink-700 underline underline-offset-4 transition-colors duration-150 hover:text-ink-950"
          >
            清除全部筛选
          </button>
        )}
      </div>

      <div className="mt-6">
        {lessons.length === 0 ? (
          <EmptyLibrary />
        ) : visible.length === 0 ? (
          <div className="rounded-card border border-rule bg-surface p-6">
            <p className="text-body text-ink-700">没有符合当前条件的资料。</p>
            <button
              type="button"
              onClick={reset}
              className="mt-1 min-h-11 text-label text-accent-700 underline underline-offset-4"
            >
              清除筛选，查看全部资料
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-rule border-t border-rule">
            {visible.map((lesson) => (
              <li key={lesson.slug}>
                <LessonCard lesson={lesson} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="chip">
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-4 px-4 py-3">
      <span
        aria-hidden="true"
        className="flex min-h-11 w-9 shrink-0 items-center text-meta text-ink-500"
      >
        {label}
      </span>
      <div role="group" aria-label={label} className="flex min-w-0 flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}
