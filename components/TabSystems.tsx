import { groupNotesForRhythm, type TabMeasure } from "@/lib/tab";
import {
  TAB_LAYOUT,
  tabBeamRowY,
  tabBeamYs,
  tabFretBaselineY,
  tabNoteFontSize,
  tabNoteX,
  tabStemSpan,
  tabStringY,
  tabTripletMark,
} from "@/lib/tab-layout";
import { DURATION_BEATS, measureBeatOrigins } from "@/lib/tab-timing";

export type TabSystemLayout = {
  measures: readonly TabMeasure[];
  measureWidths: readonly number[];
  width: number;
  measureStart: number;
};

const STRING_LABELS = ["E", "B", "G", "D", "A", "E"] as const;

/**
 * TAB 的 SVG 内容。
 *
 * 桌面的四个小节、手机的横向分行都复用这一份绘制逻辑；
 * `measureStart` 只负责把当前高亮音符映射回整段谱面的序号。
 */
export function TabSystems({
  systems,
  measureOffsets,
  activeNoteIndex,
  beatPosition,
  beatsPerBar = 4,
  showPlayhead = true,
}: {
  systems: readonly TabSystemLayout[];
  measureOffsets: readonly number[];
  activeNoteIndex: number | null;
  /** 连续谱面的绝对拍位；用于把激光播放头对齐到当前小节内的时间比例。 */
  beatPosition?: number | null;
  beatsPerBar?: number;
  /** 手机分行时只画当前这一行对应的播放头，避免每行都出现一条。 */
  showPlayhead?: boolean;
}) {
  const allMeasures = systems.flatMap((system) => system.measures);
  const origins = measureBeatOrigins(allMeasures);

  return (
    <>
      {systems.map((system, systemIndex) => {
        const { measures: systemMeasures, measureWidths } = system;
        const rowTop = systemIndex * TAB_LAYOUT.systemHeight;
        const systemEndX =
          TAB_LAYOUT.systemPadX +
          measureWidths.reduce((total, width) => total + width, 0);
        let playheadX: number | null = null;
        if (beatPosition !== null && beatPosition !== undefined && beatPosition >= 0) {
          let measureX = TAB_LAYOUT.systemPadX;
          for (let measureIndex = 0; measureIndex < systemMeasures.length; measureIndex += 1) {
            const measure = systemMeasures[measureIndex];
            const origin = origins[system.measureStart + measureIndex] ?? 0;
            const total = measure.notes.reduce(
              (sum, note) => sum + DURATION_BEATS[note.duration],
              0,
            );
            if (beatPosition >= origin && beatPosition < origin + total) {
              const ratio = Math.min(1, Math.max(0, (beatPosition - origin) / beatsPerBar));
              const usable = measureWidths[measureIndex] - TAB_LAYOUT.measurePadX * 2;
              playheadX = measureX + TAB_LAYOUT.measurePadX + ratio * usable;
            }
            measureX += measureWidths[measureIndex];
          }
        }

        return (
          <g key={`system-${system.measureStart}`}>
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
              const slotXAt = (slot: number) =>
                tabNoteX(measureX, slot, noteGridCount, measureWidth);
              const rhythmGroups = groupNotesForRhythm(measure.notes);
              const maxLabelLength = measure.notes.reduce((max, note) => {
                if (note.rest || note.silent) return max;
                const mainLabelLength = note.tie
                  ? 1
                  : (note.slide ? 1 : 0) + (note.fretLabel ?? String(note.fret)).length;
                const chordLabelLength = (note.chord ?? []).reduce(
                  (chordMax, tone) => Math.max(chordMax, (tone.fretLabel ?? String(tone.fret)).length),
                  1,
                );
                return Math.max(max, mainLabelLength, chordLabelLength);
              }, 1);
              const noteFontSize = tabNoteFontSize(count, maxLabelLength);
              const fingerFontSize = count >= TAB_LAYOUT.denseNoteCount ? 9 : 10;
              const highestStringY = measure.notes.reduce(
                (top, note) =>
                  Math.min(
                    top,
                    ...(note.rest
                      ? []
                      : [
                          tabStringY(rowTop, note.string),
                          ...(note.chord ?? []).map((tone) => tabStringY(rowTop, tone.string)),
                        ]),
                  ),
                tabStringY(rowTop, TAB_LAYOUT.stringCount),
              );
              const beamY = tabBeamRowY(highestStringY);
              const fingerY = tabStringY(rowTop, TAB_LAYOUT.stringCount) + TAB_LAYOUT.fingerGap;
              const pickY = rowTop + TAB_LAYOUT.strokeY;

              return (
                <g key={`measure-${system.measureStart + measureIndex}`}>
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

                  {measure.annotations?.map((annotation, annotationIndex) => {
                    if (annotation.kind === "chord") {
                      return (
                        <text
                          key={`annotation-${annotationIndex}`}
                          x={measureX + TAB_LAYOUT.measurePadX}
                          y={rowTop + 34}
                          fontFamily="var(--font-mono)"
                          fontSize={10}
                          fontWeight={700}
                          className="fill-ink-700"
                        >
                          {annotation.label}
                        </text>
                      );
                    }

                    const startX = slotXAt(annotation.startSlot);
                    const endX = slotXAt(annotation.endSlot);
                    return (
                      <g key={`annotation-${annotationIndex}`}>
                        <text
                          x={startX - 4}
                          y={rowTop + 44}
                          fontFamily="var(--font-mono)"
                          fontSize={9}
                          fontWeight={600}
                          className="fill-ink-700"
                        >
                          P.M.
                        </text>
                        <line
                          x1={startX + 23}
                          y1={rowTop + 40}
                          x2={endX + 4}
                          y2={rowTop + 40}
                          stroke="currentColor"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          className="text-ink-500"
                        />
                        <line
                          x1={endX + 4}
                          y1={rowTop + 37}
                          x2={endX + 4}
                          y2={rowTop + 43}
                          stroke="currentColor"
                          strokeWidth={1}
                          className="text-ink-500"
                        />
                      </g>
                    );
                  })}

                  {measure.picking?.map((pick, pickIndex) => {
                    const pickCount = Math.max(1, measure.picking?.length ?? 0);
                    const pickX = tabNoteX(measureX, pickIndex, pickCount, measureWidth);
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
                    const beamSegments: number[][] = [];
                    let segment: number[] = [];
                    group.notes.forEach((note, index) => {
                      if (note.rest) {
                        if (segment.length > 0) beamSegments.push(segment);
                        segment = [];
                      } else {
                        segment.push(index);
                      }
                    });
                    if (segment.length > 0) beamSegments.push(segment);

                    return (
                      <g key={`rhythm-${group.start}`}>
                        {group.notes.map((note, index) => {
                          if (note.rest || note.duration === "w") return null;
                          const { top, bottom } = tabStemSpan({
                            stringY: tabStringY(rowTop, note.string),
                            fontSize: noteFontSize,
                            openNotehead: note.duration === "h",
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

                        {beamed
                          ? beamSegments.flatMap((notesInSegment, segmentIndex) =>
                              notesInSegment.length > 1
                                ? beamYs.map((y, beamIndex) => (
                                    <line
                                      key={`beam-${segmentIndex}-${beamIndex}`}
                                      x1={xs[notesInSegment[0]]}
                                      y1={y}
                                      x2={xs[notesInSegment[notesInSegment.length - 1]]}
                                      y2={y}
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                      strokeLinecap="round"
                                    />
                                  ))
                                : beamYs.map((y, flagIndex) => (
                                    <path
                                      key={`flag-${segmentIndex}-${flagIndex}`}
                                      d={`M ${xs[notesInSegment[0]]} ${y} q 8 5 6 13`}
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={1.25}
                                    />
                                  )),
                            )
                          : null}

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
                    const globalNoteIndex =
                      measureOffsets[system.measureStart + measureIndex] + noteIndex;
                    const highlighted = globalNoteIndex === activeNoteIndex;
                    if (note.rest) {
                      const y = tabStringY(rowTop, 4);
                      const restHighlight = highlighted ? (
                        <rect
                          x={x - 10}
                          y={y - 9}
                          width={20}
                          height={18}
                          rx={4}
                          className="fill-accent-100"
                        />
                      ) : null;
                      if (note.duration === "w") {
                        return (
                          <g key={`rest-${noteIndex}`}>
                            {restHighlight}
                            <rect
                              x={x - 4}
                              y={y - 2}
                              width={8}
                              height={4}
                              className="fill-ink-700 tab-rest tab-rest-w"
                            />
                          </g>
                        );
                      }
                      if (note.duration === "h") {
                        return (
                          <g key={`rest-${noteIndex}`}>
                            {restHighlight}
                            <rect
                              x={x - 4}
                              y={y - 6}
                              width={8}
                              height={4}
                              className="fill-ink-700 tab-rest tab-rest-h"
                            />
                          </g>
                        );
                      }
                      if (note.duration === "8" || note.duration === "8t") {
                        return (
                          <g key={`rest-${noteIndex}`}>
                            {restHighlight}
                            <path
                              d={`M ${x} ${y - 13} v 10 q 8 2 4 7 q -1 3 -4 4`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`tab-rest tab-rest-${note.duration}`}
                            />
                          </g>
                        );
                      }
                      if (note.duration === "16") {
                        return (
                          <g key={`rest-${noteIndex}`}>
                            {restHighlight}
                            <path
                              d={`M ${x} ${y - 13} v 10 q 8 2 4 7 q -1 3 -4 4 M ${x} ${y - 7} q 8 2 4 7 q -1 3 -4 4`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="tab-rest tab-rest-16"
                            />
                          </g>
                        );
                      }
                      return (
                        <g key={`rest-${noteIndex}`}>
                          {restHighlight}
                          <path
                            d={`M ${x - 3} ${y - 8} l 6 4 -6 4 6 4`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="tab-rest tab-rest-q"
                          />
                        </g>
                      );
                    }
                    const stringY = tabStringY(rowTop, note.string);
                    const fretLabel = note.tie
                      ? "~"
                      : `${note.slide === "up" ? "/" : note.slide === "down" ? "\\" : ""}${
                          note.fretLabel ?? String(note.fret)
                        }`;
                    const previousX =
                      noteIndex > 0
                        ? noteXAt(noteIndex - 1)
                        : x;

                    const tones = [
                      { string: note.string, fret: note.fret, fretLabel: note.fretLabel },
                      ...(note.chord ?? []),
                    ];

                    return (
                      <g key={`note-${noteIndex}`}>
                        {tones.map((tone, toneIndex) => {
                          const toneY = tabStringY(rowTop, tone.string);
                          const toneLabel =
                            toneIndex === 0
                              ? fretLabel
                              : (tone.fretLabel ?? String(tone.fret));
                          const maskWidth = noteFontSize * 0.62 * toneLabel.length + 3;
                          return (
                            <g key={`tone-${toneIndex}`}>
                              {highlighted ? (
                                <rect
                                  x={x - noteFontSize * 0.78}
                                  y={toneY - noteFontSize * 1.05}
                                  width={noteFontSize * 1.56}
                                  height={noteFontSize * 1.4}
                                  rx={noteFontSize * 0.32}
                                  className="fill-accent-100"
                                />
                              ) : null}
                              <rect
                                x={x - maskWidth / 2}
                                y={toneY - noteFontSize * TAB_LAYOUT.fretGlyphTop}
                                width={maskWidth}
                                height={noteFontSize}
                                className="fill-surface"
                              />
                              {note.duration === "h" || note.duration === "w" ? (
                                <ellipse
                                  cx={x}
                                  cy={toneY}
                                  rx={noteFontSize * 0.82}
                                  ry={noteFontSize * 0.55}
                                  fill="var(--color-surface)"
                                  stroke="currentColor"
                                  strokeWidth={1}
                                  className={
                                    note.duration === "w"
                                      ? "tab-whole-notehead"
                                      : "tab-half-notehead"
                                  }
                                />
                              ) : null}
                              <text
                                x={x}
                                y={tabFretBaselineY(toneY)}
                                textAnchor="middle"
                                fontFamily="var(--font-mono)"
                                fontSize={noteFontSize}
                                fontWeight={600}
                                fill="currentColor"
                              >
                                {toneLabel}
                              </text>
                            </g>
                          );
                        })}
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
                        {note.articulation ? (
                          <text
                            x={x}
                            y={fingerY}
                            textAnchor="middle"
                            fontFamily="var(--font-sans)"
                            fontSize={fingerFontSize}
                            className="fill-ink-500"
                          >
                            {note.articulation === "open" ? "开" : "闷"}
                          </text>
                        ) : null}
                        {note.vibrato ? (
                          <path
                            d={`M ${x - 8} ${stringY + 11} q 2 -4 4 0 t 4 0 t 4 0 t 4 0`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1}
                            className="tab-vibrato"
                          />
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
            {showPlayhead && playheadX !== null ? (
              <g className="tab-playhead" aria-hidden="true">
                <rect
                  x={playheadX - 7}
                  y={TAB_LAYOUT.staffTop - 18}
                  width={14}
                  height={TAB_LAYOUT.systemHeight - 36}
                  fill="var(--color-accent-glow)"
                  opacity={0.5}
                  rx={7}
                />
                <line
                  x1={playheadX}
                  y1={TAB_LAYOUT.staffTop - 18}
                  x2={playheadX}
                  y2={TAB_LAYOUT.staffTop - 18 + TAB_LAYOUT.systemHeight - 36}
                  stroke="var(--color-accent-700)"
                  strokeWidth={2}
                  className="tab-playhead-line"
                />
                <circle cx={playheadX} cy={TAB_LAYOUT.staffTop - 18} r={3.5} fill="var(--color-accent-700)" />
              </g>
            ) : null}
          </g>
        );
      })}
    </>
  );
}
