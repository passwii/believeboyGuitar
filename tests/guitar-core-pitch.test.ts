import { describe, expect, it } from "vitest";
import { PitchDetector } from "../packages/guitar-core/src/pitch";

const SAMPLE_RATE = 48000;
const FRAME_SIZE = 4096;

function sine(frequency: number, amplitude = 0.35): Float32Array {
  return Float32Array.from(
    { length: FRAME_SIZE },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE),
  );
}

function harmonic(frequency: number): Float32Array {
  return Float32Array.from({ length: FRAME_SIZE }, (_, index) => {
    const t = index / SAMPLE_RATE;
    return (
      0.22 * Math.sin(2 * Math.PI * frequency * t) +
      0.14 * Math.sin(4 * Math.PI * frequency * t) +
      0.07 * Math.sin(6 * Math.PI * frequency * t)
    );
  });
}

describe("PitchDetector", () => {
  const detector = new PitchDetector();

  it.each([82.4069, 110, 146.832, 195.998, 246.942, 329.628])(
    "detects %.4f Hz within one cent",
    (frequency) => {
      const reading = detector.detect(sine(frequency), SAMPLE_RATE);
      expect(reading).not.toBeNull();
      expect(1200 * Math.log2(reading!.frequency / frequency)).toBeCloseTo(0, 0);
      expect(reading!.clarity).toBeGreaterThan(0.9);
    },
  );

  it.each([55, 400])("detects the %d Hz range boundary", (frequency) => {
    const reading = detector.detect(sine(frequency), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(reading!.frequency).toBeGreaterThanOrEqual(55);
    expect(reading!.frequency).toBeLessThanOrEqual(400);
    expect(1200 * Math.log2(reading!.frequency / frequency)).toBeCloseTo(0, 0);
  });

  it("handles a harmonic-rich guitar-like wave", () => {
    const reading = detector.detect(harmonic(82.4069), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(1200 * Math.log2(reading!.frequency / 82.4069)).toBeCloseTo(0, 0);
  });

  it("returns null for silence", () => {
    expect(detector.detect(new Float32Array(FRAME_SIZE), SAMPLE_RATE)).toBeNull();
  });

  it("returns null for unstable noise", () => {
    let state = 0x12345678;
    const noise = Float32Array.from({ length: FRAME_SIZE }, () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return (state / 0xffffffff - 0.5) * 0.8;
    });
    expect(detector.detect(noise, SAMPLE_RATE)).toBeNull();
  });

  it.each([
    { minFrequency: Number.NaN },
    { minFrequency: Number.POSITIVE_INFINITY },
    { minFrequency: Number.NEGATIVE_INFINITY },
    { maxFrequency: Number.NaN },
    { maxFrequency: Number.POSITIVE_INFINITY },
    { maxFrequency: Number.NEGATIVE_INFINITY },
    { clarityThreshold: Number.NaN },
    { clarityThreshold: Number.POSITIVE_INFINITY },
    { clarityThreshold: Number.NEGATIVE_INFINITY },
    { rmsThreshold: Number.NaN },
    { rmsThreshold: Number.POSITIVE_INFINITY },
    { rmsThreshold: Number.NEGATIVE_INFINITY },
  ])("rejects non-finite options: %o", (options) => {
    expect(() => new PitchDetector(options)).toThrow(RangeError);
  });

  it.each([
    { minFrequency: 0 },
    { maxFrequency: 0 },
    { minFrequency: 400, maxFrequency: 400 },
    { minFrequency: 401, maxFrequency: 400 },
    { clarityThreshold: -0.01 },
    { clarityThreshold: 1.01 },
    { rmsThreshold: -0.01 },
    { rmsThreshold: 1.01 },
  ])("rejects out-of-range options: %o", (options) => {
    expect(() => new PitchDetector(options)).toThrow(RangeError);
  });
});
