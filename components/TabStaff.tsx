import type { TabMeasure } from "@/lib/tab";
import { describeMeasureNotes, groupNotesForRhythm } from "@/lib/tab";
import {
  TAB_LAYOUT,
  tabBeamRowY,
  tabBeamYs,
  tabFretBaselineY,
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
  /** 当前拍位落在哪个音符上（全局序号，按 measures 顺序）；播放时由上层给出 */
  activeNoteIndex?: number | null;
  /** 拍号，默认 4/4。 */
  timeSignature?: readonly [number, number];
  cdStart?: string;
  /** 给读屏与图注用的曲谱名称。 */
  title?: string;
};

const SYSTEM_WIDTH = tabSystemWidth();

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
  activeNoteIndex = null,
  timeSignature = [4, 4],
  cdStart,
  title = "TAB 谱",
}: TabStaffProps) {
  if (measures.length === 0) {
    return <p className="text-meta text-ink-500">这份谱面还没有音符。</p>;
  }

  const systems = chunkMeasures(measures);
  // 每个小节第一个音符在整段里的序号：小节内序号 + 前面的音符总数
  const measureOffsets: number[] = [];
  let noteCount = 0;
  for (const measure of measures) {
    measureOffsets.push(noteCount);
    noteCount += measure.notes.length;
  }
  const height = systems.length * TAB_LAYOUT.systemHeight;
  const [beatsPerBar, beatUnit] = timeSignature;
  const timeSignatureLabel = `${beatsPerBar}/${beatUnit}`;
  const description = measures
    .map((measure, index) => `第 ${index + 1} 小节：${describeMeasureNotes(measure)}`)
    .join("；");

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-500">
        {cdStart ? <span>CD {cdStart}</span> : null}
        <span>♩ = {bpm}</span>
        <span>{timeSignatureLabel} 拍</span>
        <span>{measures.length} 小节</span>
        <span className="sm:hidden">谱面可左右滑动</span>
      </figcaption>
      <div
        className="-mx-1 overflow-x-auto px-1"
        tabIndex={0}
        role="region"
        aria-label={`${title}，可左右滚动`}
      >
        <svg
          viewBox={`0 0 ${SYSTEM_WIDTH} ${height}`}
          width={SYSTEM_WIDTH}
          height={height}
          role="img"
          className="block h-auto w-full min-w-[39.5rem] text-ink-950"
        >
          <title>{`${title}：${measures.length} 小节，速度每分钟 ${bpm} 拍`}</title>
          <desc>{`六线吉他 TAB，${timeSignatureLabel} 拍。${description}`}</desc>

          {systems.map((systemMeasures, systemIndex) => {
            const rowTop = systemIndex * TAB_LAYOUT.systemHeight;
            const systemEndX = TAB_LAYOUT.systemPadX + systemMeasures.length * TAB_LAYOUT.measureWidth;

            return (
              <g key={`system-${systemIndex}`}>
                {systemMeasures.map((measure, measureIndex) => {
                  const measureX = TAB_LAYOUT.systemPadX + measureIndex * TAB_LAYOUT.measureWidth;
                  const count = Math.max(1, measure.notes.length);
                  const rhythmGroups = groupNotesForRhythm(measure.notes);
                  const noteFontSize = tabNoteFontSize(count);
                  const highestStringY = measure.notes.reduce(
                    (top, note) => Math.min(top, tabStringY(rowTop, note.string)),
                    tabStringY(rowTop, TAB_LAYOUT.stringCount),
                  );
                  const beamY = tabBeamRowY(highestStringY);
                  const fingerY = tabStringY(rowTop, TAB_LAYOUT.stringCount) + TAB_LAYOUT.fingerGap;

                  return (
                    <g key={`measure-${measureIndex}`}>
                      {Array.from({ length: TAB_LAYOUT.stringCount }, (_, stringIndex) => {
                        const y = tabStringY(rowTop, stringIndex + 1);
                        return (
                          <line
                            key={`string-${stringIndex}`}
                            x1={measureX}
                            y1={y}
                            x2={measureX + TAB_LAYOUT.measureWidth}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth={1}
                            opacity={0.55}
                          />
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

                      {rhythmGroups.map((group) => {
                        const xs = group.notes.map((_, index) =>
                          tabNoteX(measureX, group.start + index, count),
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
                        const globalNoteIndex =
                          measureOffsets[systemIndex * TAB_LAYOUT.measuresPerSystem + measureIndex] +
                          noteIndex;
                        const highlighted = globalNoteIndex === activeNoteIndex;
                        const x = tabNoteX(measureX, noteIndex, count);
                        const stringY = tabStringY(rowTop, note.string);
                        const fretLabel = String(note.fret);
                        const maskWidth = noteFontSize * 0.62 * fretLabel.length + 3;

                        return (
                          <g key={`note-${noteIndex}`}>
                            {highlighted ? (
                              <rect
                                x={x - noteFontSize * 0.78}
                                y={stringY - noteFontSize * 1.05}
                                width={noteFontSize * 1.56}
                                height={noteFontSize * 1.4}
                                rx={noteFontSize * 0.32}
                                className="fill-accent-100"
                              />
                            ) : null}
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
                              {note.fret}
                            </text>
                            {note.finger ? (
                              <text
                                x={x}
                                y={fingerY}
                                textAnchor="middle"
                                fontFamily="var(--font-sans)"
                                fontSize={10}
                                className="fill-ink-500"
                              >
                                {note.finger}
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
