"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_DURATION,
  PRACTICE_DURATIONS,
  TECHNIQUE_GOALS,
  buildPracticePlan,
  planStatus,
  planSummary,
  type TechniqueId,
} from "@/lib/practice-plan";

/**
 * 练习计划生成器。
 *
 * 顺序照「先说结果，再动工具」：顶部先给一行计划摘要，
 * 下面是设定工具（时长 / 技术 / 曲目），最后是展开的逐段安排。
 * 纯逻辑都在 `lib/practice-plan.ts`，这里只管交互与排版。
 */
export function PracticePlanner() {
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [techniques, setTechniques] = useState<TechniqueId[]>([]);
  const [songTitle, setSongTitle] = useState("");

  const plan = useMemo(
    () => buildPracticePlan({ totalMinutes: duration, techniques, songTitle }),
    [duration, techniques, songTitle],
  );
  const summary = useMemo(() => planSummary(plan), [plan]);
  const status = useMemo(() => planStatus(plan), [plan]);

  function toggleTechnique(id: TechniqueId) {
    setTechniques((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="mt-10">
      {/* 先说结果：一行说清这份计划是什么 */}
      <p className="border-y border-rule py-3 text-body text-ink-700 text-pretty">
        {summary}
      </p>
      {/* 结构性变化的播报区：不含曲名，避免与输入框回显重叠 */}
      <p role="status" className="sr-only">
        {status}
      </p>

      <section className="mt-10" aria-labelledby="planner-settings-heading">
        <h2
          id="planner-settings-heading"
          className="text-label font-medium text-ink-700"
        >
          计划设定
        </h2>

        <div className="mt-5 space-y-8">
          <div>
            <p id="planner-duration-label" className="text-label text-ink-700">
              总时长
            </p>
            <div
              role="group"
              aria-labelledby="planner-duration-label"
              className="segment-track mt-2.5"
            >
              {PRACTICE_DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={duration === minutes}
                  onClick={() => setDuration(minutes)}
                  className="segment"
                >
                  {minutes} 分钟
                </button>
              ))}
            </div>
          </div>

          <fieldset>
            <legend className="text-label text-ink-700">今天要练的技术</legend>
            <div className="mt-2 grid gap-0.5 sm:grid-cols-2 sm:gap-x-6">
              {TECHNIQUE_GOALS.map((goal) => (
                <label
                  key={goal.id}
                  htmlFor={`practice-technique-${goal.id}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 transition-colors duration-150 hover:bg-surface-muted"
                >
                  <input
                    id={`practice-technique-${goal.id}`}
                    type="checkbox"
                    checked={techniques.includes(goal.id)}
                    onChange={() => toggleTechnique(goal.id)}
                    className="size-5 shrink-0 accent-accent-700"
                  />
                  <span className="text-body text-ink-950">{goal.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-meta text-ink-500 text-pretty">
              一周只改一项，改得深比到处改快。没勾选时，技术段会提醒你挑一项作为本周焦点。
            </p>
          </fieldset>

          <div>
            <label htmlFor="practice-song-title" className="text-label text-ink-700">
              曲目（可留空）
            </label>
            <input
              id="practice-song-title"
              type="text"
              value={songTitle}
              onChange={(event) => setSongTitle(event.target.value)}
              placeholder="曲名"
              autoComplete="off"
              className="mt-2.5 h-11 w-full max-w-sm rounded-control bg-surface-muted px-3 text-body text-ink-950 placeholder:text-ink-500"
            />
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="planner-plan-heading">
        <h2
          id="planner-plan-heading"
          className="text-label font-medium text-ink-700"
        >
          今天的安排
        </h2>

        <ol className="mt-4 list-none divide-y divide-rule border-y border-rule">
          {plan.segments.map((segment) => (
            <li key={segment.id} className="py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-title text-ink-950">{segment.name}</h3>
                <p className="text-meta text-ink-500 tabular-nums">
                  {segment.minutes} 分钟 · 占 {Math.round(segment.share * 100)}%
                </p>
              </div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-body text-ink-700 marker:text-ink-500">
                {segment.steps.map((step) => (
                  <li key={step} className="text-pretty">
                    {step}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
