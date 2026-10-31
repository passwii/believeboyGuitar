export type ScalePair = readonly [stringNumber: number, fret: number];

export type ScalePath = {
  id: number;
  label: string;
  colorClass: string;
  colorVar: string;
  notes: readonly ScalePair[];
};

export type ScaleNote = {
  key: string;
  stringNumber: number;
  fret: number;
  degree: number;
  noteName: string;
  pathIds: number[];
};

const OPEN_MIDI: Record<number, number> = {
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40,
};

const MAJOR_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const DEGREE_BY_PITCH_CLASS = new Map([
  [0, 1],
  [2, 2],
  [4, 3],
  [5, 4],
  [7, 5],
  [9, 6],
  [11, 7],
]);
const NOTE_NAME_BY_DEGREE = ["", "C", "D", "E", "F", "G", "A", "B"] as const;

/**
 * 六条两音一组路径。
 *
 * 每条路径按 CD → EF → GA → BC → DE → FG 走完六根弦，
 * 再回到起始弦补最后一组 AB。品位是使用者提供的实际练习位置。
 */
export const SCALE_PATHS: readonly ScalePath[] = [
  {
    id: 1,
    label: "6弦 CD",
    colorClass: "scale-color-1",
    colorVar: "var(--color-scale-1)",
    notes: [[6, 8], [6, 10], [5, 7], [5, 8], [4, 5], [4, 7], [3, 4], [3, 5], [2, 3], [2, 5], [1, 1], [1, 3], [6, 5], [6, 7]],
  },
  {
    id: 2,
    label: "5弦 CD",
    colorClass: "scale-color-2",
    colorVar: "var(--color-scale-2)",
    notes: [[5, 3], [5, 5], [4, 2], [4, 3], [3, 12], [3, 14], [2, 12], [2, 13], [1, 10], [1, 12], [6, 13], [6, 15], [5, 12], [5, 14]],
  },
  {
    id: 3,
    label: "4弦 CD",
    colorClass: "scale-color-3",
    colorVar: "var(--color-scale-3)",
    notes: [[4, 10], [4, 12], [3, 9], [3, 10], [2, 8], [2, 10], [1, 7], [1, 8], [6, 10], [6, 12], [5, 8], [5, 10], [4, 7], [4, 9]],
  },
  {
    id: 4,
    label: "3弦 CD",
    colorClass: "scale-color-4",
    colorVar: "var(--color-scale-4)",
    notes: [[3, 5], [3, 7], [2, 5], [2, 6], [1, 3], [1, 5], [6, 7], [6, 8], [5, 5], [5, 7], [4, 3], [4, 5], [3, 2], [3, 4]],
  },
  {
    id: 5,
    label: "2弦 CD",
    colorClass: "scale-color-5",
    colorVar: "var(--color-scale-5)",
    notes: [[2, 1], [2, 3], [1, 1], [1, 3], [6, 3], [6, 5], [5, 2], [5, 3], [4, 12], [4, 14], [3, 10], [3, 12], [2, 10], [2, 12]],
  },
  {
    id: 6,
    label: "1弦 CD",
    colorClass: "scale-color-6",
    colorVar: "var(--color-scale-6)",
    notes: [[1, 8], [1, 10], [6, 12], [6, 13], [5, 10], [5, 12], [4, 9], [4, 10], [3, 7], [3, 9], [2, 6], [2, 8], [1, 5], [1, 7]],
  },
];

export function buildScaleNotes(paths: readonly ScalePath[] = SCALE_PATHS): ScaleNote[] {
  const notes = new Map<string, ScaleNote>();
  for (const path of paths) {
    for (const [stringNumber, fret] of path.notes) {
      const openMidi = OPEN_MIDI[stringNumber];
      if (openMidi === undefined) throw new Error(`未知弦号：${stringNumber}`);
      const pitchClass = (openMidi + fret) % 12;
      if (!MAJOR_PITCH_CLASSES.has(pitchClass)) {
        throw new Error(`路径 ${path.id} 含非 C 大调音位：${stringNumber} 弦 ${fret} 品`);
      }
      const degree = DEGREE_BY_PITCH_CLASS.get(pitchClass);
      if (!degree) throw new Error("无法读取音级");
      const key = `${stringNumber}-${fret}`;
      const existing = notes.get(key) ?? {
        key,
        stringNumber,
        fret,
        degree,
        noteName: NOTE_NAME_BY_DEGREE[degree],
        pathIds: [],
      };
      if (!existing.pathIds.includes(path.id)) existing.pathIds.push(path.id);
      notes.set(key, existing);
    }
  }
  return [...notes.values()].sort(
    (a, b) => a.stringNumber - b.stringNumber || a.fret - b.fret,
  );
}
