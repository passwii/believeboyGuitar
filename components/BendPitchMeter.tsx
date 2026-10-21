"use client";

import { useMemo, useState } from "react";
import { buildBendTargets, type Spelling } from "@/lib/guitar";

/**
 * 推弦目标音对照表。
 *
 * 推弦最难的不是「推多大力」，而是「推到哪个音」。
 * 这张表把每根弦每个品位能推到的音列出来，并且标出目标是不是调内音——
 * 推到位听音准，靠的就是这层对应关系。
 *
 * 音位与音高由 `lib/guitar.ts` 从标准调弦推出，不手抄常量。
 */

const STRING_HEADERS = [6, 5, 4, 3, 2, 1];

/** 推弦量档位与说明 */
const BEND_LABELS: Record<number, string> = {
  0.5: "半音",
  1: "1 音",
  1.5: "1.5 音",
  2: "2 音",
};

export function BendPitchMeter() {
  const [spelling, setSpelling] = useState<Spelling>("sharp");
  const [stringNumber, setStringNumber] = useState(6);

  const targets = useMemo(() => buildBendTargets(15, spelling), [spelling]);

  const rows = useMemo(
    () => targets.filter((target) => target.stringNumber === stringNumber),
    [targets, stringNumber],
  );

  return (
    <section
      aria-labelledby="bend-heading"
      className="rounded-card border border-rule bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="bend-heading" className="text-title text-ink-950">
          推弦目标音
        </h2>
        <div role="group" aria-label="音名拼写方式" className="segment-track">
          {(
            [
              ["sharp", "升号"],
              ["flat", "降号"],
            ] as const
          ).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={spelling === mode}
              onClick={() => setSpelling(mode)}
              className="segment"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label="选择弦"
        className="mt-4 flex flex-wrap gap-1.5"
      >
        {STRING_HEADERS.map((number) => (
          <button
            key={number}
            type="button"
            aria-pressed={stringNumber === number}
            onClick={() => setStringNumber(number)}
            className={`inline-flex size-11 items-center justify-center rounded-pill font-mono text-label transition-colors duration-150 ${
              stringNumber === number
                ? "bg-accent-700 text-white"
                : "bg-surface-muted text-ink-700 hover:text-ink-950"
            }`}
          >
            {number}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-rule">
        {/*
          表格自己横向滚动，而不是交给外层容器。
          `display: table` 的表格宽度由内容决定，放进 overflow-x-auto 的
          容器里仍会撑破页面；改成 block 后表格自己成为滚动区，
          这与 content.css 里 .lesson table 的做法一致。
        */}
        <table className="block w-full max-w-full overflow-x-auto overscroll-x-contain border-collapse text-label">
          <caption className="sr-only">
            {stringNumber} 弦各品位能推到的目标音，标出调内音
          </caption>
          <thead>
            <tr className="border-b border-rule text-micro uppercase text-ink-500">
              <th scope="col" className="w-[100px] px-2 py-2 text-left font-medium">
                品位
              </th>
              <th scope="col" className="px-2 py-2 text-left font-medium">
                起始音
              </th>
              {Object.entries(BEND_LABELS).map(([units, label]) => (
                <th key={units} scope="col" className="px-2 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.fret} className="border-b border-rule last:border-0">
                <th scope="row" className="px-2 py-1.5 text-left font-mono font-normal text-ink-700">
                  {row.fret === 0 ? "空弦" : row.fret}
                </th>
                <td className="px-2 py-1.5 font-mono text-ink-950">{row.fromName}</td>
                {row.targets.map((target) => (
                  <td key={target.units} className="px-2 py-1.5 text-center">
                    <span
                      className={`font-mono ${
                        target.inKey ? "text-ink-950" : "text-ink-500"
                      }`}
                    >
                      {target.name}
                    </span>
                    <span className="sr-only">
                      ，推 {target.units} 音到 {target.name}，
                      {target.inKey ? "C 大调调内音" : "C 大调调外音"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4 text-meta text-ink-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-pill bg-ink-950" aria-hidden="true" />
          C 大调调内音
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-pill bg-ink-500" aria-hidden="true" />
          调外音（ blues 色彩等）
        </span>
      </div>

      <p className="mt-3 text-meta leading-relaxed text-ink-500">
        目标音名后面的括号是同一根弦上对应的品位：推 1 音等于往高走 1 品。
        推到位时，弦的音高应该正好等于那个品位发出的音。
      </p>
    </section>
  );
}
