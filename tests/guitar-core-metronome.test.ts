import { describe, expect, it } from "vitest";
import {
  BPM_DEFAULT,
  METERS,
  bpmToIntervalMs,
  nextBeat,
} from "../packages/guitar-core/src/metronome";

describe("shared metronome core", () => {
  it("keeps the current metronome model", () => {
    expect(BPM_DEFAULT).toBe(90);
    expect(METERS.map((meter) => meter.label)).toEqual([
      "4/4",
      "3/4",
      "2/4",
      "6/8",
      "5/4",
      "7/8",
    ]);
    expect(bpmToIntervalMs(120)).toBe(500);
    expect(nextBeat(3, METERS[0])).toBe(0);
  });
});
