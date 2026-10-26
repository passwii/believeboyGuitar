import type { TabMeasure } from "@/lib/tab";
import { describeMeasureNotes, describePicking, groupNotesForRhythm } from "@/lib/tab";
import {
  TAB_LAYOUT,
  tabBeamRowY,
  tabBeamYs,
  tabFretBaselineY,
  tabMeasureWidth,
  tabNoteFontSize,
  tabNoteX,
  tabStemSpan,
  tabStringY,
  tabSystemWidth,
  tabTripletMark,
} from "@/lib/tab-layout";

export type TabStaffProps = {
  measures: readonly TabMeasure[];
  bpm: number;
  /** 拍号，默认 4/4。 */
  timeSignature?: readonly [number, number];
  cdStart?: string;
  /** 给读屏与图注用的曲谱名称。 */
  title?: string;
  /** 额外显示在谱面上方信息栏中的标签。 */
  meta?: readonly string[];
};

const STRING_LABELS = ["E", "B", "G", "D", "A", "E"] as const;

function tabMinWidthClass(maxNoteCount: number): string {
  if (maxNoteCount >= 15) return "tab-staff tab-staff--wide";
  if (maxNoteCount >= TAB_LAYOUT.denseNoteCount) return "tab-staff tab-staff--triplet";
  return "tab-staff";
}

function chunkMeasures(measures: readonly TabMeasure[]): TabMeasure[][] {
  const systems: TabMeasure[][] = [];
  for (let index = 0; index < measures.length; index += TAB_LAYOUT.measuresPerSystem) {
    systems.push(measures.slice(index, index + TAB_LAYOUT.measuresPerSystem));
  }
  return systems;
}

