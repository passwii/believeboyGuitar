import { describe, expect, it } from "vitest";
import { pcm16ToFloat32, removeDc, rms } from "../packages/guitar-core/src/pcm";

function pcm(...values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 2);
  const view = new DataView(buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, true));
  return buffer;
}

describe("PCM helpers", () => {
  it("converts little-endian PCM16", () => {
    expect(Array.from(pcm16ToFloat32(pcm(0, 32767, -32768)))).toEqual([
      0,
      32767 / 32768,
      -1,
    ]);
  });

  it("removes DC and reports RMS", () => {
    const samples = new Float32Array([1, -1, 1, -1]);
    expect(rms(samples)).toBeCloseTo(1);
    const centered = removeDc(new Float32Array([1, 1, 1, 1]));
    expect(Array.from(centered)).toEqual([0, 0, 0, 0]);
  });

  it("rejects an odd byte length", () => {
    expect(() => pcm16ToFloat32(new ArrayBuffer(3))).toThrow(RangeError);
  });
});
