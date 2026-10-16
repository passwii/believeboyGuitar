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
      className={
        active
          ? "rounded-full border border-accent-600 bg-accent-600 px-3 py-1 text-xs text-white"
          : "rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700 hover:border-accent-600"
      }
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-9 shrink-0 text-xs text-ink-500">{label}</span>
      {children}
    </div>
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
    <section className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索标题、简介、主题、标签"
        aria-label="搜索资料"
        className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-600"
      />

      <div className="mt-4 space-y-3">
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

      <p className="mt-6 text-xs text-ink-500">
        {hasFilter ? `筛选出 ${visible.length} / ${lessons.length} 篇` : `共 ${lessons.length} 篇`}
        {hasFilter && (
          <button type="button" onClick={reset} className="ml-2 underline hover:text-accent-700">
            清除筛选
          </button>
        )}
      </p>

      {lessons.length === 0 ? (
        <EmptyLibrary />
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ink-200 bg-white p-6 text-sm text-ink-500">
          没有符合当前筛选条件的资料。
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
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
