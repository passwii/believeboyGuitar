import type { TabMeasure } from "@/lib/tab";
import { describeMeasureNotes, groupNotesForRhythm } from "@/lib/tab";

export type TabStaffProps = {
  measures: readonly TabMeasure[];
  bpm: number;
  /** 拍号，默认 4/4。 */
  timeSignature?: readonly [number, number];
  cdStart?: string;
  /** 给读屏与图注用的曲谱名称。 */
  title?: string;
};

const MEASURES_PER_SYSTEM = 4;
const MEASURE_WIDTH = 150;
const SYSTEM_PAD_X = 16;
const MEASURE_PAD_X = 11;
const STAFF_TOP = 44;
const STRING_GAP = 18;
const STRING_COUNT = 6;
const RHYTHM_TOP = 20;
const SYSTEM_HEIGHT = 170;

const SYSTEM_WIDTH = SYSTEM_PAD_X * 2 + MEASURE_WIDTH * MEASURES_PER_SYSTEM;

function stringY(rowTop: number, string: number): number {
  return rowTop + STAFF_TOP + (string - 1) * STRING_GAP;
}

function noteX(measureX: number, index: number, count: number): number {
  const usable = MEASURE_WIDTH - MEASURE_PAD_X * 2;
  return measureX + MEASURE_PAD_X + ((index + 0.5) * usable) / count;
}

function chunkMeasures(measures: readonly TabMeasure[]): TabMeasure[][] {
  const systems: TabMeasure[][] = [];
  for (let index = 0; index < measures.length; index += MEASURES_PER_SYSTEM) {
    systems.push(measures.slice(index, index + MEASURES_PER_SYSTEM));
  }
  return systems;
}

export function TabStaff({
  measures,
  bpm,
  timeSignature = [4, 4],
  cdStart,
  title = "TAB 谱",
}: TabStaffProps) {
  if (measures.length === 0) {
    return <p className="text-meta text-ink-500">这份谱面还没有音符。</p>;
  }

  const systems = chunkMeasures(measures);
  const height = systems.length * SYSTEM_HEIGHT;
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
            const rowTop = systemIndex * SYSTEM_HEIGHT;
            const systemEndX = SYSTEM_PAD_X + systemMeasures.length * MEASURE_WIDTH;

            return (
              <g key={`system-${systemIndex}`}>
                {systemMeasures.map((measure, measureIndex) => {
                  const measureX = SYSTEM_PAD_X + measureIndex * MEASURE_WIDTH;
                  const count = Math.max(1, measure.notes.length);
                  const rhythmGroups = groupNotesForRhythm(measure.notes);
                  const noteFontSize = count >= 12 ? 11 : 15;
                  const fingerY = stringY(rowTop, STRING_COUNT) + 18;

                  return (
                    <g key={`measure-${measureIndex}`}>
                      {Array.from({ length: STRING_COUNT }, (_, stringIndex) => {
                        const y = stringY(rowTop, stringIndex + 1);
                        return (
                          <line
                            key={`string-${stringIndex}`}
                            x1={measureX}
                            y1={y}
                            x2={measureX + MEASURE_WIDTH}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth={1}
                            opacity={0.55}
                          />
                        );
                      })}

                      <line
                        x1={measureX}
                        y1={stringY(rowTop, 1)}
                        x2={measureX}
                        y2={stringY(rowTop, STRING_COUNT)}
                        stroke="currentColor"
                        strokeWidth={1.25}
                      />

                      {rhythmGroups.map((group) => {
                        const xs = group.notes.map((_, index) =>
                          noteX(measureX, group.start + index, count),
                        );
                        const beamY = rowTop + RHYTHM_TOP;
                        const startX = xs[0];
                        const endX = xs[xs.length - 1];
                        const stemBottom = beamY + 13;

                        return (
                          <g key={`rhythm-${group.start}`}>
                            {xs.map((x, index) => (
                              <line
                                key={`stem-${group.start + index}`}
                                x1={x}
                                y1={beamY}
                                x2={x}
                                y2={stemBottom}
                                stroke="currentColor"
                                strokeWidth={1.25}
                              />
                            ))}

                            {group.beams > 0 && group.notes.length > 1 ? (
                              Array.from({ length: group.beams }, (_, beamIndex) => (
                                <line
                                  key={`beam-${beamIndex}`}
                                  x1={startX}
                                  y1={beamY + beamIndex * 4}
                                  x2={endX}
                                  y2={beamY + beamIndex * 4}
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                  strokeLinecap="round"
                                />
                              ))
                            ) : null}

                            {group.beams > 0 && group.notes.length === 1 ? (
                              <path
                                d={`M ${startX} ${beamY + 2} q 7 4 5 11`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.25}
                              />
                            ) : null}

                            {group.triplet ? (
                              <g>
                                <path
                                  d={`M ${startX} ${beamY - 5} v -4 H ${endX} v 4`}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={1}
                                />
                                <rect
                                  x={(startX + endX) / 2 - 6}
                                  y={beamY - 17}
                                  width={12}
                                  height={12}
                                  className="fill-canvas"
                                />
                                <text
                                  x={(startX + endX) / 2}
                                  y={beamY - 7}
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
                        const x = noteX(measureX, noteIndex, count);
                        const y = stringY(rowTop, note.string);

                        const fretLabel = String(note.fret);
                        const maskWidth = noteFontSize * 0.62 * fretLabel.length + 3;

                        return (
                          <g key={`note-${noteIndex}`}>
                            <rect
                              x={x - maskWidth / 2}
                              y={y - noteFontSize * 0.78}
                              width={maskWidth}
                              height={noteFontSize}
                              className="fill-surface"
                            />
                            <text
                              x={x}
                              y={y + 5}
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
                  y1={stringY(rowTop, 1)}
                  x2={systemEndX}
                  y2={stringY(rowTop, STRING_COUNT)}
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
