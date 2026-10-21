/**
 * 速查页（/cheatsheet）的纯逻辑。
 *
 * 这一页全是「要一眼查到」的数字，所以数字必须可信。
 * 调弦、音级、和弦、推弦、速度区间与拍号重音，全部由 lib/guitar.ts 与
 * lib/metronome.ts 的现有导出推导出来，这里不手抄任何音高常量：
 * 改动标准调弦或速度区间，这一页会跟着变。
 *
 * 纯函数，不碰 DOM，可以在 node（vitest）下直接 import。
 */

import {
  BEND_UNITS,
  CAGED_SHAPES_BY_POSITION,
  CHORD_TYPE_LIST,
  FRET_COUNT,
  PATTERNS,
  STANDARD_TUNING,
  buildBendTargets,
  buildScaleNeckNotes,
  getScale,
  practicalChordVoicings,
  type Spelling,
} from "@/lib/guitar";
import { BPM_MAX, BPM_MIN, METERS, accentIndexes, tempoName } from "@/lib/metronome";

/** C 大调音阶定义（来自 lib/guitar.ts） */
const C_MAJOR = getScale("major");

/** 音高类（C4 = 60 的 0 基） */
function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** 科学音高记法的八度：C4 = 60 → 4 */
function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** 该音高在 C 大调里的级数（1–7）；不在调内返回 null */
function degreeInCMajor(midi: number): number | null {
  const index = C_MAJOR.semitones.indexOf(pitchClass(midi));
  return index === -1 ? null : index + 1;
}

/* ==========================================================================
   调弦与音名对照
   ========================================================================== */

export type TuningRow = {
  /** 弦号：1 = 最细的高音弦，6 = 最粗的低音弦 */
  stringNumber: number;
  /** 空弦音名，不带八度 */
  openName: string;
  /** 空弦绝对音高，C4 = 60 */
  openMidi: number;
  /** 空弦音名带八度，如 E2 */
  openNote: string;
  /** C 大调里的级数；不在调内为 null */
  degree: number | null;
  /** 该级在 C 大调里的音名，如 E */
  degreeNote: string | null;
  /** 该级的唱名，如 mi */
  solfege: string | null;
};

/**
 * 唱名（首调唱名法）。
 *
 * 这是记谱惯例，不是音位数据：级数与音名都由 C 大调音阶推出，
 * 这里只把级数翻译成唱名，纯粹为了读表时不用再换算。
 */
const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "si"] as const;

/** 六根弦的空弦音名、MIDI 音高与 C 大调音级 */
export function tuningRows(): TuningRow[] {
  return STANDARD_TUNING.map((string) => {
    const degree = degreeInCMajor(string.openMidi);
    return {
      stringNumber: string.number,
      openName: string.openName,
      openMidi: string.openMidi,
      openNote: `${string.openName}${octaveOf(string.openMidi)}`,
      degree,
      degreeNote: degree === null ? null : C_MAJOR.names[degree - 1],
      solfege: degree === null ? null : SOLFEGE[degree - 1],
    };
  });
}

/* ==========================================================================
   C 大调音级与指板音位
   ========================================================================== */

export type ScalePositionRow = {
  /** 音级 1–7 */
  degree: number;
  /** 音级对应的音名，如 C */
  noteName: string;
  /** 调式名，如 Dorian */
  mode: string;
  /** 调式中文名，如 多利亚 */
  modeZh: string;
  /** 该调式的色彩说明 */
  character: string;
  /** 每根弦上该音级的品位（由低到高）；空数组表示这根弦上取不到 */
  fretsByString: { stringNumber: number; frets: number[] }[];
};

/**
 * 七个音级在六根弦上的全部品位。
 *
 * 品位从 buildScaleNeckNotes 取（它从第 1 品起算），
 * 空弦（0 品）由调弦单独补上——开放音也是音位，速查表里不能缺。
 */
