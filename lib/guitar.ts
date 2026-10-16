/**
 * C 大调「一弦三音」（3 notes per string）系统的音位推导。
 *
 * 所有品格数字都从「标准调弦 + C 大调音阶」算出来，不手写常量，
 * 避免出现「错一个音就练错」的问题。
 */

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export type GuitarString = {
  /** 弦号：1 = 最细的高音弦，6 = 最粗的低音弦 */
  number: number;
  /** 空弦音名 */
  openName: NoteName;
  /** 空弦绝对音高，C4 = 60 */
  openMidi: number;
};

/** 标准调弦 EADGBE。下标 0 = 6 弦（低音 E），5 = 1 弦（高音 E） */
export const STANDARD_TUNING: GuitarString[] = [
  { number: 6, openName: "E", openMidi: 40 }, // E2
  { number: 5, openName: "A", openMidi: 45 }, // A2
  { number: 4, openName: "D", openMidi: 50 }, // D3
  { number: 3, openName: "G", openMidi: 55 }, // G3
  { number: 2, openName: "B", openMidi: 59 }, // B3
  { number: 1, openName: "E", openMidi: 64 }, // E4
];

/** C 大调音阶七个音级相对 C 的半音数 */
export const C_MAJOR_SEMITONES: number[] = [0, 2, 4, 5, 7, 9, 11];

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function noteName(midi: number): NoteName {
  return NOTE_NAMES[pitchClass(midi)];
}

/** 音级 1–7；不属于 C 大调时返回 null */
export function scaleDegree(midi: number): number | null {
  const index = C_MAJOR_SEMITONES.indexOf(pitchClass(midi));
  return index === -1 ? null : index + 1;
}

/** 带八度的音名，如 C3、E4（C4 = 中央八度记法） */
export function noteWithOctave(midi: number): string {
  return `${noteName(midi)}${Math.floor(midi / 12) - 1}`;
}

export type Mode = {
  /** 把位编号 1–7，同时等于起始音级 */
  degree: number;
  /** 起始音级对应的调式 */
  mode: string;
  modeZh: string;
  /** 相对大调／小调的色彩说明 */
  character: string;
};

export const MODES: Mode[] = [
  { degree: 1, mode: "Ionian", modeZh: "伊奥尼亚", character: "大调本体，最稳定" },
  { degree: 2, mode: "Dorian", modeZh: "多利亚", character: "小调 + 升 6 音" },
  { degree: 3, mode: "Phrygian", modeZh: "弗里吉亚", character: "小调 + 降 2 音，西班牙色彩" },
  { degree: 4, mode: "Lydian", modeZh: "利底亚", character: "大调 + 升 4 音，飘浮感" },
  { degree: 5, mode: "Mixolydian", modeZh: "混合利底亚", character: "大调 + 降 7 音，摇滚味" },
  { degree: 6, mode: "Aeolian", modeZh: "爱奥利亚", character: "自然小调，忧郁" },
  { degree: 7, mode: "Locrian", modeZh: "洛克里亚", character: "小调 + 降 2 + 降 5 音，最不稳定" },
];

/** 每个把位固定 6 弦 × 3 音 */
const STRINGS_PER_PATTERN = 6;
const NOTES_PER_STRING = 3;
const NOTES_PER_PATTERN = STRINGS_PER_PATTERN * NOTES_PER_STRING;

/** 把位起始音允许高到的最高品位，超过就整体降一个八度 */
const MAX_START_FRET = 12;

export type PatternNote = {
  /** 0 = 6 弦（最低音弦），5 = 1 弦 */
  stringIndex: number;
  stringNumber: number;
  fret: number;
  midi: number;
  name: NoteName;
  /** 该音在 C 大调里的音级 1–7 */
  degree: number;
};

export type Pattern = Mode & {
  /** 下标 0 = 6 弦，每组三个音，由低到高 */
  notes: PatternNote[][];
  minFret: number;
  maxFret: number;
  lowNote: string;
  highNote: string;
};

