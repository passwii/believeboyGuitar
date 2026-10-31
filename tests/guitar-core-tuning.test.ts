import { describe, expect, it } from "vitest";
import {
  TUNING_PRESETS,
  centsBetween,
  describeCents,
  nearestString,
  noteAtFrequency,
} from "../packages/guitar-core/src/tuning";

describe("tuning core", () => {
  it("defines standard, drop D, half-step down and chromatic", () => {
    expect(TUNING_PRESETS.map((preset) => preset.id)).toEqual([
      "standard",
      "drop-d",
      "half-step-down",
      "chromatic",
    ]);
    expect(TUNING_PRESETS[0].strings.map((string) => string.frequency)).toEqual([
      82.4069,
      110,
      146.832,
      195.998,
      246.942,
      329.628,
    ]);
  });

  it("returns signed cents", () => {
    expect(centsBetween(440, 440)).toBe(0);
    expect(centsBetween(443.65, 440)).toBeCloseTo(14.27, 1);
    expect(centsBetween(436.39, 440)).toBeCloseTo(-14.27, 1);
  });

  it("selects the nearest string and describes direction", () => {
    const standard = TUNING_PRESETS[0];
    expect(nearestString(108.7, standard.strings).target.id).toBe("5");
    expect(describeCents(-12)).toBe("flat");
    expect(describeCents(2)).toBe("in-tune");
    expect(describeCents(9)).toBe("sharp");
  });

  it("names chromatic notes with sharp spelling", () => {
    expect(noteAtFrequency(440)).toMatchObject({
      name: "A",
      octave: 4,
      midi: 69,
    });
    expect(noteAtFrequency(82.4069)).toMatchObject({
      name: "E",
      octave: 2,
      midi: 40,
    });
  });
});
