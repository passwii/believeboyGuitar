"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  chordBoxWindow,
  chordCharacter,
  chordName,
  chordSymbol,
  chordTones,
  queryChordVoicings,
  stringCells,
  voicingSpan,
  voicingStartFret,
  voicingSuggestion,
  type ChordQuery,
} from "@/lib/chords";
import {
  CHORD_ROOTS,
  CHORD_TYPE_LIST,
  chordTypeById,
  type ChordVoicing,
} from "@/lib/guitar";

/**
 * 和弦库。
 *
 * 音位不是抄的：全部来自 lib/guitar.ts 的 practicalChordVoicings，
 * 那是由标准调弦与音程组合推导出来的。这个组件只负责选与展示。
 */

/** 页面默认落在 C 大三和弦上：最常被问到的那个 */
const DEFAULT_ROOT = "C";
const DEFAULT_TYPE = "major";

export function ChordLibrary() {
  const [root, setRoot] = useState<string>(DEFAULT_ROOT);
  const [typeId, setTypeId] = useState<string>(DEFAULT_TYPE);
  // 默认包含转位：同一根音下，根音不一定是最低音，
  // 这一点只有把转位一起列出来才看得出来。
  const [includeInversions, setIncludeInversions] = useState(true);

  const type = useMemo(() => chordTypeById(typeId), [typeId]);

  const query: ChordQuery = useMemo(
    () => ({ root, typeId, includeInversions }),
    [root, typeId, includeInversions],
  );

  const voicings = useMemo(() => queryChordVoicings(query), [query]);

  const symbol = chordSymbol(root, type);
  const title = chordName(root, type);

  return (
    <div className="mt-8">
      <section aria-labelledby="chord-picker-heading" className="measure">
        <h2
          id="chord-picker-heading"
          className="text-micro font-medium uppercase text-ink-500"
        >
          选一个和弦
        </h2>

        <div className="mt-4">
          <p id="chord-root-label" className="text-label text-ink-700">
            根音
          </p>
          <div
            role="group"
            aria-labelledby="chord-root-label"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {CHORD_ROOTS.map((item) => {
              const active = root === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoot(item)}
                  className={`inline-flex size-11 items-center justify-center rounded-pill font-mono text-label transition-colors duration-150 ${
                    active
                      ? "bg-accent-700 text-white"
                      : "bg-surface-muted text-ink-700 hover:text-ink-950"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p id="chord-type-label" className="text-label text-ink-700">
            性质
          </p>
          <div
            role="group"
            aria-labelledby="chord-type-label"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {CHORD_TYPE_LIST.map((item) => {
              const active = typeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeId(item.id)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-meta transition-colors duration-150 ${
                    active
                      ? "border-transparent bg-accent-700 text-white"
                      : "border-rule bg-surface text-ink-700 hover:border-control-edge hover:text-ink-950"
                  }`}
                >
                  <span className="font-semibold">{chordSymbol(root, item)}</span>
                  <span className={active ? "text-white" : "text-ink-500"}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            aria-pressed={includeInversions}
            onClick={() => setIncludeInversions((current) => !current)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-control border px-3 text-meta transition-colors duration-150 ${
              includeInversions
                ? "border-transparent bg-accent-700 text-white"
                : "border-rule bg-surface text-ink-700 hover:border-control-edge hover:text-ink-950"
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block size-3.5 rounded-pill border ${
                includeInversions ? "border-white bg-white" : "border-control-edge"
              }`}
            />
            同时看转位
          </button>
          <p className="mt-1.5 measure text-meta leading-relaxed text-ink-500">
            {includeInversions
              ? "现在包含最低音不是根音的按法，根音可能落在中间的弦上。"
              : "只显示根音在最低音的按法——那是最常用、也最好记的位置。"}
          </p>
        </div>
      </section>

      <section aria-labelledby="chord-result-heading" className="mt-10">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="chord-result-heading" className="text-title text-ink-950">
            {title}
          </h2>
          <span className="font-mono text-label text-ink-500">{symbol}</span>
        </div>
        <p className="mt-2 measure text-meta leading-relaxed text-ink-500">
          {chordCharacter(type)}。共 {voicings.length} 个实用按法，按最低音从低到高排列。
        </p>

        {voicings.length === 0 ? (
          <p className="mt-6 text-body text-ink-700">
            这个组合在 15 品以内没有找到位宽合适的按法。换个性质或根音再试。
          </p>
        ) : (
          <ol className="mt-5 space-y-5">
            {voicings.map((voicing, index) => (
              <li key={voicingKey(voicing)}>
                <VoicingCard voicing={voicing} index={index} symbol={symbol} />
              </li>
            ))}
          </ol>
        )}

        {voicings.length > 0 ? <ChordNeck voicings={voicings} /> : null}
      </section>

      <ChordExplanation />
    </div>
  );
}

/** 一个按法的唯一标识：弦与品位的组合 */
function voicingKey(voicing: ChordVoicing): string {
  return voicing.notes
    .map((note) => `${note.stringNumber}-${note.fret}`)
    .sort()
    .join("_");
}

/** 一个按法的卡片：文字速查 + 六线谱式按法图 */
function VoicingCard({
  voicing,
  index,
  symbol,
}: {
  voicing: ChordVoicing;
  index: number;
  symbol: string;
}) {
  const cells = stringCells(voicing);
  const tones = chordTones(voicing);
  const span = voicingSpan(voicing);
  const startFret = voicingStartFret(voicing);
  const bass = voicing.notes[0];

  return (
    <article className="rounded-card border border-rule bg-surface p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-title text-ink-950">按法 {index + 1}</h3>
        <span className="text-meta text-ink-500">
          最低音 {bass.name}
          {bass.fret === 0 ? "（空弦）" : `（${bass.stringNumber} 弦 ${bass.fret} 品）`}
        </span>
        {bass.isRoot ? null : (
          <span className="text-meta text-accent-700">转位</span>
        )}
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-5">
        <ChordBox voicing={voicing} />

        <div className="min-w-0">
          {/* 弦-品位 + 音名的文字速查：按法图之外的等价读法，屏幕阅读器也读得到 */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {cells
              .filter((cell) => cell.fret !== null)
              .map((cell) => (
                <li key={cell.stringNumber} className="text-meta">
                  <span className="font-mono text-ink-950">
                    {cell.stringNumber} 弦 {cell.fret === 0 ? "空弦" : `${cell.fret} 品`}
                  </span>
                  <span className="ml-1.5 text-ink-500">{cell.name}</span>
                  {cell.isRoot ? (
                    <span className="ml-1.5 font-medium text-accent-700">根音</span>
                  ) : null}
                </li>
              ))}
          </ul>

          <p className="mt-3 text-meta leading-relaxed text-ink-700">
            {voicingSuggestion(voicing)}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-rule pt-3 text-meta sm:grid-cols-4">
            <div>
              <dt className="text-micro uppercase text-ink-500">和弦</dt>
              <dd className="mt-0.5 font-mono text-label text-ink-950">{symbol}</dd>
            </div>
            <div>
              <dt className="text-micro uppercase text-ink-500">音级</dt>
              <dd className="mt-0.5 text-label text-ink-950">
                {tones.map((tone) => tone.name).join(" ")}
              </dd>
            </div>
            <div>
              <dt className="text-micro uppercase text-ink-500">位宽</dt>
              <dd className="mt-0.5 text-label text-ink-950 tabular-nums">{span} 品</dd>
            </div>
            <div>
              <dt className="text-micro uppercase text-ink-500">起始品</dt>
              <dd className="mt-0.5 text-label text-ink-950 tabular-nums">
                {startFret === 0 ? "含空弦" : `第 ${startFret} 品`}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

/**
 * 六线谱式的按法图。
 * 横列是品格，纵行是六根弦（低音弦在上，与六线谱一致）。
 * 每格写音名，根音填强调色；含空弦时第 0 品单独成列，粗线是琴枕。
 */
function ChordBox({ voicing }: { voicing: ChordVoicing }) {
  const window = chordBoxWindow(voicing);
  const cells = stringCells(voicing);

  // 一列 = 一个品位。含空弦时第 0 品单独成列，琴枕线在它与第 1 品之间。
  const columns = window.hasOpenStrings
    ? [
        { fret: 0, isNut: false },
        ...Array.from({ length: window.rows }, (_, index) => ({
          fret: index + 1,
          isNut: index === 0,
        })),
      ]
    : Array.from({ length: window.rows }, (_, index) => ({
        fret: window.start + index,
        isNut: false,
      }));

  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain rounded-control border border-rule bg-canvas p-2">
        <div className="w-max">
          {/* 品号行：让每一列对应哪个品一目了然 */}
          <div className="flex">
            <span className="w-8 shrink-0" aria-hidden="true" />
            {columns.map((column, index) => (
              <span
                key={column.fret}
                className={`flex h-6 w-10 items-center justify-center border-r border-rule font-mono text-micro text-ink-500 ${
                  column.isNut ? "border-l-2 border-l-ink-950" : ""
                } ${index === columns.length - 1 ? "border-r-0" : ""}`}
              >
                {column.fret === 0 ? "空" : column.fret}
              </span>
            ))}
          </div>

          {cells.map((cell) => (
            <div key={cell.stringNumber} className="flex">
              <span className="flex h-9 w-8 shrink-0 items-center justify-center border-t border-rule font-mono text-micro font-medium text-ink-700">
                {cell.stringNumber}
              </span>
              {columns.map((column, index) => {
                const hit = cell.fret === column.fret;
                return (
                  <span
                    key={column.fret}
                    className={`flex h-9 w-10 items-center justify-center border-t border-r border-rule font-mono text-micro ${
                      hit
                        ? cell.isRoot
                          ? "bg-accent-700 font-semibold text-white"
                          : "bg-accent-100 font-semibold text-ink-950"
                        : "text-ink-300"
                    } ${column.isNut ? "border-l-2 border-l-ink-950" : ""} ${
                      index === columns.length - 1 ? "border-r-0" : ""
                    }`}
                  >
                    {hit ? cell.name : ""}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-meta text-ink-500">
        {window.hasOpenStrings
          ? "「空」是空弦，粗线是琴枕"
          : `从第 ${window.start} 品起，到第 ${window.end} 品`}
      </p>
    </div>
  );
}

/* ==========================================================================
   指板图
   ========================================================================== */

const NECK_STRING_GAP = 26;
const NECK_FRET_WIDTH = 30;
/** 左侧留出：弦号文字 → 空弦圈 → 琴枕 */
const NECK_PAD_LEFT = 64;
const NECK_PAD_RIGHT = 16;
const NECK_PAD_TOP = 22;
const NECK_PAD_BOTTOM = 34;
const NECK_DOT_RADIUS = 11;

/** 弦号与空弦音名，写在琴枕左边 */
const NECK_STRING_LABELS: { number: number; open: string }[] = [
  { number: 6, open: "E" },
  { number: 5, open: "A" },
  { number: 4, open: "D" },
  { number: 3, open: "G" },
  { number: 2, open: "B" },
  { number: 1, open: "E" },
];

/**
 * 整个和弦在指板上的位置。
 *
 * 一次画出当前和弦所有按法用到的音位，而不是每个按法各画一张：
 * 一张图就能看出「这个和弦在指板上占哪几段」，
 * 也避免每张按法卡片下面都挂一张图，把页面压成仪表盘。
 *
 * 空弦画在琴枕左侧的空心圈里（和和弦图的记法一致），
 * 所以这张图不是复用 components/Fretboard.tsx——那个组件从第 1 品起画，
 * 放不下空弦。
 */
function ChordNeck({ voicings }: { voicings: ChordVoicing[] }) {
  const notes = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        stringIndex: number;
        stringNumber: number;
        fret: number;
        name: string;
        isRoot: boolean;
      }
    >();

    for (const voicing of voicings) {
      for (const note of voicing.notes) {
        const key = `${note.stringIndex}-${note.fret}`;
        const existing = map.get(key);
        map.set(key, {
          key,
          stringIndex: note.stringIndex,
          stringNumber: note.stringNumber,
          fret: note.fret,
          name: note.name,
          isRoot: (existing?.isRoot ?? false) || note.isRoot,
        });
      }
    }

    return [...map.values()].sort(
      (a, b) => a.stringIndex - b.stringIndex || a.fret - b.fret,
    );
  }, [voicings]);

  const maxFret = Math.max(4, ...notes.map((note) => note.fret));
  const width = NECK_PAD_LEFT + maxFret * NECK_FRET_WIDTH + NECK_PAD_RIGHT;
  const height =
    NECK_PAD_TOP + (NECK_STRING_LABELS.length - 1) * NECK_STRING_GAP + NECK_PAD_BOTTOM;

  // 低音弦画在下方，与六线谱读法一致
  const yForString = (stringIndex: number) =>
    NECK_PAD_TOP +
    (NECK_STRING_LABELS.length - 1 - stringIndex) * NECK_STRING_GAP;
  // 第 f 品落在第 f-1 与第 f 根品丝之间；空弦在琴枕左边的空心圈里
  const xForFret = (fret: number) =>
    fret === 0
      ? NECK_PAD_LEFT - 14
      : NECK_PAD_LEFT + (fret - 1) * NECK_FRET_WIDTH + NECK_FRET_WIDTH / 2;
  const xForFretLine = (fret: number) => NECK_PAD_LEFT + (fret - 1) * NECK_FRET_WIDTH;

  const frets = Array.from({ length: maxFret }, (_, index) => index + 1);
  const openNotes = notes.filter((note) => note.fret === 0);
  const frettedNotes = notes.filter((note) => note.fret > 0);

  const label =
    `${chordName(voicings[0].root, chordTypeById(voicings[0].typeId))} 在指板上的位置：` +
    `空心圈是空弦，实心点是按到的音，根音用强调色标出`;

  return (
    <section aria-labelledby="chord-neck-heading" className="mt-10">
      <h3 id="chord-neck-heading" className="text-title text-ink-950">
        在指板上的位置
      </h3>
      <p className="mt-1 measure text-meta leading-relaxed text-ink-500">
        把上面所有按法的音位合在一张图上，能看出这个和弦在指板上占哪几段。
      </p>

      <div className="mt-4 overflow-x-auto overscroll-x-contain rounded-control border border-rule bg-surface p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={label}
          className="block h-auto max-w-none"
        >
          {/* 琴枕 */}
          <rect
            x={NECK_PAD_LEFT - 5}
            y={NECK_PAD_TOP - 12}
            width={5}
            height={(NECK_STRING_LABELS.length - 1) * NECK_STRING_GAP + 24}
            rx={1.5}
            className="fill-ink-950"
          />

          {/* 品丝 */}
          {frets.map((fret) => (
            <line
              key={fret}
              x1={xForFretLine(fret)}
              y1={NECK_PAD_TOP - 12}
              x2={xForFretLine(fret)}
              y2={NECK_PAD_TOP + (NECK_STRING_LABELS.length - 1) * NECK_STRING_GAP + 12}
              className="stroke-rule"
              strokeWidth={1}
            />
          ))}

          {/* 琴弦 */}
          {NECK_STRING_LABELS.map((string, stringIndex) => (
            <line
              key={string.number}
              x1={NECK_PAD_LEFT}
              y1={yForString(stringIndex)}
              x2={NECK_PAD_LEFT + maxFret * NECK_FRET_WIDTH}
              y2={yForString(stringIndex)}
              className="stroke-ink-200"
              strokeWidth={0.8 + (NECK_STRING_LABELS.length - 1 - stringIndex) * 0.22}
              strokeLinecap="round"
            />
          ))}

          {/* 弦号与空弦音名 */}
          {NECK_STRING_LABELS.map((string, stringIndex) => (
            <text
              key={string.number}
              x={NECK_PAD_LEFT - 34}
              y={yForString(stringIndex) + 4}
              textAnchor="end"
              fontSize={11}
              className="fill-ink-700"
            >
              {string.number} {string.open}
            </text>
          ))}

          {/* 品号 */}
          {frets.map((fret) => (
            <text
              key={fret}
              x={xForFret(fret)}
              y={NECK_PAD_TOP + (NECK_STRING_LABELS.length - 1) * NECK_STRING_GAP + 28}
              textAnchor="middle"
              fontSize={11}
              className="fill-ink-500"
            >
              {fret}
            </text>
          ))}

          {/* 空弦：琴枕左侧的空心圈 */}
          {openNotes.map((note) => (
            <g key={note.key}>
              <circle
                cx={xForFret(0)}
                cy={yForString(note.stringIndex)}
                r={6}
                className="fill-surface stroke-ink-700"
                strokeWidth={1.5}
              />
              <title>
                {note.stringNumber} 弦空弦 · {note.name}
                {note.isRoot ? "（根音）" : ""}
              </title>
            </g>
          ))}

          {/* 按到的音 */}
          {frettedNotes.map((note) => (
            <g key={note.key}>
              <circle
                cx={xForFret(note.fret)}
                cy={yForString(note.stringIndex)}
                r={NECK_DOT_RADIUS}
                className={note.isRoot ? "fill-accent-600" : "fill-ink-100"}
              />
              <text
                x={xForFret(note.fret)}
                y={yForString(note.stringIndex) + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                className={note.isRoot ? "fill-white" : "fill-ink-950"}
              >
                {note.name}
              </text>
              <title>
                {note.stringNumber} 弦 {note.fret} 品 · {note.name}
                {note.isRoot ? "（根音）" : ""}
              </title>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-meta text-ink-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-pill bg-accent-600" aria-hidden="true" />
          根音
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-pill bg-ink-100" aria-hidden="true" />
          和弦音
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-pill border border-ink-700 bg-surface"
            aria-hidden="true"
          />
          空弦
        </span>
        <span className="text-ink-500">低音弦在图下方</span>
      </div>
    </section>
  );
}

/** 说明区：这个页面的音位是怎么来的 */
function ChordExplanation() {
  return (
    <section
      aria-labelledby="chord-explain-heading"
      className="mt-12 border-t border-rule pt-8"
    >
      <h2 id="chord-explain-heading" className="text-title text-ink-950">
        这里的按法是怎么算出来的
      </h2>

      <div className="mt-4 measure space-y-4 text-body text-ink-700">
        <p className="text-pretty">
          <strong>不是抄的指法表。</strong>
          每一个按法都从标准调弦 EADGBE 与和弦的音程组合推导出来：
          先确定根音在指板上的实际音高，再按各音与根音的半音差，
          找出每根弦上能按到的位置，组合成连续可按的音位。
        </p>
        <p className="text-pretty">
          推导结果还要过三道筛：最高与最低品位相差不超过 4 品（手指够得到）、
          弦号连续（不跳弦）、同一形状只保留位置最低的那个。
          所以同一个和弦在指板上几十种按法，最后留下的是几个真正好用的和弦型。
        </p>
        <p className="text-pretty">
          <strong>练之前请在自己的琴上核对。</strong>
          音名拼写与品位位置都按十二平均律和标准调弦算出，
          但不同琴的弦距、品丝位置、以及你在某个音上的习惯记法都可能不一样。
          弹之前先在琴上核对根音在哪根弦的第几品，再开始练。
        </p>
        <p className="text-pretty">
          原理部分可以看资料库里的
          <Link
            href="/library/harmony-chords-and-modes"
            className="ml-1 inline-flex min-h-11 items-center text-accent-700 underline underline-offset-4"
          >
            《和弦构造、调式与和声进行》
          </Link>
          ——那一篇讲的是「为什么是这些音」，这一页讲的是「手放哪里」。
        </p>
      </div>
    </section>
  );
}
