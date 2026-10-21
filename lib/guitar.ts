/**
 * 电吉他音位推导。
 *
 * 所有品格数字都从「标准调弦 + 目标音阶／和弦」算出来，不手抄常量，
 * 避免出现「错一个音就练错」的问题。
 *
 * 分工：
 * · 形状的几何（开放和弦的品位偏移、推弦的半音数）是「定义」，写成常量；
 * · 形状落在指板的哪里（把位、品域、音位），全部由调弦与音高算出来。
 *
 * 引用处：components/ThreeNotesPerString.tsx、components/CagedSystem.tsx、
 * components/TwelveBarBlues.tsx、components/BendPitchMeter.tsx，
 * 以及 tests/guitar-derivations.test.ts。
 */

const NOTE_NAMES = [
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

type NoteName = (typeof NOTE_NAMES)[number];

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

/**
 * 音阶定义。
 *
 * semitones 是相对主音的半音数；names 是每个音级的读法。
 * 布鲁斯一类音阶用降号拼写，因为吉他手读的是 Eb、Gb、Bb 而不是 D#、F#、A#。
 */
export type Scale = {
  id: string;
  label: string;
  semitones: number[];
  names: string[];
};

const SCALES: Record<string, Scale> = {
  major: {
    id: "major",
    label: "大调",
    semitones: [0, 2, 4, 5, 7, 9, 11],
    names: ["C", "D", "E", "F", "G", "A", "B"],
  },
  blues: {
    id: "blues",
    label: "布鲁斯音阶",
    semitones: [0, 3, 5, 6, 7, 10],
    names: ["C", "Eb", "F", "Gb", "G", "Bb"],
  },
  minorPentatonic: {
    id: "minorPentatonic",
    label: "小调五声音阶",
    semitones: [0, 3, 5, 7, 10],
    names: ["C", "Eb", "F", "G", "Bb"],
  },
  majorPentatonic: {
    id: "majorPentatonic",
    label: "大调五声音阶",
    semitones: [0, 2, 4, 7, 9],
    names: ["C", "D", "E", "G", "A"],
  },
};

export type ScaleId = keyof typeof SCALES;

export function getScale(scaleId: ScaleId): Scale {
  return SCALES[scaleId];
}

/** 吉他手读降号：降号比升号常见 */
const FLAT_SPELLING = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/** 升号拼写：大调等调内音习惯用 F#、C# */
const SHARP_SPELLING = [
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

/** 拼写习惯：同一个音高在两种调里读法不同 */
export type Spelling = "sharp" | "flat";

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

function noteName(midi: number): NoteName {
  return NOTE_NAMES[pitchClass(midi)];
}

/** 按指定拼写习惯读音名 */
export function spellNote(midi: number, spelling: Spelling = "flat"): string {
  return spelling === "flat" ? FLAT_SPELLING[pitchClass(midi)] : SHARP_SPELLING[pitchClass(midi)];
}

/** 带八度的音名，如 C3、E4（C4 = 中央八度记法） */
function noteWithOctave(midi: number): string {
  return `${noteName(midi)}${Math.floor(midi / 12) - 1}`;
}

type Mode = {
  /** 把位编号 1–7，同时等于起始音级 */
  degree: number;
  /** 起始音级对应的调式 */
  mode: string;
  modeZh: string;
  /** 相对大调／小调的色彩说明 */
  character: string;
};

const MODES: Mode[] = [
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

/** C 大调音阶七个音级相对 C 的半音数 */
const C_MAJOR_SEMITONES: number[] = SCALES.major.semitones;

/** 该音级在 C 大调里的级数；不属于 C 大调时返回 null */
function scaleDegree(midi: number): number | null {
  const index = C_MAJOR_SEMITONES.indexOf(pitchClass(midi));
  return index === -1 ? null : index + 1;
}

type PatternNote = {
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
 * 取「不低于 6 弦空弦」的最低一个音级：E 的最低位就是 6 弦空弦本身（0 品），
 * 而 C 的最低位是 6 弦 8 品。这样七个把位的品域才能真正错开、覆盖整条指板。
 */
function patternStartMidi(degree: number): number {
  const target = C_MAJOR_SEMITONES[degree - 1];
  const openMidi = STANDARD_TUNING[0].openMidi;
  let midi = openMidi;
  while (pitchClass(midi) !== target) midi += 1;
  return midi;
}

function buildPattern(degree: number): Pattern {
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

export type ScaleNeckNote = {
  key: string;
  stringIndex: number;
  stringNumber: number;
  fret: number;
  midi: number;
  pitchClass: number;
  /** 音名，按音阶的读法拼写（布鲁斯用降号） */
  name: string;
  /** 在音阶中的序号，从 1 开始 */
  degree: number;
  isRoot: boolean;
};

/** 指板上第 1 品到 fretCount 品之间，所有属于 C 大调的音 */
export function buildNeckNotes(fretCount: number): ScaleNeckNote[] {
  return buildScaleNeckNotes(fretCount, "major");
}

/** 指板上第 1 品到 fretCount 品之间，所有属于该音阶的音 */
export function buildScaleNeckNotes(fretCount: number, scaleId: ScaleId): ScaleNeckNote[] {
  const scale = getScale(scaleId);
  const result: ScaleNeckNote[] = [];

  for (let stringIndex = 0; stringIndex < STANDARD_TUNING.length; stringIndex += 1) {
    for (let fret = 1; fret <= fretCount; fret += 1) {
      const midi = STANDARD_TUNING[stringIndex].openMidi + fret;
      const pc = pitchClass(midi);
      const index = scale.semitones.indexOf(pc);
      if (index === -1) continue;
      result.push({
        key: `${stringIndex}-${fret}`,
        stringIndex,
        stringNumber: STANDARD_TUNING[stringIndex].number,
        fret,
        midi,
        pitchClass: pc,
        name: scale.names[index],
        degree: index + 1,
        isRoot: index === 0,
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

/* ==========================================================================
   CAGED：五个开放和弦形状连接整条指板
   ========================================================================== */

/**
 * 开放和弦形状的定义。
 *
 * 这里写的是「形状的几何」：每根弦相对根音的品位偏移，以及哪根弦不弹。
 * 形状落在指板的哪个位置不是常量——它由根音的实际音高算出来。
 */
type OpenChordShape = {
  /** 形状名（开放和弦名）：C / A / G / E / D */
  name: string;
  /** 根音所在弦的下标：0 = 6 弦，5 = 1 弦 */
  rootStringIndex: number;
  /** 根音在开放位置的品位 */
  rootFret: number;
  /** 每根弦相对根音的品位偏移；null = 该弦不弹 */
  offsets: (number | null)[];
  /** 这个形状的由来，一句话 */
  origin: string;
};

const CAGED_SHAPES: OpenChordShape[] = [
  {
    name: "C",
    rootStringIndex: 1,
    rootFret: 3,
    offsets: [null, 0, -1, -3, -2, -3],
    origin: "开放 C 和弦，根音在 5 弦 3 品",
  },
  {
    name: "A",
    rootStringIndex: 1,
    rootFret: 0,
    offsets: [null, 0, 2, 2, 2, 0],
    origin: "开放 A 和弦，根音在 5 弦空弦",
  },
  {
    name: "G",
    rootStringIndex: 0,
    rootFret: 3,
    offsets: [0, -1, -3, -3, -3, 0],
    origin: "开放 G 和弦，根音在 6 弦 3 品",
  },
  {
    name: "E",
    rootStringIndex: 0,
    rootFret: 0,
    offsets: [0, 2, 2, 1, 0, 0],
    origin: "开放 E 和弦，根音在 6 弦空弦",
  },
  {
    name: "D",
    rootStringIndex: 2,
    rootFret: 0,
    offsets: [null, null, 0, 2, 3, 2],
    origin: "开放 D 和弦，根音在 4 弦空弦",
  },
];

export type CagedShape = {
  /** 形状名 */
  name: string;
  /** 形状的基准品位：根音所在的品位 */
  baseFret: number;
  origin: string;
  /** 形状里每个音：弦号、品位、音名、是否根音 */
  notes: {
    stringIndex: number;
    stringNumber: number;
    fret: number;
    midi: number;
    name: string;
    isRoot: boolean;
  }[];
  /** 形状覆盖的品域 */
  minFret: number;
  maxFret: number;
  /** 最低音（根音）的音名与八度 */
  rootNote: string;
  /** 根音所在弦 */
  rootStringNumber: number;
};

/** 目标调的根音：这里用 C */
const CAGED_ROOT_PITCH_CLASS = 0;

/**
 * 6 弦上不高于空弦的最低一个 C（C3 = 48）。
 * 它是整条 CAGED 循环的锚点：五个形状的根音都落在这个 C 的同名音上。
 */
function cagedAnchorMidi(): number {
  const openMidi = STANDARD_TUNING[0].openMidi;
  let midi = openMidi;
  while (pitchClass(midi) !== CAGED_ROOT_PITCH_CLASS) midi += 1;
  return midi;
}

/**
 * 算出一个形状在当前调下的位置。
 *
 * 基准品位 = 锚点音高 −（根音弦空弦音高 + 根音在开放位置的品位）。
 * 结果为负说明这个形状的根音落到锚点以下（4 弦的 D 形状就是这样），
 * 往上补一个八度即可——这也正是 D 形状在 CAGED 循环里落在高八度的原因。
 */
function cagedBaseFret(shape: OpenChordShape): number {
  const anchor = cagedAnchorMidi();
  const rootString = STANDARD_TUNING[shape.rootStringIndex];
  let base = anchor - (rootString.openMidi + shape.rootFret);
  while (base < 0) base += 12;
  return base;
}

function buildCagedShape(shape: OpenChordShape): CagedShape {
  const base = cagedBaseFret(shape);
  const notes: CagedShape["notes"] = [];

  for (let stringIndex = 0; stringIndex < STANDARD_TUNING.length; stringIndex += 1) {
    const offset = shape.offsets[stringIndex];
    if (offset === null) continue;
    const fret = base + shape.rootFret + offset;
    if (fret < 0) continue;
    const midi = STANDARD_TUNING[stringIndex].openMidi + fret;
    notes.push({
      stringIndex,
      stringNumber: STANDARD_TUNING[stringIndex].number,
      fret,
      midi,
      name: spellNote(midi, "flat"),
      isRoot: midi === STANDARD_TUNING[shape.rootStringIndex].openMidi + base + shape.rootFret,
    });
  }

  const frets = notes.map((note) => note.fret);
  const root = notes.find((note) => note.isRoot);

  return {
    name: shape.name,
    baseFret: base,
    origin: shape.origin,
    notes,
    minFret: Math.min(...frets),
    maxFret: Math.max(...frets),
    rootNote: root ? noteWithOctave(root.midi) : "—",
    rootStringNumber: STANDARD_TUNING[shape.rootStringIndex].number,
  };
}

/**
 * 五个形状，按基准品位从低到高排列。
 *
 * 这个顺序不是写死的：CAGED 之所以叫 CAGED，就是因为
 * C → A → G → E → D 恰好是它们沿指板由低到高的自然次序。
 * 对 C 大调，算出来正好是 C(0) → A(3) → G(5) → E(8) → D(10)。
 */
export const CAGED_SHAPES_BY_POSITION: CagedShape[] = CAGED_SHAPES.map(buildCagedShape).sort(
  (a, b) => a.baseFret - b.baseFret,
);

/** CAGED 循环覆盖的品数上限 */
export const CAGED_FRET_COUNT = Math.max(
  ...CAGED_SHAPES_BY_POSITION.map((shape) => shape.maxFret),
);

/** 按名字取一个形状（C / A / G / E / D） */
export function cagedShapeForName(name: string): CagedShape {
  const shape = CAGED_SHAPES_BY_POSITION.find((item) => item.name === name);
  if (!shape) throw new Error(`未知 CAGED 形状：${name}`);
  return shape;
}

/* ==========================================================================
   推弦目标音
   ========================================================================== */

export type BendTarget = {
  stringIndex: number;
  stringNumber: number;
  /** 起始品位，0 = 空弦 */
  fret: number;
  /** 起始音名 */
  fromName: string;
  /** 可推到的目标音 */
  targets: {
    /** 目标音名 */
    name: string;
    /** 推出的半音数 */
    semitones: number;
    /** 推弦量，单位「音」：1 音 = 全音 = 2 个半音 */
    units: number;
    /** 目标音在同一根弦上对应的品位（可为小数） */
    targetFret: number;
    /** 目标音是否在 C 大调里 */
    inKey: boolean;
  }[];
};

/** 可用的推弦量，单位「音」。1 音 = 全音 = 2 个半音 */
export const BEND_UNITS = [0.5, 1, 1.5, 2] as const;

/** C 大调的音级集合，用来判断推弦目标是不是调内音 */
const C_MAJOR_PITCH_CLASSES = new Set(SCALES.major.semitones);

/**
 * 某根弦某品位能推到哪些音。
 *
 * 推弦量直接换算成半音数，再落到同一根弦的品位上：
 * 推 1 音（全音）等于往高走 1 品，推 1.5 音等于 1.5 品。
 * 所以「推到位」的目标就是目标品位发出的那个音。
 *
 * 拼写随调性：大调用 F#、C#，布鲁斯用 Gb、Db——
 * 同一个音高在两种调里读法不同，写死一种会让另一半场景读不通。
 */
export function buildBendTargets(maxFret = 15, spelling: Spelling = "sharp"): BendTarget[] {
  const result: BendTarget[] = [];

  for (let stringIndex = 0; stringIndex < STANDARD_TUNING.length; stringIndex += 1) {
    for (let fret = 0; fret <= maxFret; fret += 1) {
      const openMidi = STANDARD_TUNING[stringIndex].openMidi;
      const midi = openMidi + fret;
      result.push({
        stringIndex,
        stringNumber: STANDARD_TUNING[stringIndex].number,
        fret,
        fromName: spellNote(midi, spelling),
        targets: BEND_UNITS.map((units) => {
          const semitones = units * 2;
          return {
            name: spellNote(midi + semitones, spelling),
            semitones,
            units,
            targetFret: fret + units,
            inKey: C_MAJOR_PITCH_CLASSES.has(pitchClass(midi + semitones)),
          };
        }),
      });
    }
  }

  return result;
}


/* ==========================================================================
   和弦：音位推导
   ========================================================================== */

/** 和弦性质。性质由音程组合决定，音位由调弦推出。 */
export type ChordQuality = "major" | "minor" | "diminished" | "augmented";

export type ChordType = {
  id: string;
  /** 中文性质名 */
  label: string;
  /** 相对根音的半音数，依次是根音、三音、五音、七音 */
  semitones: number[];
  /** 音级记号，如 1、♭3、5 */
  degreeLabels: string[];
  /** 有几个音 */
  size: number;
  /** 三和弦还是七和弦 */
  kind: "triad" | "seventh";
};

const CHORD_TYPES: ChordType[] = [
  {
    id: "major",
    label: "大三和弦",
    semitones: [0, 4, 7],
    degreeLabels: ["1", "3", "5"],
    size: 3,
    kind: "triad",
  },
  {
    id: "minor",
    label: "小三和弦",
    semitones: [0, 3, 7],
    degreeLabels: ["1", "♭3", "5"],
    size: 3,
    kind: "triad",
  },
  {
    id: "diminished",
    label: "减三和弦",
    semitones: [0, 3, 6],
    degreeLabels: ["1", "♭3", "♭5"],
    size: 3,
    kind: "triad",
  },
  {
    id: "augmented",
    label: "增三和弦",
    semitones: [0, 4, 8],
    degreeLabels: ["1", "3", "♯5"],
    size: 3,
    kind: "triad",
  },
  {
    id: "dominant7",
    label: "属七和弦",
    semitones: [0, 4, 7, 10],
    degreeLabels: ["1", "3", "5", "♭7"],
    size: 4,
    kind: "seventh",
  },
  {
    id: "major7",
    label: "大七和弦",
    semitones: [0, 4, 7, 11],
    degreeLabels: ["1", "3", "5", "7"],
    size: 4,
    kind: "seventh",
  },
  {
    id: "minor7",
    label: "小七和弦",
    semitones: [0, 3, 7, 10],
    degreeLabels: ["1", "♭3", "5", "♭7"],
    size: 4,
    kind: "seventh",
  },
  {
    id: "halfDiminished7",
    label: "半减七和弦",
    semitones: [0, 3, 6, 10],
    degreeLabels: ["1", "♭3", "♭5", "♭7"],
    size: 4,
    kind: "seventh",
  },
  {
    id: "diminished7",
    label: "减七和弦",
    semitones: [0, 3, 6, 9],
    degreeLabels: ["1", "♭3", "♭5", "♭♭7"],
    size: 4,
    kind: "seventh",
  },
];

/** 常用和弦性质，按性质名索引 */
export const CHORD_TYPE_LIST: ChordType[] = CHORD_TYPES;

/** 按 id 取和弦性质 */
export function chordTypeById(id: string): ChordType {
  const type = CHORD_TYPES.find((item) => item.id === id);
  if (!type) throw new Error(`未知和弦性质：${id}`);
  return type;
}

/** 根音名（不带记号）到音高类的映射 */
const ROOT_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

/** 根音名到音高类；未知根音返回 null */
export function rootPitchClass(root: string): number | null {
  return ROOT_PITCH_CLASSES[root] ?? null;
}

/**
 * 音级记号 → 该级相对根音的半音数。
 *
 * 拼写必须跟着「级」走，不能跟着音高类走：
 * G 大七和弦的七级是 F♯（升七），同一个音高类在别的调里要读成 Gb。
 * 所以这里从记号反推半音数，再拼出这个级在该调里的音名。
 */
const DEGREE_SEMITONES: Record<string, number> = {
  "1": 0,
  "2": 2,
  "♭2": 1,
  "3": 4,
  "♭3": 3,
  "4": 5,
  "♯4": 6,
  "5": 7,
  "♭5": 6,
  "♯5": 8,
  "6": 9,
  "♭6": 8,
  "7": 11,
  "♭7": 10,
  "♭♭7": 9,
};

/** 自然音名字母，按音高顺序 */
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

/** 自然音名对应的音高类 */
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;

/** 记号去掉升降号后的自然音级（1–7） */
function naturalDegreeOf(degreeLabel: string): number {
  const digits = degreeLabel.replace(/[^0-9]/g, "");
  return Number.parseInt(digits, 10);
}

/** 根音名里的字母（"C#" → "C"，"Eb" → "E"） */
function rootLetterOf(root: string): string {
  return root[0].toUpperCase();
}

/**
 * 按级拼写音名。
 *
 * 字母由「调」决定：大调音级的字母序列固定——
 * 从根音字母往上数，第 3 级就是根音字母往后第 2 个字母。
 * 所以 G 大调的第 3 级是 B（不是 C），F 大调的第 3 级是 A。
 *
 * 升降号由「音高」决定：算出这个字母的自然音高，与该级的目标音高相比，
 * 差多少就加多少个记号。这样 G 大七和弦的七级自然字母是 F，
 * 目标音高是 F♯，差一个半音 → F♯（而不是 Gb）。
 */
function spellByDegree(root: string, rootPc: number, degreeLabel: string): string {
  const semitones = DEGREE_SEMITONES[degreeLabel];
  if (semitones === undefined) throw new Error(`未知音级记号：${degreeLabel}`);

  const naturalDegree = naturalDegreeOf(degreeLabel);
  const rootLetterIndex = LETTERS.indexOf(rootLetterOf(root) as (typeof LETTERS)[number]);
  if (rootLetterIndex === -1) throw new Error(`未知根音：${root}`);

  // 第 N 级的自然字母 = 根音字母往后 N-1 个
  const letterIndex = (rootLetterIndex + naturalDegree - 1) % 7;
  const naturalLetter = LETTERS[letterIndex];
  const naturalPc = LETTER_PC[letterIndex];

  const targetPc = ((rootPc + semitones) % 12 + 12) % 12;
  const diff = (targetPc - naturalPc + 12) % 12;

  const ACCIDENTALS: Record<number, string> = {
    0: "",
    1: "♯",
    2: "♯♯",
    10: "♭♭",
    11: "♭",
  };
  const accidental = ACCIDENTALS[diff];
  if (accidental === undefined) {
    throw new Error(`无法拼写音级 ${degreeLabel}（根音 ${root}）`);
  }

  const strict = `${naturalLetter}${accidental}`;

  /**
   * 实用拼写：在音高不变的前提下，取记号最少的读法。
   *
   * 严格的和声拼写会产出 E♯、B♭♭ 这类双记号——音高没错，
   * 但吉他手平时读的是 F 和 A。本资料库是给吉他手看的，
   * 所以记号最少的那一版才是有用的读法。
   *
   * 记号数相同时（如 F♯ 与 Gb）保留严格拼写，
   * 这样 G 大七的七级仍是 F♯ 而不是 Gb。
   */
  // 严格拼写已经带上正确的字母（由根音的大调音阶决定）。
  // 只在出现双记号（♯♯ / ♭♭）时改用等价的单记号读法——
  // 双记号是实际读不出来的写法，而单记号的等音对在吉他手那里才通用。
  if (!/♯♯|♭♭/.test(strict)) return strict;

  const direction = directionOf(degreeLabel);
  const alternative = practicalSpelling(targetPc, direction);
  if (alternative === null) return strict;
  return `${alternative.letter}${alternative.accidentals}`;
}

/** 记号的方向：降号记号 → -1，升号记号 → 1，自然音级 → 0 */
function directionOf(degreeLabel: string): -1 | 0 | 1 {
  if (degreeLabel.startsWith("♭")) return -1;
  if (degreeLabel.startsWith("♯")) return 1;
  return 0;
}

/** 一个音高的实用读法：字母 + 记号 */
type SpellingChoice = { letter: string; accidentals: string };

/** 每个音高类对应的字母（自然音名，必要时带一个记号） */
const PITCH_CLASS_SPELLINGS: Record<number, SpellingChoice[]> = {
  0: [{ letter: "C", accidentals: "" }],
  1: [
    { letter: "C", accidentals: "♯" },
    { letter: "D", accidentals: "♭" },
  ],
  2: [{ letter: "D", accidentals: "" }],
  3: [
    { letter: "E", accidentals: "♭" },
    { letter: "D", accidentals: "♯" },
  ],
  4: [{ letter: "E", accidentals: "" }],
  5: [{ letter: "F", accidentals: "" }, { letter: "E", accidentals: "♯" }],
  6: [
    { letter: "F", accidentals: "♯" },
    { letter: "G", accidentals: "♭" },
  ],
  7: [{ letter: "G", accidentals: "" }],
  8: [
    { letter: "G", accidentals: "♯" },
    { letter: "A", accidentals: "♭" },
  ],
  9: [{ letter: "A", accidentals: "" }],
  10: [
    { letter: "B", accidentals: "♭" },
    { letter: "A", accidentals: "♯" },
  ],
  11: [{ letter: "B", accidentals: "" }],
};

/**
 * 音高类对应的实用读法。
 *
 * `direction` 是记号的倾向：降号体系（♭3、♭5、♭7）优先用降号拼法，
 * 升号体系（3、♯5、7）优先用升号拼法。
 * 这样 C 减三的 ♭5 读 Gb 而不是 F♯，C♯ 大三的三级读 E♯ 而不是 F——
 * 后者是因为 E♯ 才是「根音 C♯ 的大三度」，而 F 只是同一个音的另一个名字。
 *
 * 方向相同或只有一个选项时，取记号最少的那一版。
 */
function practicalSpelling(
  pitchClass: number,
  direction: -1 | 0 | 1,
): SpellingChoice | null {
  const options = PITCH_CLASS_SPELLINGS[pitchClass];
  if (!options || options.length === 0) return null;

  /**
   * 方向明确时只取方向匹配的选项。
   *
   * 关键在于「只」：C♯ 大三的三级是 E♯，虽然 F 是同一个音高且不需要记号，
   * 但在升号体系里它必须读 E♯——否则同一个音在同一条和弦里出现两种读法。
   * 方向不明确（自然音级）时才在全部选项里取记号最少的。
   */
  if (direction !== 0) {
    const wanted = direction === -1 ? "♭" : "♯";
    const matched = options.filter((option) => option.accidentals.startsWith(wanted));
    if (matched.length > 0) {
      return matched.reduce((best, option) =>
        option.accidentals.length < best.accidentals.length ? option : best,
      );
    }
  }

  // 记号最少的一版；双记号不参与候选
  return options
    .filter((option) => !/♯♯|♭♭/.test(option.accidentals))
    .reduce((best, option) =>
      option.accidentals.length < best.accidentals.length ? option : best,
    );
}

export type ChordNote = {
  stringIndex: number;
  stringNumber: number;
  fret: number;
  midi: number;
  /** 音名，按和弦音级的拼写 */
  name: string;
  /** 在和弦里的序号，从 1 开始 */
  degree: number;
  /** 音级记号 */
  degreeLabel: string;
  isRoot: boolean;
};

export type ChordVoicing = {
  /** 根音名 */
  root: string;
  /** 性质 id */
  typeId: string;
  /** 性质中文名 */
  typeLabel: string;
  /** 音级记号，如 1、♭3、5、♭7 */
  degreeLabels: string[];
  /** 音位：从低到高 */
  notes: ChordNote[];
  /** 最低音的音名（不含八度） */
  bassNote: string;
  /** 最低音的八度 */
  bassOctave: number;
  /** 最低音所在弦 */
  bassStringNumber: number;
  /** 最低音的品位 */
  bassFret: number;
};

/**
 * 某个根音在指板上的所有可按的和弦音位。
 *
 * 做法：在每根弦上找和弦音，然后向低音方向回溯：
 * 从「最低的那根含和弦音的弦」出发，逐弦向上看这一弦的品位上
 * 有没有下一个和弦音（音高更高）。每根弦只取一个音，
 * 连续取到整个和弦的音数就得到一个音位。
 *
 * 这样得到的每个音位都是真实可按的，而不是手抄的指法表。
 */
export function buildChordVoicings(
  root: string,
  typeId: string,
  maxFret = 15,
): ChordVoicing[] {
  const rootPc = rootPitchClass(root);
  if (rootPc === null) throw new Error(`未知根音：${root}`);

  const type = chordTypeById(typeId);
  const voicings: ChordVoicing[] = [];
  const seen = new Set<string>();

  /**
   * 某根弦上音高在 [lowMidi, highMidi] 区间内的所有品位。
   * 一根弦上可能有多个音符合区间，逐个试。
   */
  function positionsOnString(stringIndex: number, lowMidi: number, highMidi: number) {
    const open = STANDARD_TUNING[stringIndex].openMidi;
    const out: { midi: number; fret: number }[] = [];
    for (let fret = 0; fret <= maxFret; fret += 1) {
      const midi = open + fret;
      if (midi < lowMidi) continue;
      if (midi > highMidi) break;
      out.push({ midi, fret });
    }
    return out;
  }

  /**
   * 枚举一个八度窗口内的和弦音。
   *
   * 和弦音是「根音 + 各音程」，可以整体移八度。
   * 根音在指板上的位置由「哪根弦的哪个品位是根音」决定，
   * 但和弦的其他音可以落在不同的弦上（开放和弦就是这样：
   * C 大三的 E 在 4 弦 2 品、G 在 3 弦空弦、C 在 5 弦 3 品）。
   *
   * 所以做法是：先定根音的具体音高，再对每个和弦音
   * 找出它在任意弦上的可按位置，要求这些位置互不同弦、
   * 音高符合、且整体在合理范围内。
   */
  for (let rootString = 0; rootString < STANDARD_TUNING.length; rootString += 1) {
    const rootOpen = STANDARD_TUNING[rootString].openMidi;
    for (let rootFret = 0; rootFret <= maxFret; rootFret += 1) {
      const rootMidi = rootOpen + rootFret;
      if (pitchClass(rootMidi) !== rootPc) continue;

      // 和弦的每个音在各八度上的目标音高
      const toneTargets = type.semitones.map((offset, degreeIndex) => ({
        degreeIndex,
        degreeLabel: type.degreeLabels[degreeIndex],
        // 该音在根音之上 0–3 个八度
        offsets: [0, 12, 24].map((octave) => rootMidi + offset + octave),
      }));

      // 每个和弦音取一个位置。用「每根弦最多一个音」来约束。
      // 枚举量不大：和弦最多 4 音 × 3 个八度 × 6 弦。
      const pickTone = (toneIndex: number, usedStrings: Set<number>) => {
        const tone = toneTargets[toneIndex];
        const options: { midi: number; fret: number; stringIndex: number }[] = [];

        for (const target of tone.offsets) {
          for (let s = 0; s < STANDARD_TUNING.length; s += 1) {
            if (usedStrings.has(s)) continue;
            for (const pos of positionsOnString(s, target, target)) {
              options.push({ ...pos, stringIndex: s });
            }
          }
        }

        return options;
      };

      // 回溯：给每个和弦音选一个位置
      const chosen: { midi: number; fret: number; stringIndex: number; degreeIndex: number }[] = [];

      const search = (toneIndex: number) => {
        if (toneIndex === toneTargets.length) {
          // 全部选完：检查音高是升序（可弹），且没有音级重复
          const sorted = [...chosen].sort((a, b) => a.midi - b.midi);
          if (sorted.some((n, i) => i > 0 && n.midi === sorted[i - 1].midi)) return;
          const degreeSet = new Set(sorted.map((n) => n.degreeIndex));
          if (degreeSet.size !== type.size) return;

          // 只保留「相邻弦连续」的音位：真实弹奏的指法不会在两根弦之间
          // 跳过一根又回来（那叫跳弦，音会断）。把弦号排好序，
          // 要求相邻两个弦号差 1。
          const stringIndexes = sorted.map((n) => n.stringIndex).sort((a, b) => a - b);
          for (let i = 1; i < stringIndexes.length; i += 1) {
            if (stringIndexes[i] - stringIndexes[i - 1] !== 1) return;
          }

          const signature = sorted
            .map((n) => `${n.stringIndex}-${n.fret}`)
            .sort()
            .join(",");
          if (seen.has(signature)) return;
          seen.add(signature);

          const notes: ChordNote[] = sorted.map((n) => ({
            stringIndex: n.stringIndex,
            stringNumber: STANDARD_TUNING[n.stringIndex].number,
            fret: n.fret,
            midi: n.midi,
            name: spellByDegree(root, rootPc, type.degreeLabels[n.degreeIndex]),
            degree: n.degreeIndex + 1,
            degreeLabel: type.degreeLabels[n.degreeIndex],
            isRoot: n.degreeIndex === 0,
          }));

          const bass = notes[0];
          voicings.push({
            root,
            typeId,
            typeLabel: type.label,
            degreeLabels: type.degreeLabels,
            notes,
            bassNote: bass.name,
            bassOctave: Math.floor(bass.midi / 12) - 1,
            bassStringNumber: bass.stringNumber,
            bassFret: bass.fret,
          });
          return;
        }

        for (const option of pickTone(toneIndex, new Set(chosen.map((c) => c.stringIndex)))) {
          chosen.push({ ...option, degreeIndex: toneTargets[toneIndex].degreeIndex });
          search(toneIndex + 1);
          chosen.pop();
        }
      };

      search(0);
    }
  }

  // 排序：根音位置（最低音就是根音）优先，其次最低音的品位、弦号。
  return voicings.sort((a, b) => {
    const aRootPos = a.notes[0].isRoot ? 0 : 1;
    const bRootPos = b.notes[0].isRoot ? 0 : 1;
    if (aRootPos !== bRootPos) return aRootPos - bRootPos;
    if (a.bassFret !== b.bassFret) return a.bassFret - b.bassFret;
    if (a.bassStringNumber !== b.bassStringNumber) {
      return a.bassStringNumber - b.bassStringNumber;
    }
    return a.notes.length - b.notes.length;
  });
}

/**
 * 实际会用的音位：从全部推导结果里挑出「可弹、好记」的那些。
 *
 * 三道筛：
 * 1. **位宽**：最高与最低品位相差不超过 `maxSpan` 品。跨度太大的按法
 *    手指够不着，是推导能给出但人弹不了的东西。
 * 2. **根音位置**：最低音就是根音的优先（转位另算）。
 * 3. **形状去重**：同样的音程组合只留位置最低的那一个。
 *    同一个 C 大三和弦在指板上有几十种按法，但形状（相对根音的音程排列）
 *    只有几种——去重后才是「几个和弦型」这个有用的信息。
 */
export function practicalChordVoicings(
  root: string,
  typeId: string,
  options: { maxFret?: number; maxSpan?: number; rootPositionOnly?: boolean } = {},
): ChordVoicing[] {
  const maxFret = options.maxFret ?? 15;
  const maxSpan = options.maxSpan ?? 4;
  const rootPositionOnly = options.rootPositionOnly ?? true;

  const all = buildChordVoicings(root, typeId, maxFret);

  // 位宽筛选
  const withinSpan = all.filter((v) => {
    const frets = v.notes.map((n) => n.fret);
    return Math.max(...frets) - Math.min(...frets) <= maxSpan;
  });

  // 根音位置筛选
  const positioned = rootPositionOnly
    ? withinSpan.filter((v) => v.notes[0].isRoot)
    : withinSpan;

  // 形状去重：按「相对最低音的音程序列」分形状，每形状留第一个
  const byShape = new Map<string, ChordVoicing>();
  for (const v of positioned) {
    const bass = v.notes[0].midi;
    const shape = v.notes.map((n) => n.midi - bass).join(",");
    const existing = byShape.get(shape);
    if (!existing) {
      byShape.set(shape, v);
      continue;
    }
    // 同一形状里保留位置更低（低音弦、低品）的那个
    if (v.bassFret < existing.bassFret) byShape.set(shape, v);
    else if (
      v.bassFret === existing.bassFret &&
      v.bassStringNumber < existing.bassStringNumber
    ) {
      byShape.set(shape, v);
    }
  }

  return [...byShape.values()].sort((a, b) => {
    if (a.bassFret !== b.bassFret) return a.bassFret - b.bassFret;
    if (a.bassStringNumber !== b.bassStringNumber) {
      return a.bassStringNumber - b.bassStringNumber;
    }
    return a.notes.length - b.notes.length;
  });
}

/** 常用根音名，按音高顺序 */
export const CHORD_ROOTS = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/** 根音名到记号的映射：黑键用降号读更常见 */
export const CHORD_ROOT_SPELLING: Record<string, string> = {
  C: "C",
  "C#": "C#",
  D: "D",
  Eb: "Eb",
  E: "E",
  F: "F",
  "F#": "F#",
  G: "G",
  Ab: "Ab",
  A: "A",
  Bb: "Bb",
  B: "B",
};
