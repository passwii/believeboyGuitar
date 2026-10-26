"use client";

import { useState } from "react";
import {
  GRID_LENGTH,
  RHYTHM_METERS,
  RHYTHM_PATTERNS,
  accentCells,
  barCells,
  bpmAdvice,
  canvasCell,
  countLabels,
  density,
  describeGrid,
  ghostCount,
  patternById,
  restCount,
  rhythmGroups,
  savedStrikes,
  sixteenthDurationMs,
  strikeCount,
  strikesInRange,
  type CanvasCell,
} from "@/lib/rhythms";
import type { Meter } from "@/lib/metronome";

/**
 * 节奏型练习工具。
 *
 * 顺序按「先看工具，再讲道理」：
 * 1. 选节奏型、选拍号；
 * 2. 16 格网格：击弦格填实心、留白格留空，重音位置有标记；
 * 3. 击弦密度、起步速度、怎么练；
 * 4. 结论：十六分音符为什么不该全部实弹（解释网格上那些留白格）；
 * 5. 分组练习：按重音把一小节切成能慢练的组。
 *
 * 网格用 CSS grid 画，不用 SVG：16 个格子用 grid 更自然，也不必维护
 * viewBox 换算。窄屏放不下 16 个 ≥24px 的格子时，网格自己横向滚动
 * （内层固定 min-width），不让页面产生横向溢出。
 */

/**
 * 网格的列数 → Tailwind 类名。写成字面量，Tailwind 才扫得到。
 * 画布永远是 16 格：6/8、7/8 的尾巴属于下一小节，标成「不属于这一小节」。
 */
const GRID_COLUMNS = "grid-cols-16";

/**
 * 网格的最小宽度：保证每格视觉尺寸 ≥ 24px。
 * 计算式：16 格 × 1.5rem + 15 × 0.25rem（间隙）+ 0.5rem（内边距）。
 */
const GRID_MIN_WIDTH = "min-w-[28.25rem]";