export function scalePositionRows(fretCount = FRET_COUNT): ScalePositionRow[] {
  const frets = new Map<string, number[]>();
  const push = (degree: number, stringNumber: number, fret: number) => {
    const key = `${degree}:${stringNumber}`;
    const list = frets.get(key) ?? [];
    list.push(fret);
    frets.set(key, list);
  };

  for (const note of buildScaleNeckNotes(fretCount, "major")) {
    push(note.degree, note.stringNumber, note.fret);
  }
  for (const string of STANDARD_TUNING) {
    const degree = degreeInCMajor(string.openMidi);
    if (degree !== null) push(degree, string.number, 0);
  }

  return PATTERNS.map((pattern) => ({
    degree: pattern.degree,
    noteName: C_MAJOR.names[pattern.degree - 1],
    mode: pattern.mode,
    modeZh: pattern.modeZh,
    character: pattern.character,
    fretsByString: STANDARD_TUNING.map((string) => ({
      stringNumber: string.number,
      frets: (frets.get(`${pattern.degree}:${string.number}`) ?? []).sort(
        (a, b) => a - b,
      ),
    })),
  }));
}

/* ==========================================================================
   推弦目标音
   ========================================================================== */

/**
 * 常用推弦起音。
 *
 * 推弦的难点是「推到哪个音」，而常用的起音位置就那么几个：
 * 6 弦空弦与 3 品是布鲁斯的两个基本位，3 弦 2、3 品是小调色彩最浓的两个起音，
 * 1 弦 5 品是高把位最常被推的那个音。
 */
const COMMON_BEND_STARTS: { stringNumber: number; fret: number }[] = [
  { stringNumber: 6, fret: 0 },
  { stringNumber: 6, fret: 3 },
  { stringNumber: 3, fret: 0 },
  { stringNumber: 3, fret: 2 },
  { stringNumber: 3, fret: 3 },
  { stringNumber: 1, fret: 5 },
];

export type BendTargetCell = {
  /** 推的量，单位「音」：1 音 = 全音 = 2 个半音 */
  units: number;
  /** 这一档的读法，如「半音」「1 音」 */
  label: string;
  /** 目标音名 */
  name: string;
  /** 目标音在同一根弦上对应的品位（可为小数） */
  targetFret: number;
  /** 目标音是不是 C 大调调内音 */
  inKey: boolean;
};

export type BendRow = {
  stringNumber: number;
  /** 起始品位，0 = 空弦 */
  fret: number;
  /** 起始音名 */
  fromName: string;
  targets: BendTargetCell[];
};

/** 推弦量档位的读法：由数值推出，不另建对照表 */
function bendUnitLabel(units: number): string {
  if (units < 1) return "半音";
  return `${units} 音`;
}

/** 常用起音能推到哪些音 */
export function bendRows(spelling: Spelling = "sharp"): BendRow[] {
  const all = buildBendTargets(FRET_COUNT, spelling);

  return COMMON_BEND_STARTS.map((start) => {
    const found = all.find(
      (target) =>
        target.stringNumber === start.stringNumber && target.fret === start.fret,
    );
    if (!found) {
      throw new Error(`找不到推弦起音：${start.stringNumber} 弦 ${start.fret} 品`);
    }

    return {
      stringNumber: found.stringNumber,
      fret: found.fret,
      fromName: found.fromName,
      targets: BEND_UNITS.map((units) => {
        const target = found.targets.find((item) => item.units === units);
        if (!target) throw new Error(`找不到推弦档位：${units} 音`);
        return {
          units: target.units,
          label: bendUnitLabel(target.units),
          name: target.name,
          targetFret: target.targetFret,
          inKey: target.inKey,
        };
      }),
    };
  });
}

/* ==========================================================================
   CAGED 五形状
   ========================================================================== */

export type CagedRow = {
  /** 形状名：C / A / G / E / D */
  name: string;
  /** 基准品位：根音所在的那一品 */
  baseFret: number;
  /** 覆盖品域 */
  minFret: number;
  maxFret: number;
  /** 根音音名与八度 */
  rootNote: string;
  /** 根音所在弦 */
  rootStringNumber: number;
  /** 这个形状的由来 */
  origin: string;
  /** 每根弦按到的品位；null = 该弦不弹 */
  fretsByString: { stringNumber: number; fret: number | null }[];
};

/** 五个形状：位置由调弦与根音算出，不手抄 */
export function cagedRows(): CagedRow[] {
  return CAGED_SHAPES_BY_POSITION.map((shape) => ({
    name: shape.name,
    baseFret: shape.baseFret,
    minFret: shape.minFret,
    maxFret: shape.maxFret,
    rootNote: shape.rootNote,
    rootStringNumber: shape.rootStringNumber,
    origin: shape.origin,
    fretsByString: STANDARD_TUNING.map((string) => {
      const note = shape.notes.find((item) => item.stringNumber === string.number);
      return { stringNumber: string.number, fret: note ? note.fret : null };
    }),
  }));
}

