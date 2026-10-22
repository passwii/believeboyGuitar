import { STANDARD_TUNING, spellNote } from "@/lib/guitar";

const OCTAVE_SEMITONES = 12;

/** 左手手指。曲谱里的指法标记直接使用这四个汉字。 */
export type TabFinger = "食" | "中" | "名" | "小";

/** 六线吉他弦号：1 = 最细的高音 E 弦，6 = 最粗的低音 E 弦。 */
export type TabString = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 曲谱时值。
 * q = 四分音符，8 = 八分音符，8t = 八分三连音，16 = 十六分音符。
 * 目前只覆盖资料库里实际用到的几种；新增时值时要同时补
 * `groupNotesForRhythm` 与 `TabStaff` 的符杠绘制。
 */
export type TabDuration = "q" | "8" | "8t" | "16";

export interface TabNote {
  string: TabString;
  fret: number;
  duration: TabDuration;
  /** 左手手指；不标指法时可以省略。 */
  finger?: TabFinger;
}

/** 一个小节。小节内的音符按时间顺序排列。 */
export interface TabMeasure {
  notes: readonly TabNote[];
}

/** 一份 TAB 曲谱的完整数据。 */
export interface TabScore {
  bpm: number;
  /** 拍号，默认 4/4。 */
  timeSignature?: readonly [number, number];
  /** 教材附带的 CD 起始时间，例如 "0:00~"。 */
  cdStart?: string;
  measures: readonly TabMeasure[];
}

export type TabPitch = {
  string: number;
  fret: number;
  /** 实际发声的 MIDI 音高。 */
  soundingMidi: number;
  /** 吉他低八度记谱后的谱面 MIDI 音高。 */
  staffMidi: number;
  /** 谱面音名，使用常见降号拼写。 */
  staffName: string;
  staffOctave: number;
  /** 相对高音 E 弦空弦 E4 的半音步数。 */
  staffSteps: number;
};

export type TabNoteInfo = TabPitch & {
  finger?: TabFinger;
  fingerLabel?: string;
};

const FINGER_LABELS: Record<TabFinger, string> = {
  食: "食指",
  中: "中指",
  名: "无名指",
  小: "小指",
};

function referenceStaffMidi(): number {
  const highEString = STANDARD_TUNING.find((guitarString) => guitarString.number === 1);
  if (!highEString) throw new Error("标准调弦中缺少 1 弦");
  return highEString.openMidi;
}

function midiOctave(midi: number): number {
  return Math.floor(midi / OCTAVE_SEMITONES) - 1;
}

/**
 * 将弦号与品位换算为实际音高及吉他谱面音高。
 * 吉他谱面比实际发声音高高一个八度；调弦数据来自 STANDARD_TUNING。
 */
export function deriveTabPitch(string: number, fret: number): TabPitch {
  const tuning = STANDARD_TUNING.find((guitarString) => guitarString.number === string);
  if (!tuning) throw new RangeError(`无效弦号：${string}`);
  if (!Number.isInteger(fret) || fret < 0) {
    throw new RangeError(`品位必须是非负整数：${fret}`);
  }

  const soundingMidi = tuning.openMidi + fret;
  const staffMidi = soundingMidi + OCTAVE_SEMITONES;

  return {
    string,
    fret,
    soundingMidi,
    staffMidi,
    staffName: spellNote(staffMidi, "flat"),
    staffOctave: midiOctave(staffMidi),
    staffSteps: midiToStaffSteps(staffMidi),
  };
}

/**
 * 谱面半音步数：0 对应 E4（高音谱表最下面一线），每升高一个半音加 1。
 * 此步数按项目约定表示半音距离，不代表传统五线谱的全音阶线间位置。
 */
export function midiToStaffSteps(midi: number): number {
  return midi - referenceStaffMidi();
}

/** 将谱面半音步数还原成 MIDI 音高；0 对应 E4。 */
export function staffStepsToMidi(steps: number): number {
  return referenceStaffMidi() + steps;
}

/** 从弦号与品位直接得到相对 E4 的谱面半音步数。 */
export function fretToStaffSteps(string: number, fret: number): number {
  return deriveTabPitch(string, fret).staffSteps;
}

/** 将曲谱数据与推导音高合并，提供组件显示用的指法全名。 */
export function deriveTabNoteInfo(
  note: Pick<TabNote, "string" | "fret" | "finger">,
): TabNoteInfo {
  return {
    ...deriveTabPitch(note.string, note.fret),
    finger: note.finger,
    fingerLabel: note.finger ? FINGER_LABELS[note.finger] : undefined,
  };
}

export type RhythmGroup = {
  /** 该组第一个音符在小节内的下标。 */
  start: number;
  notes: readonly TabNote[];
  /** 符杠数量；0 表示单音，不画横杠。 */
  beams: number;
  triplet: boolean;
};

/**
 * 把一小节音符按符杠分组。
 * 八分音符每 4 个一组（4/4 拍里的两个拍点），三连音每 3 个一组，
 * 十六分音符每 4 个一组；四分音符单独成组。
 */
export function groupNotesForRhythm(notes: readonly TabNote[]): RhythmGroup[] {
  const groups: RhythmGroup[] = [];
  let index = 0;

  while (index < notes.length) {
    const duration = notes[index].duration;

    if (duration === "q") {
      groups.push({ start: index, notes: [notes[index]], beams: 0, triplet: false });
      index += 1;
      continue;
    }

    let runEnd = index + 1;
    while (runEnd < notes.length && notes[runEnd].duration === duration) runEnd += 1;

    const groupSize = duration === "8t" ? 3 : 4;
    for (let start = index; start < runEnd; start += groupSize) {
      groups.push({
        start,
        notes: notes.slice(start, Math.min(start + groupSize, runEnd)),
        beams: duration === "16" ? 2 : 1,
        triplet: duration === "8t",
      });
    }

    index = runEnd;
  }

  return groups;
}

/**
 * 给读屏使用的小节文字说明。
 * 连续在同一根弦上的音会合并，避免把「6 弦」重复几十遍。
 */
export function describeMeasureNotes(measure: TabMeasure): string {
  const runs: { string: number; frets: number[] }[] = [];

  for (const note of measure.notes) {
    const last = runs[runs.length - 1];
    if (last && last.string === note.string) {
      last.frets.push(note.fret);
    } else {
      runs.push({ string: note.string, frets: [note.fret] });
    }
  }

  return runs.map((run) => `${run.string} 弦 ${run.frets.join("、")} 品`).join("；");
}
