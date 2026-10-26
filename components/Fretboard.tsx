import { STANDARD_TUNING } from "@/lib/guitar";

/**
 * 纯展示用的横向指板图（SVG）。
 * 音位、变暗、高亮都由调用方算好传进来，方便复用在不同页面上。
 *
 * 交互说明：悬停/按下音位会联动同名音，点击可固定高亮。这是给指针设备的
 * 渐进增强——键盘用户获取同一信息走下方的「七把位速查」表格，因此这里不给
 * 每个音位加 tab 焦点（一张图会有几十个 tab 停靠点，反而更难用）。
 */

const STRING_GAP = 34;
const FRET_WIDTH = 35;
const PAD_LEFT = 52;
const PAD_RIGHT = 18;
const PAD_TOP = 30;
const PAD_BOTTOM = 44;
const NOTE_RADIUS = 12;
const BOARD_PAD_Y = 20;

/** 镶嵌记号所在品：只有这些品号会被加粗，方便定位 */
const INLAY_FRETS = new Set([3, 5, 7, 9, 12, 15, 17, 21]);

export type FretboardNote = {
  key: string;
  /** 0 = 6 弦，5 = 1 弦 */
  stringIndex: number;
  stringNumber: number;
  fret: number;
  pitchClass: number;
  /** 音名或音级，取决于调用方选择的显示方式 */
  label: string;
  isRoot: boolean;
  dimmed: boolean;
  emphasized: boolean;
  title: string;
};

export type FretboardProps = {
  fretCount: number;
  notes: FretboardNote[];
  ariaLabel: string;
  /** 指针进入某个音时回调它的音高类（用于同名音联动高亮），离开时传 null */
  onHoverPitchClass?: (pitchClass: number | null) => void;
  /** 点击某个音时回调它的音高类（触屏与固定高亮用） */
  onTogglePitchClass?: (pitchClass: number) => void;
};

export function Fretboard({
  fretCount,
  notes,
  ariaLabel,
  onHoverPitchClass,
  onTogglePitchClass,
}: FretboardProps) {
  const stringCount = STANDARD_TUNING.length;
  const width = PAD_LEFT + fretCount * FRET_WIDTH + PAD_RIGHT;
  const height = PAD_TOP + (stringCount - 1) * STRING_GAP + PAD_BOTTOM;
  const boardTop = PAD_TOP - BOARD_PAD_Y;
  const boardHeight = (stringCount - 1) * STRING_GAP + BOARD_PAD_Y * 2;
  const boardBottom = boardTop + boardHeight;
  // 镶嵌记号画在第 3、4 弦之间的空白带
  const inlayY = PAD_TOP + ((stringCount - 1) * STRING_GAP) / 2;

  // 低音弦画在图下方，音高自上而下递减，与六线谱读法一致
  const yForString = (stringIndex: number) =>
    PAD_TOP + (stringCount - 1 - stringIndex) * STRING_GAP;
  // 第 f 品的音，落在第 f-1 与第 f 根品丝之间
  const xForFret = (fret: number) => PAD_LEFT + (fret - 0.5) * FRET_WIDTH;
  const xForFretLine = (fret: number) => PAD_LEFT + fret * FRET_WIDTH;

  const frets = Array.from({ length: fretCount }, (_, index) => index + 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      /* 保留 width/height 的内在尺寸，由外层 overflow-x-auto 承担横向滚动；
         这样不需要内联 style，也不会把音位缩到看不清。 */
      className="block h-auto max-w-none"
    >
      <defs>
        <linearGradient id="fretboard-surface" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-board-800)" />
          <stop offset="100%" stopColor="var(--color-board-900)" />
        </linearGradient>
      </defs>

      {/* 指板底板 */}
      <rect
        x={PAD_LEFT}
        y={boardTop}
        width={fretCount * FRET_WIDTH}
        height={boardHeight}
        rx={8}
        fill="url(#fretboard-surface)"
      />

      {/* 镶嵌记号：画在第 3、4 弦之间的中心线上 */}
      {frets.map((fret) =>
        INLAY_FRETS.has(fret) ? (
          <circle
            key={`inlay-${fret}`}
            cx={xForFret(fret)}
            cy={inlayY}
            r={2.5}
            className="fill-white/15"
          />
        ) : null,
      )}

      {/* 品丝 */}
      {frets.map((fret) => (
        <line
          key={`fret-${fret}`}
          x1={xForFretLine(fret)}
          y1={boardTop}
          x2={xForFretLine(fret)}
          y2={boardBottom}
          className="stroke-white/12"
          strokeWidth={1.5}
        />
      ))}

      {/* 琴枕 */}
      <rect
        x={PAD_LEFT - 5}
        y={boardTop}
        width={5}
        height={boardHeight}
        className="fill-white/45"
        rx={1.5}
      />

      {/* 琴弦 */}
      {STANDARD_TUNING.map((string, stringIndex) => (
        <line
          key={`string-${string.number}`}
          x1={PAD_LEFT}
          y1={yForString(stringIndex)}
          x2={PAD_LEFT + fretCount * FRET_WIDTH}
          y2={yForString(stringIndex)}
          className="stroke-white/30"
          strokeWidth={0.8 + (stringCount - 1 - stringIndex) * 0.24}
          strokeLinecap="round"
        />
      ))}

      {/* 弦号 + 空弦音名 */}
      {STANDARD_TUNING.map((string, stringIndex) => (
        <text
          key={`label-${string.number}`}
          x={PAD_LEFT - 12}
          y={yForString(stringIndex) + 4}
          textAnchor="end"
          fontSize={11}
          className="fill-ink-700"
        >
          <tspan className="fill-ink-700">{string.number}</tspan>
          <tspan dx={5} className="fill-ink-700" fontWeight={600}>
            {string.openName}
          </tspan>
        </text>
      ))}

      {/* 品号 */}
      {frets.map((fret) => (
        <text
          key={`number-${fret}`}
          x={xForFret(fret)}
          y={boardBottom + 20}
          textAnchor="middle"
          fontSize={11}
          className="fill-ink-700"
        >
          {fret}
        </text>
      ))}

      {/* 音位 */}
      {notes.map((note) => {
        const cx = xForFret(note.fret);
        const cy = yForString(note.stringIndex);
        return (
          <g
            key={note.key}
            opacity={note.dimmed ? 0.16 : 1}
            className="cursor-pointer transition-opacity duration-150"
            onPointerEnter={() => onHoverPitchClass?.(note.pitchClass)}
            onPointerLeave={() => onHoverPitchClass?.(null)}
            onClick={() => onTogglePitchClass?.(note.pitchClass)}
          >
            {/* 用 desc 而不是 title：title 会被 React 19 提升到 head，留下空节点 */}
            <desc>{note.title}</desc>
            <circle
              cx={cx}
              cy={cy}
              r={NOTE_RADIUS}
              className={note.isRoot ? "fill-accent-600" : "fill-ink-100"}
            />
            {note.emphasized ? (
              <circle
                cx={cx}
                cy={cy}
                r={NOTE_RADIUS - 3.5}
                fill="none"
                strokeWidth={2}
                className="stroke-accent-700"
              />
            ) : null}
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              className={`${note.isRoot ? "fill-white" : "fill-ink-950"} pointer-events-none`}
            >
              {note.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