export function TabStaff({
  measures,
  bpm,
  timeSignature = [4, 4],
  cdStart,
  title = "TAB 谱",
  meta = [],
}: TabStaffProps) {
  if (measures.length === 0) {
    return <p className="text-meta text-ink-500">这份谱面还没有音符。</p>;
  }

  const systems = chunkMeasures(measures);
  const systemLayouts = systems.map((systemMeasures) => {
    const measureWidths = systemMeasures.map((measure) =>
      tabMeasureWidth(Math.max(measure.notes.length, measure.picking?.length ?? 0)),
    );
    return {
      measures: systemMeasures,
      measureWidths,
      width: tabSystemWidth(measureWidths),
    };
  });
  const systemWidth = Math.max(...systemLayouts.map((system) => system.width));
  const height = systemLayouts.length * TAB_LAYOUT.systemHeight;
  const maxNoteCount = Math.max(
    ...measures.map((measure) => measure.notes.length),
  );
  const minWidthClass = tabMinWidthClass(maxNoteCount);
  const [beatsPerBar, beatUnit] = timeSignature;
  const timeSignatureLabel = `${beatsPerBar}/${beatUnit}`;
  const description = measures
    .map((measure, index) => {
      const picking = describePicking(measure);
      return `第 ${index + 1} 小节：${describeMeasureNotes(measure)}${
        picking ? `；拨片：${picking}` : ""
      }`;
    })
    .join("；");

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-500">
        {cdStart ? <span>CD {cdStart}</span> : null}
        <span>♩ = {bpm}</span>
        <span>{timeSignatureLabel} 拍</span>
        <span>{measures.length} 小节</span>
        {meta.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
        <span className="sm:hidden">谱面可左右滑动</span>
      </figcaption>
      <div
        className="-mx-1 overflow-x-auto px-1"
        tabIndex={0}
        role="region"
        aria-label={`${title}，可左右滚动`}
      >
        <svg
          viewBox={`0 0 ${systemWidth} ${height}`}
          width={systemWidth}
          height={height}
          role="img"
          className={`block h-auto w-full text-ink-950 ${minWidthClass}`}
        >
          <title>{`${title}：${measures.length} 小节，速度每分钟 ${bpm} 拍`}</title>
          <desc>{`六线吉他 TAB，${timeSignatureLabel} 拍。${description}`}</desc>

          {systemLayouts.map((system, systemIndex) => {
            const { measures: systemMeasures, measureWidths } = system;
            const rowTop = systemIndex * TAB_LAYOUT.systemHeight;
            const systemEndX =
              TAB_LAYOUT.systemPadX +
              measureWidths.reduce((total, width) => total + width, 0);

            return (
              <g key={`system-${systemIndex}`}>
                {systemMeasures.map((measure, measureIndex) => {
                  const measureWidth = measureWidths[measureIndex];
                  const measureX =
                    TAB_LAYOUT.systemPadX +
                    measureWidths
                      .slice(0, measureIndex)
                      .reduce((total, width) => total + width, 0);
                  const count = Math.max(1, measure.notes.length);
                  const maxSlot = measure.notes.reduce(
                    (max, note) => Math.max(max, note.slot ?? -1),
                    -1,
                  );
                  const noteGridCount = Math.max(
                    count,
                    measure.picking?.length ?? 0,
                    maxSlot + 1,
                  );
                  const noteXAt = (noteIndex: number) =>
                    tabNoteX(
                      measureX,
                      measure.notes[noteIndex].slot ?? noteIndex,
                      noteGridCount,
                      measureWidth,
                    );
                  const rhythmGroups = groupNotesForRhythm(measure.notes);
                  const noteFontSize = tabNoteFontSize(count);
                  const fingerFontSize = count >= TAB_LAYOUT.denseNoteCount ? 9 : 10;
                  const highestStringY = measure.notes.reduce(
                    (top, note) => Math.min(top, tabStringY(rowTop, note.string)),
                    tabStringY(rowTop, TAB_LAYOUT.stringCount),
                  );
                  const beamY = tabBeamRowY(highestStringY);
                  const fingerY = tabStringY(rowTop, TAB_LAYOUT.stringCount) + TAB_LAYOUT.fingerGap;
                  const pickY = rowTop + TAB_LAYOUT.strokeY;

                  return (
                    <g key={`measure-${measureIndex}`}>
                      {Array.from({ length: TAB_LAYOUT.stringCount }, (_, stringIndex) => {
                        const y = tabStringY(rowTop, stringIndex + 1);
                        return (
                          <g key={`string-${stringIndex}`}>
                            <line
                              x1={measureX}
                              y1={y}
                              x2={measureX + measureWidth}
                              y2={y}
                              stroke="currentColor"
                              strokeWidth={1}
                              opacity={0.55}
                            />
                            {measureIndex === 0 ? (
                              <text
                                x={8}
                                y={y + 3}
                                textAnchor="middle"
                                fontFamily="var(--font-mono)"
                                fontSize={9}
                                className="fill-ink-500"
                              >
                                {STRING_LABELS[stringIndex]}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}

                      <line
                        x1={measureX}
                        y1={tabStringY(rowTop, 1)}
                        x2={measureX}
                        y2={tabStringY(rowTop, TAB_LAYOUT.stringCount)}
                        stroke="currentColor"
                        strokeWidth={1.25}
                      />

                      {measure.picking?.map((pick, pickIndex) => {
                        const pickCount = Math.max(1, measure.picking?.length ?? 0);
                        const pickX = tabNoteX(
                          measureX,
                          pickIndex,
                          pickCount,
                          measureWidth,
                        );
                        const glyph = pick.stroke === "down" ? "⊓" : "∨";

                        return (
                          <text
                            key={`pick-${pickIndex}`}
                            x={pickX}
                            y={pickY}
                            textAnchor="middle"
                            fontFamily="var(--font-mono)"
                            fontSize={pick.ghost ? 9 : 11}
                            fontWeight={600}
                            className={pick.ghost ? "fill-ink-300" : "fill-ink-700"}
                          >
                            {pick.ghost ? `(${glyph})` : glyph}
                          </text>
                        );
                      })}

                      {rhythmGroups.map((group) => {
                        const xs = group.notes.map((_, index) =>
                          noteXAt(group.start + index),
                        );
                        const startX = xs[0];
                        const endX = xs[xs.length - 1];
                        const beamed = group.beams > 0;
                        const beamYs = beamed ? tabBeamYs(beamY, group.beams) : [];
                        const triplet = group.triplet ? tabTripletMark(beamY, startX, endX) : null;

                        return (
                          <g key={`rhythm-${group.start}`}>
                            {group.notes.map((note, index) => {
                              const { top, bottom } = tabStemSpan({
                                stringY: tabStringY(rowTop, note.string),
                                fontSize: noteFontSize,
                                beamY: beamed ? beamY : undefined,
                              });

                              return (
                                <line
                                  key={`stem-${group.start + index}`}
                                  x1={xs[index]}
                                  y1={top}
                                  x2={xs[index]}
                                  y2={bottom}
                                  stroke="currentColor"
                                  strokeWidth={1.25}
                                  className="tab-stem"
                                />
                              );
                            })}

                            {beamed && group.notes.length > 1
                              ? beamYs.map((y) => (
                                  <line
                                    key={`beam-${y}`}
                                    x1={startX}
                                    y1={y}
                                    x2={endX}
                                    y2={y}
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                  />
                                ))
                              : null}

                            {beamed && group.notes.length === 1 ? (
                              <path
                                d={`M ${startX} ${beamY} q 8 5 6 13`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.25}
                              />
                            ) : null}

                            {group.notes.map((note, index) =>
                              note.accent ? (
                                <text
                                  key={`accent-${group.start + index}`}
                                  x={xs[index]}
                                  y={beamY - 13}
                                  textAnchor="middle"
                                  fontFamily="var(--font-mono)"
                                  fontSize={11}
                                  fontWeight={700}
                                  fill="currentColor"
                                >
                                  &gt;
                                </text>
                              ) : null,
                            )}

                            {triplet ? (
                              <g>
                                <path
                                  d={`M ${startX} ${triplet.tickY} V ${triplet.lineY} H ${endX} V ${triplet.tickY}`}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1}
                                />
                                <text
                                  x={triplet.centerX}
                                  y={triplet.labelY}
                                  textAnchor="middle"
                                  fontFamily="var(--font-mono)"
                                  fontSize={10}
                                  fontWeight={600}
                                  fill="currentColor"
                                >
                                  3
                                </text>
                              </g>
                            ) : null}
                          </g>
                        );
                      })}

                      {measure.notes.map((note, noteIndex) => {
                        if (note.silent) return null;

                        const x = noteXAt(noteIndex);
                        const stringY = tabStringY(rowTop, note.string);
                        const fretLabel = note.tie
                          ? "~"
                          : (note.fretLabel ?? String(note.fret));
                        const maskWidth = noteFontSize * 0.62 * fretLabel.length + 3;
                        const previousX =
                          noteIndex > 0
                            ? noteXAt(noteIndex - 1)
                            : x;

                        return (
                          <g key={`note-${noteIndex}`}>
                            <rect
                              x={x - maskWidth / 2}
                              y={stringY - noteFontSize * TAB_LAYOUT.fretGlyphTop}
                              width={maskWidth}
                              height={noteFontSize}
                              className="fill-surface"
                            />
                            <text
                              x={x}
                              y={tabFretBaselineY(stringY)}
                              textAnchor="middle"
                              fontFamily="var(--font-mono)"
                              fontSize={noteFontSize}
                              fontWeight={600}
                              fill="currentColor"
                            >
                              {fretLabel}
                            </text>
                            {note.finger ? (
                              <text
                                x={x}
                                y={fingerY}
                                textAnchor="middle"
                                fontFamily="var(--font-sans)"
                                fontSize={fingerFontSize}
                                className="fill-ink-500"
                              >
                                {note.finger}
                              </text>
                            ) : null}
                            {note.shift ? (
                              <text
                                x={x}
                                y={fingerY + 12}
                                textAnchor="middle"
                                fontFamily="var(--font-sans)"
                                fontSize={8}
                                fontWeight={600}
                                className="fill-ink-500"
                              >
                                移
                              </text>
                            ) : null}
                            {note.hammerOn ? (
                              <text
                                x={(previousX + x) / 2}
                                y={stringY + 15}
                                textAnchor="middle"
                                fontFamily="var(--font-sans)"
                                fontSize={8}
                                fontWeight={600}
                                className="fill-ink-700"
                              >
                                h
                              </text>
                            ) : null}
                            {note.quarterChoke ? (
                              <text
                                x={x}
                                y={fingerY + 12}
                                textAnchor="middle"
                                fontFamily="var(--font-sans)"
                                fontSize={8}
                                fontWeight={600}
                                className="fill-ink-700"
                              >
                                Q.C.
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                <line
                  x1={systemEndX}
                  y1={tabStringY(rowTop, 1)}
                  x2={systemEndX}
                  y2={tabStringY(rowTop, TAB_LAYOUT.stringCount)}
                  stroke="currentColor"
                  strokeWidth={1.25}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