/* ==========================================================================
   常见和弦的指法
   ========================================================================== */

export type CheatChordRow = {
  /** 和弦名，如 C、Am */
  symbol: string;
  /** 性质中文名，如 大三和弦 */
  typeLabel: string;
  /** 音级记号，如 1、♭3、5 */
  degreeLabels: string[];
  /** 最省力的那个音位：从低到高 */
  voicing: {
    stringNumber: number;
    fret: number;
    name: string;
    isRoot: boolean;
  }[];
};

/** 常见和弦：六个大调 + 三个小调 */
const CHEAT_CHORDS: { root: string; typeId: string }[] = [
  { root: "C", typeId: "major" },
  { root: "G", typeId: "major" },
  { root: "D", typeId: "major" },
  { root: "A", typeId: "major" },
  { root: "E", typeId: "major" },
  { root: "F", typeId: "major" },
  { root: "A", typeId: "minor" },
  { root: "E", typeId: "minor" },
  { root: "D", typeId: "minor" },
];

/**
 * 每个和弦取「最省力的那一个音位」。
 *
 * 音位由 practicalChordVoicings 推导（位宽不超过 4 品、最低音是根音、
 * 同形状只留位置最低的），所以表里没有一个手抄的指法。
 */
export function chordRows(): CheatChordRow[] {
  return CHEAT_CHORDS.map(({ root, typeId }) => {
    const type = CHORD_TYPE_LIST.find((item) => item.id === typeId);
    if (!type) throw new Error(`未知和弦性质：${typeId}`);

    const voicings = practicalChordVoicings(root, typeId, {
      maxFret: FRET_COUNT,
      maxSpan: 4,
    });
    const voicing = voicings[0];
    if (!voicing) throw new Error(`没有可用的音位：${root} ${typeId}`);

    return {
      symbol: `${root}${typeId === "minor" ? "m" : ""}`,
      typeLabel: type.label,
      degreeLabels: type.degreeLabels,
      voicing: voicing.notes.map((note) => ({
        stringNumber: note.stringNumber,
        fret: note.fret,
        name: note.name,
        isRoot: note.isRoot,
      })),
    };
  });
}

/* ==========================================================================
   速度术语
   ========================================================================== */

export type TempoBand = {
  /** 意大利术语，如 Largo */
  name: string;
  /** 中文说法 */
  gloss: string;
  /** 区间下限（含） */
  min: number;
  /** 区间上限（含） */
  max: number;
};

/**
 * 术语的中文说法。
 *
 * 术语本身是固定的音乐用语，不随推导变化；区间由 tempoName 逐 BPM 扫出来，
 * 所以改了速度区间的定义，这里会跟着变。
 */
const TEMPO_GLOSS: Record<string, string> = {
  Largo: "极慢，几乎静止",
  Adagio: "很慢，弛缓",
  Andante: "行板，中慢速",
  Moderato: "中板，中速",
  Allegro: "快板，快速",
  Presto: "急板，更快",
};

/** BPM 与速度术语的对应区间 */
export function tempoBands(): TempoBand[] {
  const bands: TempoBand[] = [];

  for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 1) {
    const name = tempoName(bpm);
    const last = bands.at(-1);
    if (last && last.name === name) {
      last.max = bpm;
      continue;
    }
    bands.push({ name, gloss: TEMPO_GLOSS[name] ?? "", min: bpm, max: bpm });
  }

  return bands;
}

/* ==========================================================================
   节拍器重音模型
   ========================================================================== */

export type MeterRow = {
  /** 拍号，如 6/8 */
  label: string;
  /** 每小节拍数 */
  beatsPerBar: number;
  /** 以几分音符为一拍 */
  beatUnit: number;
  /** 重音拍的序号（1 起） */
  accentBeats: number[];
  /** 中文听感说明 */
  description: string;
};

/** 一拍是几分音符的读法 */
export function beatUnitName(beatUnit: number): string {
  if (beatUnit === 8) return "八分音符";
  if (beatUnit === 2) return "二分音符";
  return "四分音符";
}

/** 常见拍号的拍数与重音位置 */
export function meterRows(): MeterRow[] {
  return METERS.map((meter) => ({
    label: meter.label,
    beatsPerBar: meter.beatsPerBar,
    beatUnit: meter.beatUnit,
    accentBeats: accentIndexes(meter).map((index) => index + 1),
    description: meter.description,
  }));
}
