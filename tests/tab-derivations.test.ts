import { describe, expect, it } from "vitest";
import {
  deriveTabNoteInfo,
  deriveTabPitch,
  fretToStaffSteps,
  midiToStaffSteps,
  staffStepsToMidi,
} from "@/lib/tab";

describe("TAB 音高推导", () => {
  it("从 6 弦 5–8 品推导吉他低八度记谱音高", () => {
    const cases = [
      { fret: 5, name: "A", octave: 3, midi: 57, steps: -7 },
      { fret: 6, name: "Bb", octave: 3, midi: 58, steps: -6 },
      { fret: 7, name: "B", octave: 3, midi: 59, steps: -5 },
      { fret: 8, name: "C", octave: 4, midi: 60, steps: -4 },
    ] as const;

    for (const expected of cases) {
      const pitch = deriveTabPitch(6, expected.fret);
      expect(pitch.staffName).toBe(expected.name);
      expect(pitch.staffOctave).toBe(expected.octave);
      expect(pitch.staffMidi).toBe(expected.midi);
      expect(pitch.staffSteps).toBe(expected.steps);
    }
  });

  it("steps 的零点是 E4，每半音增减一步", () => {
    expect(midiToStaffSteps(64)).toBe(0);
    expect(midiToStaffSteps(65)).toBe(1);
    expect(midiToStaffSteps(63)).toBe(-1);
    expect(staffStepsToMidi(0)).toBe(64);
    expect(staffStepsToMidi(1)).toBe(65);
    expect(fretToStaffSteps(6, 5)).toBe(-7);
  });

  it("音名和指法信息可以组合成显示数据", () => {
    const info = deriveTabNoteInfo({ string: 6, fret: 5, finger: "食" });
    expect(info.staffName).toBe("A");
    expect(info.fingerLabel).toBe("食指");
  });

  it("对无效弦号或非整数品位给出明确错误", () => {
    expect(() => deriveTabPitch(7, 5)).toThrow("无效弦号");
    expect(() => deriveTabPitch(6, -1)).toThrow("品位必须是非负整数");
  });
});
