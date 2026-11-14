import { describe, expect, it } from "vitest";
import {
  BPM_DEFAULT,
  METERS,
  bpmToIntervalMs,
  nextBeat,
  toggleMeterAccent,
  beatLevel,
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

  it("支持双格重音 Level 1 与 Level 2 的查询与切换", () => {
    const meter44 = METERS[0]; // 4/4, 默认 accents: [0]
    // 第 1 拍默认是重音（Level 2），第 2/3/4 拍是常规（Level 1）
    expect(beatLevel(meter44, 0)).toBe(2);
    expect(beatLevel(meter44, 1)).toBe(1);
    expect(beatLevel(meter44, 2)).toBe(1);
    expect(beatLevel(meter44, 3)).toBe(1);

    // 点击第 3 拍（索引 2）增加到 Level 2：第 1 拍和第 3 拍双重音
    const doubleAccent = toggleMeterAccent(meter44, 2);
    expect(doubleAccent.accents).toEqual([0, 2]);
    expect(beatLevel(doubleAccent, 0)).toBe(2);
    expect(beatLevel(doubleAccent, 1)).toBe(1);
    expect(beatLevel(doubleAccent, 2)).toBe(2);
    expect(beatLevel(doubleAccent, 3)).toBe(1);

    // 再次点击第 1 拍（索引 0）减少到 Level 1
    const onlyThirdAccent = toggleMeterAccent(doubleAccent, 0);
    expect(onlyThirdAccent.accents).toEqual([2]);
    expect(beatLevel(onlyThirdAccent, 0)).toBe(1);
    expect(beatLevel(onlyThirdAccent, 2)).toBe(2);

    // 非法索引安全防御，不改变模型
    expect(toggleMeterAccent(meter44, -1).accents).toEqual([0]);
    expect(toggleMeterAccent(meter44, 4).accents).toEqual([0]);
  });
});
