import type { TabNote } from "@/lib/tab-exercises";

export type TabStaffProps = {
  notes: readonly TabNote[];
  bpm: number;
  /** 每小节包含的音符数。 */
  beatsPerMeasure: number;
  cdStart?: string;
};

type NoteGroup = {
  start: number;
  notes: readonly TabNote[];
  triplet: boolean;
};

const NOTE_SPACING = 44;
const PAD_LEFT = 22;
const PAD_RIGHT = 18;
const STAFF_TOP = 42;
const STRING_GAP = 27;
const SYSTEM_HEIGHT = 210;
const BEAM_RISE = 25;

function chunkNotes(notes: readonly TabNote[], size: number): TabNote[][] {
  const chunks: TabNote[][] = [];
  for (let index = 0; index < notes.length; index += size) {
    chunks.push(notes.slice(index, index + size));
  }
  return chunks;
}

function groupNotes(notes: readonly TabNote[]): NoteGroup[] {
  const groups: NoteGroup[] = [];
  let start = 0;

  while (start < notes.length) {
    const duration = notes[start].duration;
    const groupSize = duration === "8t" ? 3 : 2;
    let runEnd = start + 1;
    while (runEnd < notes.length && notes[runEnd].duration === duration) runEnd += 1;

    for (let index = start; index < runEnd; index += groupSize) {
      const groupNotes = notes.slice(index, Math.min(index + groupSize, runEnd));
      groups.push({ start: index, notes: groupNotes, triplet: duration === "8t" });
    }
    start = runEnd;
  }

  return groups;
}

function stringY(string: number, rowTop: number): number {
  return rowTop + STAFF_TOP + (string - 1) * STRING_GAP;
}

function noteX(index: number): number {
  return PAD_LEFT + NOTE_SPACING / 2 + index * NOTE_SPACING;
}

export function TabStaff({ notes, bpm, beatsPerMeasure, cdStart }: TabStaffProps) {
  const safeMeasureSize = Math.max(1, Math.floor(beatsPerMeasure));
  const measures = chunkNotes(notes, safeMeasureSize);
  const slotsPerMeasure = safeMeasureSize;
  const width = PAD_LEFT + slotsPerMeasure * NOTE_SPACING + PAD_RIGHT;
  const height = Math.max(1, measures.length) * SYSTEM_HEIGHT;
  const ariaLabel = `六线吉他 TAB，速度每分钟 ${bpm} 拍，每小节 ${safeMeasureSize} 个音符，共 ${notes.length} 个音符、${measures.length} 小节${cdStart ? `，CD ${cdStart}` : ""}`;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-500">
        {cdStart ? <span>CD {cdStart}</span> : null}
        <span>♩ = {bpm}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={ariaLabel}
        className="block h-auto w-full text-ink-950"
      >
        {measures.map((measure, measureIndex) => {
          const rowTop = measureIndex * SYSTEM_HEIGHT;
          const groups = groupNotes(measure);
          const measureEndX = PAD_LEFT + slotsPerMeasure * NOTE_SPACING;

          return (
            <g key={`measure-${measureIndex}`}>
              {Array.from({ length: 6 }, (_, stringIndex) => {
                const y = stringY(stringIndex + 1, rowTop);
                return (
                  <line
                    key={`string-${stringIndex}`}
                    x1={PAD_LEFT}
                    y1={y}
                    x2={measureEndX}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth={1.25}
                    opacity={0.65}
                  />
                );
              })}

              <line
                x1={PAD_LEFT}
                y1={rowTop + STAFF_TOP}
                x2={PAD_LEFT}
                y2={rowTop + STAFF_TOP + STRING_GAP * 5}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <line
                x1={measureEndX}
                y1={rowTop + STAFF_TOP}
                x2={measureEndX}
                y2={rowTop + STAFF_TOP + STRING_GAP * 5}
                stroke="currentColor"
                strokeWidth={1.5}
              />

              {groups.map((group, groupIndex) => {
                const groupNotes = group.notes;
                const xs = groupNotes.map((_, index) => noteX(group.start + index));
                const ys = groupNotes.map((note) => stringY(note.string, rowTop));
                const beamY = Math.min(...ys) - BEAM_RISE;
                const hasBeam = groupNotes.length > 1;
                const startX = xs[0];
                const endX = xs[xs.length - 1];
                const tripletLabelY = beamY - 8;

                return (
                  <g key={`group-${groupIndex}`}>
                    {groupNotes.map((note, noteIndex) => {
                      const x = xs[noteIndex];
                      const y = ys[noteIndex];
                      return (
                        <g key={`note-${group.start + noteIndex}`}>
                          <line
                            x1={x + 5}
                            y1={y - 2}
                            x2={x + 5}
                            y2={hasBeam ? beamY : y - BEAM_RISE}
                            stroke="currentColor"
                            strokeWidth={1.5}
                          />
                          <text
                            x={x}
                            y={y + 6}
                            textAnchor="middle"
                            fontFamily="var(--font-mono)"
                            fontSize={14}
                            fontWeight={600}
                            fill="currentColor"
                          >
                            {note.fret}
                          </text>
                          <text
                            x={x}
                            y={y + 20}
                            textAnchor="middle"
                            fontFamily="var(--font-sans)"
                            fontSize={10}
                            fill="currentColor"
                          >
                            {note.finger}
                          </text>
                          {!hasBeam ? (
                            <path
                              d={`M ${x + 5} ${y - BEAM_RISE} q 10 5 7 13`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            />
                          ) : null}
                        </g>
                      );
                    })}

                    {hasBeam ? (
                      <line
                        x1={startX + 5}
                        y1={beamY}
                        x2={endX + 5}
                        y2={beamY}
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    ) : null}

                    {group.triplet ? (
                      <g>
                        <path
                          d={`M ${startX + 5} ${tripletLabelY + 3} v 4 M ${endX + 5} ${tripletLabelY + 3} v 4 M ${startX + 8} ${tripletLabelY + 3} H ${endX + 2}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1}
                        />
                        <rect
                          x={(startX + endX) / 2 - 7}
                          y={tripletLabelY - 6}
                          width={14}
                          height={13}
                          className="fill-canvas"
                        />
                        <text
                          x={(startX + endX) / 2}
                          y={tripletLabelY + 4}
                          textAnchor="middle"
                          fontFamily="var(--font-mono)"
                          fontSize={11}
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
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