export function RhythmPatterns() {
  const [patternId, setPatternId] = useState("sixteenth-ghost");
  const [meterLabel, setMeterLabel] = useState("4/4");

  const pattern = patternById(patternId);
  const meter = RHYTHM_METERS.find((item) => item.label === meterLabel) ?? RHYTHM_METERS[0];

  // 下面这些计算都很便宜（几十格以内），不手动 memo：React Compiler 会自己处理。
  const cells = barCells(meter);
  const labels = countLabels(meter);
  const accents = new Set(accentCells(pattern, meter));
  const groups = rhythmGroups(meter, pattern);
  const gridLabel = describeGrid(pattern, meter);
  const strikes = strikeCount(pattern, cells);
  const ghosts = ghostCount(pattern, cells);
  const rests = restCount(pattern, cells);
  const ratio = Math.round(density(pattern, cells) * 100);
  const saved = savedStrikes(pattern, cells);
  const [bpmLow, bpmHigh] = pattern.bpm;

  return (
    <div className="flex flex-col gap-10">
      <PatternPicker patternId={patternId} onPick={setPatternId} />
      <MeterPicker meter={meter} onPick={setMeterLabel} />

      <section aria-labelledby="rhythm-grid-heading" className="min-w-0">
        <h2 id="rhythm-grid-heading" className="text-title text-ink-950">
          {pattern.name}
        </h2>
        <p className="mt-2 measure text-body text-ink-700 text-pretty">{pattern.summary}</p>

        <div className="mt-5 rounded-card border border-rule bg-surface p-4 sm:p-6">
          <div className="overflow-x-auto overscroll-x-contain">
            <div
              role="img"
              aria-label={gridLabel}
              className={`grid max-w-2xl gap-x-1 gap-y-2 ${GRID_COLUMNS} ${GRID_MIN_WIDTH}`}
            >
              {Array.from({ length: GRID_LENGTH }, (_, index) => {
                const kind = canvasCell(pattern, index, meter);
                const label = labels[index] ?? "";
                const outside = kind === "outside";
                return (
                  <div key={index} className="flex flex-col items-center gap-1.5">
                    {/* 重音标记：与节拍器页「当前拍」同一个颜色，两页读起来是一件事 */}
                    <span className="flex h-2 items-center">
                      {accents.has(index) ? (
                        <span className="size-2 rounded-pill bg-accent-600" />
                      ) : null}
                    </span>
                    <GridCell kind={kind} />
                    <span
                      className={`text-meta tabular-nums ${
                        outside ? "text-ink-300" : "text-ink-500"
                      }`}
                    >
                      {outside ? "·" : label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 text-meta text-ink-500 sm:hidden">
            左右滑动可以看完整的一小节；每格最左边是第 1 拍。
          </p>

          <GridLegend />

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="每小节击弦" value={`${strikes} 次`} />
            <Stat label="击弦密度" value={`${ratio}%`} hint={`${strikes} / ${cells} 格`} />
            <Stat
              label="比全弹少"
              value={saved > 0 ? `${saved} 次` : "0 次"}
              hint={saved > 0 ? `每小节少 ${saved} 次击弦` : "已经是上限"}
            />
            <Stat label="留白但手在动" value={`${ghosts} 格`} hint={`完全留白 ${rests} 格`} />
            <Stat
              label="起步速度"
              value={`${bpmLow}–${bpmHigh}`}
              hint="BPM"
            />
          </dl>
        </div>

        <p className="mt-4 measure text-meta text-ink-500 text-pretty">
          {bpmAdvice(pattern)}
        </p>
      </section>

      <Conclusion />

      <section aria-labelledby="rhythm-practice-heading" className="min-w-0">
        <h2 id="rhythm-practice-heading" className="text-title text-ink-950">
          怎么练
        </h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 measure text-body text-ink-700">
          {pattern.practice.map((item) => (
            <li key={item} className="text-pretty">
              {item}
            </li>
          ))}
        </ol>
        <p className="mt-4 measure text-meta text-ink-500 text-pretty">
          起步速度按目标速度的六成算：{bpmLow} BPM 的十六分音符只有{" "}
          {Math.round(sixteenthDurationMs(bpmLow))} 毫秒，{bpmHigh} BPM 时是{" "}
          {Math.round(sixteenthDurationMs(bpmHigh))} 毫秒。手指来不及就说明太快了。
        </p>
      </section>

      <section aria-labelledby="rhythm-groups-heading" className="min-w-0">
        <h2 id="rhythm-groups-heading" className="text-title text-ink-950">
          分组练习
        </h2>
        <p className="mt-2 measure text-body text-ink-700 text-pretty">
          {meter.label} 的重音在第 {meter.accents.map((beat) => beat + 1).join("、")} 拍。
          重音就是分组锚点：先把重音那一下钉住，再把整组填满。
        </p>

        <ol className="mt-4 flex list-decimal flex-col gap-3">
          {groups.map((group) => (
            <li
              key={group.index}
              className="rounded-card border border-rule bg-surface p-4 sm:p-5"
            >
              <p className="text-label text-ink-950">{group.description}</p>
              <p className="mt-1.5 text-meta text-ink-700 text-pretty">{group.instruction}</p>
              <p className="mt-2 text-meta text-ink-500">
                这一组里有 {strikesInRange(pattern, group.startCell, group.endCell)} 次击弦
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-4 measure text-meta text-ink-500 text-pretty">
          先只练第 1 组，其余几组先不管；第 1 组干净了再依次往下加。
          这是节拍器的第二个用法：它不只量速度，还标出乐句从哪儿开始。
        </p>
      </section>

      <Progression />
    </div>
  );
}

/** 一格：实心＝击弦，浅色＝留白但手在动，空心＝完全留白，虚框＝不属于这一小节 */
function GridCell({ kind }: { kind: CanvasCell }) {
  if (kind === "strike") {
    return <span className="aspect-square w-full max-w-14 rounded-pill bg-ink-950" />;
  }
  if (kind === "ghost") {
    return <span className="aspect-square w-full max-w-14 rounded-pill bg-ink-100" />;
  }
  if (kind === "outside") {
    return (
      <span className="aspect-square w-full max-w-14 rounded-pill border border-dashed border-ink-200" />
    );
  }
  return (
    <span className="aspect-square w-full max-w-14 rounded-pill border border-ink-200" />
  );
}

function GridLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-meta text-ink-700">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3.5 rounded-pill bg-ink-950" aria-hidden="true" />
        击弦
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3.5 rounded-pill bg-ink-100" aria-hidden="true" />
        留白，但右手保持运动
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-3.5 rounded-pill border border-ink-200"
          aria-hidden="true"
        />
        完全留白
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-3.5 rounded-pill border border-dashed border-ink-200"
          aria-hidden="true"
        />
        不属于这一小节
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-pill bg-accent-600" aria-hidden="true" />
        重音位置
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-micro uppercase text-ink-500">{label}</dt>
      <dd className="mt-1 text-label text-ink-950">{value}</dd>
      {hint ? <p className="mt-0.5 text-meta text-ink-500">{hint}</p> : null}
    </div>
  );
}

function PatternPicker({
  patternId,
  onPick,
}: {
  patternId: string;
  onPick: (id: string) => void;
}) {
  return (
    <section aria-labelledby="rhythm-pattern-label">
      <h2
        id="rhythm-pattern-label"
        className="text-label font-medium text-ink-700"
      >
        选一个节奏型
      </h2>
      <div role="group" aria-labelledby="rhythm-pattern-label" className="mt-3 flex flex-wrap gap-2">
        {RHYTHM_PATTERNS.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            aria-pressed={pattern.id === patternId}
            onClick={() => onPick(pattern.id)}
            title={pattern.summary}
            className="chip"
          >
            {pattern.short}
          </button>
        ))}
      </div>
    </section>
  );
}

function MeterPicker({
  meter,
  onPick,
}: {
  meter: Meter;
  onPick: (label: string) => void;
}) {
  return (
    <section aria-labelledby="rhythm-meter-label">
      <h2
        id="rhythm-meter-label"
        className="text-label font-medium text-ink-700"
      >
        拍号
      </h2>
      <div role="group" aria-labelledby="rhythm-meter-label" className="mt-3">
        <div className="segment-track flex-wrap">
          {RHYTHM_METERS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={option.label === meter.label}
              onClick={() => onPick(option.label)}
              className="segment"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-meta text-ink-500">
        {meter.description}；重音在第 {meter.accents.map((beat) => beat + 1).join("、")} 拍。
        5/4 一小节有 20 个十六分位，这一页的画布放不下，所以不列。
      </p>
    </section>
  );
}

/** 结论：十六分音符不该弹满 */
function Conclusion() {
  return (
    <section aria-labelledby="rhythm-conclusion-heading" className="min-w-0">
      <h2 id="rhythm-conclusion-heading" className="text-title text-ink-950">
        十六分音符不要全部实弹
      </h2>

      <div className="measure mt-3 space-y-3 text-body text-ink-700">
        <p className="text-pretty">
          一小节 4/4 有十六个十六分位。全部敲满当然「最准」，但多数人弹不好，
          而且弹好之后声音会挤成一团。Premier Guitar 把弹太满这件事叫
          <strong className="font-semibold text-ink-950">Sex Machine Syndrome</strong>——
          James Brown 唱《Get Up (I Feel Like Being a) Sex Machine)》时，吉他手弹的音太多，
          把人声盖住了。解法不是弹得更准，而是
          <strong className="font-semibold text-ink-950">暗示十六分律动但不实际弹满</strong>。
        </p>

        <p className="text-pretty">
          理由有三条，都跟吉他的物理有关：
        </p>

        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li className="text-pretty">
            <strong className="font-semibold text-ink-950">时间不够。</strong>
            120 BPM 下一个十六分只有 125 毫秒。一根弦被拨响后还要停下来才发声，
            要在 125 毫秒里完成一次完整的拨弦行程、又不碰到旁边的弦，力度就得收着，
            动作还必须稳。弹满的十六分是手上最紧张的一种活。
          </li>
          <li className="text-pretty">
            <strong className="font-semibold text-ink-950">声音没有空隙。</strong>
            前一个音还没结束，后一个已经响了。十六个音挤在两秒里，
            听感上糊成一片，节奏的轻重也就听不出来了。
          </li>
          <li className="text-pretty">
            <strong className="font-semibold text-ink-950">右手可以一直动。</strong>
            留白的那几下不是「停一下」，是手照常走完上下行程，只是不碰弦。
            手不停，律动就不断——这比硬撑着弹满更省力，也更像在伴奏而不是在抢话。
          </li>
        </ul>

        <p className="text-pretty">
          具体到手上：<strong className="font-semibold text-ink-950">1 和 and 永远是下扫，
          e 和 a 永远是上扫</strong>，e 和 a 不碰弦。上面「十六分留白」那一格画的就是这个：
          八个实心格，八个浅色格。
        </p>
      </div>
    </section>
  );
}

/** 从零到十六分重音的顺序（Premier Guitar 的渐进序列） */
function Progression() {
  const steps = [
    "60–75 BPM 起步。",
    "左手在 7 品只触不按做闷音。",
    "右手扫十六分「1 e & a」，先不加任何重音。",
    "重音依次落在 1、2、3、4。",
    "重音落到 and。",
    "重音落到 e。",
    "重音落到 a。",
    "两个连续重音。",
    "每三个十六分移位一次的重音。",
  ];

  return (
    <section aria-labelledby="rhythm-progression-heading" className="min-w-0">
      <h2 id="rhythm-progression-heading" className="text-title text-ink-950">
        十六分重音的推进顺序
      </h2>
      <p className="mt-2 measure text-body text-ink-700 text-pretty">
        同一套手型，重音的位置一步步挪。每一级都做到零错位再进下一级；
        上扫上的重音最难，留到最后。
      </p>
      <ol className="mt-4 flex list-decimal flex-col gap-1.5 pl-5 measure text-body text-ink-700">
        {steps.map((step) => (
          <li key={step} className="text-pretty">
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-4 measure text-meta text-ink-500 text-pretty">
        来源：Premier Guitar《Rhythm Rules: 16th-Note Accents》与
        《Syncopated 16th-Note Rhythms》，Guitar World《How to strum 16th notes on guitar》。
      </p>
    </section>
  );
}
