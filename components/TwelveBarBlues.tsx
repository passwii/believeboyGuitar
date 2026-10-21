"use client";

import { useMemo, useState } from "react";
import { Fretboard, type FretboardNote } from "@/components/Fretboard";
import { buildScaleNeckNotes } from "@/lib/guitar";

/**
 * 12 小节布鲁斯。
 *
 * 结构、和弦与布鲁斯音阶都由代码给出：
 * · 12 小节的和弦是 C 布鲁斯最常见的那套（I7 / IV7 / V7）；
 * · 布鲁斯音阶的音位从标准调弦推出（见 `lib/guitar.ts`）。
 *
 * 选不同的小节时，指板高亮该小节和弦的音，其余布鲁斯音阶音位保留但变暗。
 */

const FRET_COUNT = 15;

/** 12 小节的标准布鲁斯和声：I7 - IV7 - V7 */
const CHORDS: {
  name: string;
  label: string;
  /** 和弦音相对 C 的音高类 */
  pitchClasses: number[];
  /** 每个和弦音的角色，和弦音级与布鲁斯音阶音级不是一回事 */
  roles: string[];
}[] = [
  { name: "I7", label: "C7", pitchClasses: [0, 4, 7, 10], roles: ["根音", "大三度", "纯五度", "小七度"] },
  { name: "IV7", label: "F7", pitchClasses: [5, 9, 0, 3], roles: ["根音", "大三度", "纯五度", "小七度"] },
  { name: "V7", label: "G7", pitchClasses: [7, 11, 2, 5], roles: ["根音", "大三度", "纯五度", "小七度"] },
];

/** 12 小节里每一小节的和弦下标 */
const BAR_CHORDS = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];

export function TwelveBarBlues() {
  const [activeBar, setActiveBar] = useState(0);

  const scaleNotes = useMemo(() => buildScaleNeckNotes(FRET_COUNT, "blues"), []);

  const activeChord = CHORDS[BAR_CHORDS[activeBar]];

  const notes: FretboardNote[] = useMemo(() => {
    const chordPitchClasses = new Set(activeChord.pitchClasses);

    return scaleNotes.map((note) => {
      const isChordTone = chordPitchClasses.has(note.pitchClass);
      return {
        key: note.key,
        stringIndex: note.stringIndex,
        stringNumber: note.stringNumber,
        fret: note.fret,
        pitchClass: note.pitchClass,
        label: note.name,
        isRoot: note.pitchClass === activeChord.pitchClasses[0],
        dimmed: !isChordTone,
        emphasized: isChordTone,
        title: `${note.stringNumber} 弦 ${note.fret} 品 · ${note.name}${
          isChordTone ? " · 和弦音" : ""
        }`,
      };
    });
  }, [scaleNotes, activeChord]);

  const ariaLabel = `布鲁斯音阶在第 ${activeBar + 1} 小节 ${activeChord.label} 和弦下的指板图，高亮该和弦的音`;

  return (
    <section
      aria-labelledby="blues-heading"
      className="rounded-card border border-rule bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="blues-heading" className="text-title text-ink-950">
          12 小节布鲁斯
        </h2>
        <p className="text-meta text-ink-500">
          第 {activeBar + 1} 小节 · {activeChord.label}
        </p>
      </div>

      <div
        role="group"
        aria-label="选择小节"
        className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-12"
      >
        {BAR_CHORDS.map((chordIndex, bar) => {
          const active = bar === activeBar;
          return (
            <button
              key={bar}
              type="button"
              aria-pressed={active}
              aria-label={`第 ${bar + 1} 小节，${CHORDS[chordIndex].label}`}
              onClick={() => setActiveBar(bar)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-control border text-micro transition-colors duration-150 ${
                active
                  ? "border-transparent bg-accent-700 text-white"
                  : "border-rule bg-surface text-ink-700 hover:border-control-edge hover:text-ink-950"
              }`}
            >
              <span className="font-semibold">{bar + 1}</span>
              <span className={active ? "text-white/80" : "text-ink-500"}>
                {CHORDS[chordIndex].name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-5">
        <div className="overflow-x-auto overscroll-x-contain">
          <Fretboard fretCount={FRET_COUNT} notes={notes} ariaLabel={ariaLabel} />
        </div>
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
        左右滑动查看第 1–{FRET_COUNT} 品
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-4 sm:grid-cols-4">
        <div>
          <dt className="text-micro uppercase text-ink-500">当前和弦</dt>
          <dd className="mt-1 text-label text-ink-950">{activeChord.label}</dd>
        </div>
        <div>
          <dt className="text-micro uppercase text-ink-500">和弦音</dt>
          <dd className="mt-1 text-label text-ink-950">
            {activeChord.roles.join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="text-micro uppercase text-ink-500">布鲁斯音阶</dt>
          <dd className="mt-1 text-label text-ink-950">C Eb F Gb G Bb</dd>
        </div>
        <div>
          <dt className="text-micro uppercase text-ink-500">过门</dt>
          <dd className="mt-1 text-label text-ink-950">♭5（Gb）是经过音</dd>
        </div>
      </dl>
    </section>
  );
}
