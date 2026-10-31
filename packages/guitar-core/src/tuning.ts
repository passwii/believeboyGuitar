export type StringId = "6" | "5" | "4" | "3" | "2" | "1";

export type StringTarget = {
  id: StringId;
  label: string;
  note: string;
  octave: number;
  frequency: number;
};

export type TuningId =
  | "standard"
  | "drop-d"
  | "half-step-down"
  | "chromatic";

export type TuningPreset = {
  id: TuningId;
  label: string;
  strings: readonly StringTarget[];
};

const target = (
  id: StringId,
  note: string,
  octave: number,
  frequency: number,
): StringTarget => ({
  id,
  label: `${note}${octave}`,
  note,
  octave,
  frequency,
});

const STANDARD_STRINGS = [
  target("6", "E", 2, 82.4069),
  target("5", "A", 2, 110),
  target("4", "D", 3, 146.832),
  target("3", "G", 3, 195.998),
  target("2", "B", 3, 246.942),
  target("1", "E", 4, 329.628),
] as const;

const DROP_D_STRINGS = [
  target("6", "D", 2, 73.4162),
  ...STANDARD_STRINGS.slice(1),
] as const;

const HALF_STEP_DOWN_STRINGS = [
  target("6", "Eb", 2, 77.7817),
  target("5", "Ab", 2, 103.826),
  target("4", "Db", 3, 138.591),
  target("3", "Gb", 3, 184.997),
  target("2", "Bb", 3, 233.082),
  target("1", "Eb", 4, 311.127),
] as const;

export const TUNING_PRESETS: readonly TuningPreset[] = [
  { id: "standard", label: "标准调弦", strings: STANDARD_STRINGS },
  { id: "drop-d", label: "Drop D", strings: DROP_D_STRINGS },
  { id: "half-step-down", label: "降半音", strings: HALF_STEP_DOWN_STRINGS },
  { id: "chromatic", label: "半音阶", strings: [] },
];

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

export type StringReading = {
  target: StringTarget;
  cents: number;
};

export type ChromaticNote = {
  name: string;
  octave: number;
  midi: number;
  frequency: number;
  cents: number;
};

export function centsBetween(frequency: number, reference: number): number {
  if (
    !Number.isFinite(frequency) ||
    !Number.isFinite(reference) ||
    frequency <= 0 ||
    reference <= 0
  ) {
    throw new RangeError("frequency and reference must be finite and positive");
  }
  return 1200 * Math.log2(frequency / reference);
}

export function nearestString(
  frequency: number,
  strings: readonly StringTarget[],
): StringReading {
  if (strings.length === 0) {
    throw new RangeError("a tuning needs at least one string");
  }
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError("frequency must be finite and positive");
  }
  let chosen = strings[0];
  let difference = Math.abs(centsBetween(frequency, chosen.frequency));
  for (const string of strings.slice(1)) {
    const next = Math.abs(centsBetween(frequency, string.frequency));
    if (next < difference) {
      chosen = string;
      difference = next;
    }
  }
  return {
    target: chosen,
    cents: centsBetween(frequency, chosen.frequency),
  };
}

export function noteAtFrequency(frequency: number): ChromaticNote {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError("frequency must be finite and positive");
  }
  const exactMidi = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(exactMidi);
  const noteFrequency = 440 * 2 ** ((midi - 69) / 12);
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    midi,
    frequency: noteFrequency,
    cents: centsBetween(frequency, noteFrequency),
  };
}

export function describeCents(
  cents: number,
  tolerance = 3,
): "flat" | "in-tune" | "sharp" {
  if (!Number.isFinite(cents) || !Number.isFinite(tolerance)) {
    throw new RangeError("cents and tolerance must be finite");
  }
  if (Math.abs(cents) <= tolerance) return "in-tune";
  return cents < 0 ? "flat" : "sharp";
}
