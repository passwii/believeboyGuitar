import type { TabDuration, TabMeasure, TabNote, TabString } from "@/lib/tab";
import type { TabSection } from "@/lib/tab-practice";

type NoteOptions = Pick<TabNote, "articulation" | "fretLabel" | "slide" | "tie" | "vibrato">;

function note(
  string: TabString,
  fret: number,
  duration: TabDuration,
  options: NoteOptions = {},
): TabNote {
  return { string, fret, duration, ...options };
}

function powerChord(
  rootString: TabString,
  rootFret: number,
  fifthString: TabString,
  fifthFret: number,
  duration: TabDuration,
  articulation?: NoteOptions["articulation"],
): TabNote {
  return {
    string: rootString,
    fret: rootFret,
    duration,
    chord: [{ string: fifthString, fret: fifthFret }],
    articulation,
  };
}

function powerChordMeasure(
  label: string,
  rootString: TabString,
  rootFret: number,
  fifthString: TabString,
  fifthFret: number,
  articulations?: readonly (NoteOptions["articulation"] | undefined)[],
): TabMeasure {
  const durations: readonly TabDuration[] = ["q", "8", "8", "8", "8", "8", "8"];
  return {
    notes: durations.map((duration, index) =>
      powerChord(
        rootString,
        rootFret,
        fifthString,
        fifthFret,
        duration,
        articulations?.[index],
      ),
    ),
    annotations: [
      { kind: "chord", label },
      { kind: "palm-mute", startSlot: 1, endSlot: 6 },
    ],
  };
}

function riffMeasure(
  notes: readonly { string: TabString; fret: number }[],
  options: {
    chord?: string;
    palmMute?: boolean;
    articulations?: readonly (NoteOptions["articulation"] | undefined)[];
  } = {},
): TabMeasure {
  const measures: TabMeasure = {
    notes: notes.map(({ string, fret }, index) =>
      note(string, fret, "8", { articulation: options.articulations?.[index] }),
    ),
  };
  const annotations = [
    ...(options.chord ? [{ kind: "chord" as const, label: options.chord }] : []),
    ...(options.palmMute ? [{ kind: "palm-mute" as const, startSlot: 0, endSlot: 7 }] : []),
  ];
  return annotations.length > 0 ? { ...measures, annotations } : measures;
}

const openMutedPattern = ["open", "muted", "open", "muted", "muted", "open", "muted"] as const;
const m10Articulations = ["open", "muted", "muted", "open", "muted", "muted", "open", "muted"] as const;

export const ROCK_RHYTHM_SECTIONS: readonly TabSection[] = [
  {
    id: "rock-rhythm-pattern",
    title: "完整曲谱",
    bpm: 160,
    rhythm: "4/4 · 八分摇滚节奏 · 强力和弦",
    focus: "掌根制音与开放音交替；按和弦标记切换低把位强力和弦。",
    tip: "先在较慢速度弹稳右手开/闷音，再逐步提到 ♩=160。截图中的弦位和第 11 小节技巧请按原谱核对。",
    labels: ["1=F", "D5 → Bb5 → F5 → C5"],
    measures: [
      {
        notes: [{ string: 6, fret: 0, duration: "w", rest: true }],
      },
      powerChordMeasure("D5", 5, 5, 4, 7, openMutedPattern),
      riffMeasure(
        [
          { string: 5, fret: 5 },
          { string: 5, fret: 8 },
          { string: 5, fret: 7 },
          { string: 5, fret: 5 },
          { string: 5, fret: 8 },
          { string: 5, fret: 7 },
          { string: 5, fret: 5 },
          { string: 5, fret: 3 },
        ],
      ),
      powerChordMeasure("Bb5", 5, 1, 4, 3),
      riffMeasure(
        [
          { string: 5, fret: 5 },
          { string: 5, fret: 8 },
          { string: 5, fret: 7 },
          { string: 5, fret: 5 },
          { string: 5, fret: 8 },
          { string: 5, fret: 7 },
          { string: 5, fret: 5 },
          { string: 5, fret: 3 },
        ],
      ),
      powerChordMeasure("F5", 5, 8, 4, 10),
      riffMeasure([
        { string: 5, fret: 8 },
        { string: 4, fret: 7 },
        { string: 5, fret: 10 },
        { string: 5, fret: 8 },
        { string: 4, fret: 7 },
        { string: 5, fret: 10 },
        { string: 5, fret: 8 },
        { string: 4, fret: 7 },
      ]),
      powerChordMeasure("C5", 6, 8, 5, 10),
      riffMeasure(
        [
          { string: 6, fret: 8 },
          { string: 5, fret: 7 },
          { string: 6, fret: 10 },
          { string: 6, fret: 8 },
          { string: 5, fret: 7 },
          { string: 6, fret: 10 },
          { string: 6, fret: 8 },
          { string: 5, fret: 7 },
        ],
        { palmMute: true },
      ),
      riffMeasure(
        [
          { string: 3, fret: 7 },
          { string: 4, fret: 7 },
          { string: 4, fret: 7 },
          { string: 3, fret: 9 },
          { string: 4, fret: 7 },
          { string: 4, fret: 7 },
          { string: 3, fret: 10 },
          { string: 4, fret: 7 },
        ],
        { palmMute: true, articulations: m10Articulations },
      ),
      {
        notes: [
          note(2, 14, "q", { slide: "up" }),
          note(2, 0, "8", { fretLabel: "X" }),
          note(3, 10, "8"),
          note(3, 10, "h", { tie: true, vibrato: true }),
        ],
      },
      riffMeasure(
        [
          { string: 3, fret: 7 },
          { string: 4, fret: 8 },
          { string: 4, fret: 8 },
          { string: 3, fret: 9 },
          { string: 4, fret: 8 },
          { string: 4, fret: 8 },
          { string: 3, fret: 10 },
          { string: 4, fret: 8 },
        ],
        { palmMute: true },
      ),
    ],
  },
];
