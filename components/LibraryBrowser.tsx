"use client";

import { useMemo, useState, type ReactNode } from "react";
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

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-control-edge px-3 py-2 text-sm ${
        active
          ? "bg-accent-soft text-ink ring-1 ring-inset ring-control-edge"
          : "bg-surface text-ink-muted hover:bg-surface-muted"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className={`size-3 shrink-0 ${active ? "visible" : "invisible"}`}
      >
        <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" />
      </svg>
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="flex min-h-11 items-center text-sm text-ink-muted">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function LibraryBrowser({ lessons }: { lessons: Lesson[] }) {
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [difficulty, setDifficulty] = useState<number[]>([]);

  const visible = useMemo(
    () => filterLessons(lessons, { query, topics, stages, difficulty }),
    [lessons, query, topics, stages, difficulty],
  );

  const hasFilter =
    query.trim() !== "" || topics.length > 0 || stages.length > 0 || difficulty.length > 0;

  function reset() {
    setQuery("");
    setTopics([]);
    setStages([]);
    setDifficulty([]);
  }

  return (
    <section className="mt-8">
      <label htmlFor="library-search" className="mb-2 block text-sm font-medium">
        搜索资料
      </label>
      <input
        id="library-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索标题、简介、主题、标签"
        className="min-h-11 w-full rounded-md border border-control-edge bg-surface px-3 py-2 text-base placeholder:text-ink-muted"
      />

      <div className="mt-5 space-y-3">
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
              {level}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      <div className="mt-6 flex min-h-11 flex-wrap items-center gap-x-4 border-t border-rule pt-4 text-sm text-ink-muted">
        <p role="status">
          {hasFilter ? `筛选出 ${visible.length} / ${lessons.length} 篇` : `共 ${lessons.length} 篇`}
        </p>
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 text-accent underline underline-offset-4"
          >
            清除筛选
          </button>
        )}
      </div>

      {lessons.length === 0 ? (
        <EmptyLibrary />
      ) : visible.length === 0 ? (
        <div className="mt-4 text-base leading-[1.8] text-ink-muted">
          <p>没有符合当前筛选条件的资料。</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 min-h-11 text-accent underline underline-offset-4"
          >
            清除筛选，查看全部资料
          </button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-rule">
          {visible.map((lesson) => (
            <li key={lesson.slug}>
              <LessonCard lesson={lesson} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
