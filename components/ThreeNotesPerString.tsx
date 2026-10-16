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

type LabelMode = "name" | "degree";

export function ThreeNotesPerString() {
  const [activeDegree, setActiveDegree] = useState<number | null>(null);
  const [labelMode, setLabelMode] = useState<LabelMode>("name");
  const [hoveredPitchClass, setHoveredPitchClass] = useState<number | null>(null);

  const activePattern = useMemo(
    () => PATTERNS.find((pattern) => pattern.degree === activeDegree) ?? null,
    [activeDegree],
  );

  const activeKeys = useMemo(
    () => (activePattern ? patternKeys(activePattern) : null),
    [activePattern],
  );

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
            hoveredPitchClass !== null &&
            note.pitchClass === hoveredPitchClass,
          title: `${note.stringNumber} 弦 ${note.fret} 品 · ${note.name}（${note.degree} 级）`,
        };
      }),
    [activeKeys, hoveredPitchClass, labelMode],
  );

  const togglePattern = (degree: number) =>
    setActiveDegree((current) => (current === degree ? null : degree));

  return (
    <>
      <section className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
          <h2 className="text-base font-semibold tracking-tight text-ink-950">
            七个把位指板图
          </h2>

          <div
            role="group"
            aria-label="音位标注方式"
            className="flex rounded-lg border border-ink-200 p-0.5 text-xs"
          >
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
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  labelMode === mode
                    ? "bg-ink-950 text-white"
                    : "text-ink-500 hover:text-ink-950"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <PatternChip
            active={activeDegree === null}
            onClick={() => setActiveDegree(null)}
          >
            全部
          </PatternChip>
          {PATTERNS.map((pattern) => (
            <PatternChip
              key={pattern.degree}
              active={activeDegree === pattern.degree}
              title={`${pattern.mode} · ${pattern.character}`}
              onClick={() => togglePattern(pattern.degree)}
            >
              <span className={activeDegree === pattern.degree ? "text-ink-300" : "text-ink-500"}>
                {DEGREE_MARKS[pattern.degree - 1]}
              </span>
              <span className="font-semibold">{pattern.notes[0][0].name}</span>
              <span className={activeDegree === pattern.degree ? "text-white" : "text-ink-500"}>
                {pattern.modeZh}
              </span>
            </PatternChip>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <Fretboard
            fretCount={FRET_COUNT}
            notes={notes}
            onHoverPitchClass={setHoveredPitchClass}
          />
        </div>

        <p className="mt-1.5 text-[11px] text-ink-500 sm:hidden">
          ← 左右滑动查看第 1–{FRET_COUNT} 品 →
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-accent-600" aria-hidden />
            根音（1 级 C）
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-full bg-ink-100 ring-1 ring-ink-200"
              aria-hidden
            />
            其他音级
          </span>
          <span>标准调弦 EADGBE · 低音弦画在图下方</span>
          <span>把鼠标停在任一音上，会同时点亮同名音</span>
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-ink-950 bg-ink-950 text-white"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50"
      }`}
    >
      {children}
    </button>
  );
}

function PatternDetail({ pattern }: { pattern: Pattern | null }) {
  if (!pattern) {
    return (
      <p className="mt-4 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-500">
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
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-100 pt-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] text-ink-500">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink-950">{value}</dd>
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
    <section className="mt-6">
      <h2 className="text-base font-semibold tracking-tight text-ink-950">
        七把位速查
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        每格是该弦上的三个音：数字是品位，字母是音名。
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-[11px] text-ink-500">
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
                  className={`border-b border-ink-100 last:border-0 ${
                    active ? "bg-accent-50" : ""
                  }`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(pattern.degree)}
                      className="inline-flex items-baseline gap-1.5 rounded-md px-1.5 py-1 whitespace-nowrap transition-colors hover:bg-ink-100"
                    >
                      <span className="text-xs text-ink-500">
                        {DEGREE_MARKS[pattern.degree - 1]}
                      </span>
                      <span className="font-semibold text-ink-950">
                        {start.name}
                      </span>
                      <span className="text-xs text-ink-500">
                        {pattern.modeZh}
                      </span>
                    </button>
                  </th>

                  {pattern.notes.map((group) => (
                    <td
                      key={group[0].stringIndex}
                      className="px-2 py-1.5 text-center"
                    >
                      <div className="flex items-start justify-center gap-2.5">
                        {group.map((note) => (
                          <span
                            key={note.fret}
                            className="flex w-4 flex-col items-center leading-tight"
                          >
                            <span
                              className={`font-mono text-xs ${
                                note.degree === 1
                                  ? "font-semibold text-accent-700"
                                  : "text-ink-700"
                              }`}
                            >
                              {note.fret}
                            </span>
                            <span
                              className={`text-[11px] ${
                                note.degree === 1
                                  ? "font-medium text-accent-600"
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
