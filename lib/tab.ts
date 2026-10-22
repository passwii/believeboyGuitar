import { STANDARD_TUNING, spellNote } from "@/lib/guitar";
import type { Finger, TabNote } from "@/lib/tab-exercises";

const OCTAVE_SEMITONES = 12;

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
  finger: Finger;
  fingerLabel: string;
};

const FINGER_LABELS: Record<Finger, string> = {
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
    fingerLabel: FINGER_LABELS[note.finger],
  };
}
