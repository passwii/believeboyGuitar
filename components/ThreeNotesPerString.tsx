"use client";

import { useMemo, useState } from "react";
import { Fretboard, type FretboardNote } from "@/components/Fretboard";
import {
  FRET_COUNT,
  PATTERNS,
  buildNeckNotes,
  patternKeys,
  type Pattern,
} from "@/lib/guitar";

const DEGREE_MARKS = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];
const STRING_HEADERS = [6, 5, 4, 3, 2, 1];

/** 整条指板上所有属于 C 大调的音，模块级算一次即可 */
const NECK_NOTES = buildNeckNotes(FRET_COUNT);

/**
 * 音名选择器用的音级列表：C 大调七个音级，顺序同音阶。
 * 键盘用户靠这七个按钮拿到「同名音都在哪」这个信息，而不是在几十个
 * 音位上逐个 Tab（见 DESIGN.md §7 的键盘策略）。
 */
const PITCH_CHOICES = Array.from(
  new Map(
    NECK_NOTES.map((note) => [note.pitchClass, { pitchClass: note.pitchClass, name: note.name }]),
  ).values(),
).sort((a, b) => a.pitchClass - b.pitchClass);

type LabelMode = "name" | "degree";

export function ThreeNotesPerString() {
  const [activeDegree, setActiveDegree] = useState<number | null>(null);
  const [labelMode, setLabelMode] = useState<LabelMode>("name");
  const [hoveredPitchClass, setHoveredPitchClass] = useState<number | null>(null);
  const [pinnedPitchClass, setPinnedPitchClass] = useState<number | null>(null);

  const activePattern = useMemo(
    () => PATTERNS.find((pattern) => pattern.degree === activeDegree) ?? null,
    [activeDegree],
  );

  const activeKeys = useMemo(
    () => (activePattern ? patternKeys(activePattern) : null),
    [activePattern],
  );

  // 悬停优先，松开后回落到点按固定下来的音（触屏没有 hover）。
  // 这里刻意不叠加「焦点高亮」：按钮点过之后焦点会留在上面，若焦点也参与
  // 联动，按 Enter 取消后那个音会被焦点重新点亮，看起来像按钮失灵。
  // 键盘用户靠 :focus-visible 的焦点环确认位置，靠 aria-pressed 确认状态。
  const highlightedPitchClass = hoveredPitchClass ?? pinnedPitchClass;

  const notes: FretboardNote[] = useMemo(
    () =>
      NECK_NOTES.map((note) => {
        const dimmed = activeKeys !== null && !activeKeys.has(note.key);
        return {
          key: note.key,
          stringIndex: note.stringIndex,
          stringNumber: note.stringNumber,
          fret: note.fret,
          pitchClass: note.pitchClass,
          label: labelMode === "name" ? note.name : String(note.degree),
          isRoot: note.isRoot,
          dimmed,
          emphasized:
            !dimmed &&
            highlightedPitchClass !== null &&
            note.pitchClass === highlightedPitchClass,
          title: `${note.stringNumber} 弦 ${note.fret} 品 · ${note.name}（${note.degree} 级）`,
        };
      }),
    [activeKeys, highlightedPitchClass, labelMode],
  );

  const togglePattern = (degree: number) =>
    setActiveDegree((current) => (current === degree ? null : degree));

  const modeText = labelMode === "name" ? "音名" : "级数";
  const ariaLabel = activePattern
    ? `C 大调 ${activePattern.modeZh} 把位指板图，第 ${activePattern.minFret} 到 ${activePattern.maxFret} 品，标注方式：${modeText}`
    : `C 大调一弦三音指板图，第 1 到第 ${FRET_COUNT} 品，标注方式：${modeText}`;

  return (
    <>
      <section
        aria-labelledby="fretboard-heading"
        className="rounded-card border border-rule bg-surface p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2
            id="fretboard-heading"
            className="text-title text-ink-950"
            // 正文里已有同名 H2，这里只作为控件标题，不参与目录
          >
            七个把位指板图
          </h2>

          <div role="group" aria-label="音位标注方式" className="segment-track">
            {(
              [
                ["name", "音名"],
                ["degree", "级数"],
              ] as const
            ).map(([mode, text]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={labelMode === mode}
                onClick={() => setLabelMode(mode)}
                className="segment"
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label="按把位筛选" className="mt-4 flex flex-wrap gap-1.5">
          <PatternChip active={activeDegree === null} onClick={() => setActiveDegree(null)}>
            <span className={activeDegree === null ? "text-on-accent" : "text-ink-700"}>全部</span>
          </PatternChip>
          {PATTERNS.map((pattern) => (
            <PatternChip
              key={pattern.degree}
              active={activeDegree === pattern.degree}
              title={`${pattern.mode} · ${pattern.character}`}
              onClick={() => togglePattern(pattern.degree)}
            >
              <span className={activeDegree === pattern.degree ? "text-on-accent" : "text-ink-700"}>
                {DEGREE_MARKS[pattern.degree - 1]}
              </span>
              <span className="font-semibold">{pattern.notes[0][0].name}</span>
              <span className={activeDegree === pattern.degree ? "text-on-accent" : "text-ink-700"}>
                {pattern.modeZh}
              </span>
            </PatternChip>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            id="pitch-picker-label"
            className="text-micro uppercase text-ink-500"
          >
            点亮同名音
          </span>
          <div
            role="group"
            aria-labelledby="pitch-picker-label"
            className="flex flex-wrap gap-1.5"
          >
            {PITCH_CHOICES.map(({ pitchClass: pc, name }) => {
              const active = pinnedPitchClass === pc;
              return (
                <button
                  key={pc}
                  type="button"
                  aria-pressed={active}
                  aria-label={`点亮所有 ${name} 音`}
                  onClick={() =>
                    setPinnedPitchClass((current) => (current === pc ? null : pc))
                  }
                  className={`inline-flex size-11 items-center justify-center rounded-pill font-mono text-label transition-colors duration-150 ${
                    active
                      ? "bg-accent-700 text-on-accent"
                      : "bg-surface-muted text-ink-700 hover:text-ink-950"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mt-5">
          <div className="overflow-x-auto overscroll-x-contain">
            <Fretboard
              fretCount={FRET_COUNT}
              notes={notes}
              ariaLabel={ariaLabel}
              onHoverPitchClass={setHoveredPitchClass}
              onTogglePitchClass={(pitchClass) =>
                setPinnedPitchClass((current) => (current === pitchClass ? null : pitchClass))
              }
            />
          </div>
          {/* 可横向滑动的边缘提示：手机上替代一行小字说明 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface to-transparent sm:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-surface to-transparent sm:hidden"
          />
        </div>

        <p className="mt-2 text-meta text-ink-500 sm:hidden">
          左右滑动查看第 1–{FRET_COUNT} 品，点按音位可固定高亮同名音
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4 text-meta text-ink-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-pill bg-accent-600" aria-hidden="true" />
            根音（1 级 C）
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-pill bg-ink-100" aria-hidden="true" />
            其他音级
          </span>
          <span>标准调弦 EADGBE · 低音弦画在图下方</span>
        </div>

        <PatternDetail pattern={activePattern} />
      </section>

      <PatternTable activeDegree={activeDegree} onSelect={togglePattern} />
    </>
  );
}

function PatternChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-meta transition-colors duration-150 ${
        active
          ? "border-transparent bg-accent-700 text-on-accent"
          : "border-rule bg-surface text-ink-700 hover:border-control-edge hover:text-ink-950"
      }`}
    >
      {children}
    </button>
  );
}

function PatternDetail({ pattern }: { pattern: Pattern | null }) {
  if (!pattern) {
    return (
      <p className="mt-4 border-t border-rule pt-4 text-meta leading-relaxed text-ink-500">
        图上显示的是整条指板里的 C 大调音位。点选上方任一把位，只会留下那一个把位的
        六个音组，形状和位置会看得更清楚。
      </p>
    );
  }

  const start = pattern.notes[0][0];
  const items = [
    ["调式", `${start.name} ${pattern.modeZh}（${pattern.mode}）`],
    ["起音", `6 弦 ${start.fret} 品`],
    ["品域", `${pattern.minFret}–${pattern.maxFret} 品`],
    ["音域", `${pattern.lowNote} → ${pattern.highNote}`],
    ["色彩", pattern.character],
  ] as const;

  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-micro uppercase text-ink-500">{label}</dt>
          <dd className="mt-1 text-label text-ink-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PatternTable({
  activeDegree,
  onSelect,
}: {
  activeDegree: number | null;
  onSelect: (degree: number) => void;
}) {
  return (
    <section aria-labelledby="pattern-table-heading" className="mt-8">
      <h2 id="pattern-table-heading" className="text-title text-ink-950">
        七把位速查
      </h2>
      <p className="mt-1 text-meta leading-relaxed text-ink-500">
        每格是该弦上的三个音：数字是品位，字母是音名。
      </p>

      <div className="mt-3 overflow-hidden rounded-card border border-rule bg-surface">
        {/* 表格自己横向滚动（display: block），不靠外层容器：
            display: table 的表格宽度由内容决定，放进 overflow-x-auto 里仍会撑破页面。 */}
        <table className="block w-full max-w-full overflow-x-auto overscroll-x-contain border-collapse text-label">
          <thead>
            <tr className="border-b border-rule text-micro uppercase text-ink-500">
              <th scope="col" className="w-[120px] px-3 py-2.5 text-left font-medium">
                把位
              </th>
              {STRING_HEADERS.map((stringNumber) => (
                <th
                  key={stringNumber}
                  scope="col"
                  className="px-2 py-2.5 text-center font-medium"
                >
                  {stringNumber} 弦
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PATTERNS.map((pattern) => {
              const active = activeDegree === pattern.degree;
              const start = pattern.notes[0][0];
              return (
                <tr
                  key={pattern.degree}
                  className={`border-b border-rule last:border-0 ${active ? "bg-accent-50" : ""}`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(pattern.degree)}
                      className="row-button whitespace-nowrap hover:bg-accent-50"
                    >
                      <span className="text-micro text-ink-500">
                        {DEGREE_MARKS[pattern.degree - 1]}
                      </span>
                      <span className="font-semibold text-ink-950">{start.name}</span>
                      <span className="text-micro text-ink-500">{pattern.modeZh}</span>
                    </button>
                  </th>

                  {pattern.notes.map((group) => (
                    <td key={group[0].stringIndex} className="px-2 py-1.5 text-center">
                      <div className="flex items-start justify-center gap-2.5">
                        {group.map((note) => (
                          <span
                            key={note.fret}
                            className="flex w-4 flex-col items-center leading-tight"
                          >
                            <span
                              className={`font-mono text-micro ${
                                note.degree === 1
                                  ? "font-semibold text-accent-700"
                                  : "text-ink-700"
                              }`}
                            >
                              {note.fret}
                            </span>
                            <span
                              className={`text-micro ${
                                note.degree === 1
                                  ? "font-medium text-accent-700"
                                  : "text-ink-500"
                              }`}
                            >
                              {note.name}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