/** 从 startMidi 开始，向上连续取 count 个 C 大调内音 */
function scaleRun(startMidi: number, count: number): number[] {
  const run: number[] = [];
  let midi = startMidi;
  while (run.length < count) {
    if (scaleDegree(midi) !== null) run.push(midi);
    midi += 1;
  }
  return run;
}

/**
 * 6 弦上该音级的起音品位。
 * 取不超过 MAX_START_FRET 的**最高**一个八度，避免像 E 这种音级因为 6 弦空弦
 * 本身就是 E 而落到 0 品，把整个把位塌到低把位去。
 */
function patternStartMidi(degree: number): number {
  const target = C_MAJOR_SEMITONES[degree - 1];
  const openMidi = STANDARD_TUNING[0].openMidi;
  let midi = openMidi;
  while (pitchClass(midi) !== target) midi += 1;
  while (midi - openMidi + 12 <= MAX_START_FRET) midi += 12;
  return midi;
}

export function buildPattern(degree: number): Pattern {
  const meta = MODES.find((item) => item.degree === degree);
  if (!meta) throw new Error(`未知音级：${degree}`);

  const run = scaleRun(patternStartMidi(degree), NOTES_PER_PATTERN);

  const notes: PatternNote[][] = [];
  for (let stringIndex = 0; stringIndex < STRINGS_PER_PATTERN; stringIndex += 1) {
    const group = run
      .slice(stringIndex * NOTES_PER_STRING, (stringIndex + 1) * NOTES_PER_STRING)
      .map((midi) => ({
        stringIndex,
        stringNumber: STANDARD_TUNING[stringIndex].number,
        fret: midi - STANDARD_TUNING[stringIndex].openMidi,
        midi,
        name: noteName(midi),
        degree: scaleDegree(midi) as number,
      }));
    notes.push(group);
  }

  const frets = notes.flat().map((note) => note.fret);

  return {
    ...meta,
    notes,
    minFret: Math.min(...frets),
    maxFret: Math.max(...frets),
    lowNote: noteWithOctave(run[0]),
    highNote: noteWithOctave(run.at(-1) as number),
  };
}

/** 七个把位，按起始音级 C→B（Ionian→Locrian）排列 */
export const PATTERNS: Pattern[] = MODES.map((item) => buildPattern(item.degree));

/** 覆盖全部七个把位所需的最多品数 */
export const FRET_COUNT = Math.max(
  ...PATTERNS.flatMap((pattern) => pattern.notes.flat().map((note) => note.fret)),
);

export type NeckNote = {
  key: string;
  stringIndex: number;
  stringNumber: number;
  fret: number;
  midi: number;
  pitchClass: number;
  name: NoteName;
  degree: number;
  isRoot: boolean;
};

/** 指板上第 1 品到 fretCount 品之间，所有属于 C 大调的音 */
export function buildNeckNotes(fretCount: number): NeckNote[] {
  const result: NeckNote[] = [];
  for (let stringIndex = 0; stringIndex < STANDARD_TUNING.length; stringIndex += 1) {
    for (let fret = 1; fret <= fretCount; fret += 1) {
      const midi = STANDARD_TUNING[stringIndex].openMidi + fret;
      const degree = scaleDegree(midi);
      if (degree === null) continue;
      result.push({
        key: `${stringIndex}-${fret}`,
        stringIndex,
        stringNumber: STANDARD_TUNING[stringIndex].number,
        fret,
        midi,
        pitchClass: pitchClass(midi),
        name: noteName(midi),
        degree,
        isRoot: degree === 1,
      });
    }
  }
  return result;
}

/** 把位的音位集合，用于在整条指板上做高亮／变暗 */
export function patternKeys(pattern: Pattern): Set<string> {
  return new Set(
    pattern.notes.flat().map((note) => `${note.stringIndex}-${note.fret}`),
  );
}
