import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Metronome } from "@/components/Metronome";
import {
  DEFAULT_METER,
  METERS,
  accentIndexes,
  beatLevel,
  toggleMeterAccent,
  type Meter,
} from "@/lib/metronome";
import {
  WEAK_GAIN_RATIO,
  WEAK_PITCH_RATIO,
  clickParams,
  isAccentBeat,
} from "@/lib/metronome-audio";

describe("Stage 1 拍子柱状图与双格重音系统", () => {
  it("支持所有拍号（4/4、3/4、2/4、6/8、5/4、7/8），每拍渲染对应数量的柱状图", () => {
    for (const meter of METERS) {
      expect(meter.beatsPerBar).toBeGreaterThanOrEqual(2);
      expect(accentIndexes(meter).length).toBeGreaterThan(0);
    }
  });

  it("首屏渲染默认 4/4 拍，包含移动端与桌面端各 4 个柱状图按钮", () => {
    const html = renderToStaticMarkup(createElement(Metronome));
    const barButtons = [...html.matchAll(/aria-label="第 \d+ 拍重音设置，当前为 [12] 格/g)];
    // 移动端 4 个 + 桌面端 4 个 = 共 8 个拍柱按钮
    expect(barButtons).toHaveLength(DEFAULT_METER.beatsPerBar * 2);
  });

  it("双格 Level 系统：每个柱状图包含两个方块（Level 1 为 1 格常规，Level 2 为 2 格重音）", () => {
    const meter44 = METERS[0];
    // 第 1 拍为 Level 2（两个格子），其余为 Level 1（一个格子）
    expect(beatLevel(meter44, 0)).toBe(2);
    expect(beatLevel(meter44, 1)).toBe(1);
    expect(beatLevel(meter44, 2)).toBe(1);
    expect(beatLevel(meter44, 3)).toBe(1);

    // 6/8 拍第 1 拍与第 4 拍为 Level 2
    const meter68 = METERS.find((m) => m.label === "6/8")!;
    expect(beatLevel(meter68, 0)).toBe(2);
    expect(beatLevel(meter68, 1)).toBe(1);
    expect(beatLevel(meter68, 2)).toBe(1);
    expect(beatLevel(meter68, 3)).toBe(2);
    expect(beatLevel(meter68, 4)).toBe(1);
    expect(beatLevel(meter68, 5)).toBe(1);
  });

  it("点击柱状图可在 1 格与 2 格之间自由切换，支持自定义重音型（如 1/3 拍双重音）", () => {
    let current = DEFAULT_METER;
    expect(current.accents).toEqual([0]);

    // 开启第 3 拍重音：第 1 拍与第 3 拍双重音
    current = toggleMeterAccent(current, 2);
    expect(current.accents).toEqual([0, 2]);
    expect(beatLevel(current, 0)).toBe(2);
    expect(beatLevel(current, 1)).toBe(1);
    expect(beatLevel(current, 2)).toBe(2);
    expect(beatLevel(current, 3)).toBe(1);

    // 取消第 1 拍重音：仅第 3 拍重音
    current = toggleMeterAccent(current, 0);
    expect(current.accents).toEqual([2]);
    expect(beatLevel(current, 0)).toBe(1);
    expect(beatLevel(current, 2)).toBe(2);

    // 再次点击第 3 拍：全部降为 Level 1（平拍无重音）
    current = toggleMeterAccent(current, 2);
    expect(current.accents).toEqual([]);
    expect(beatLevel(current, 0)).toBe(1);
    expect(beatLevel(current, 1)).toBe(1);
    expect(beatLevel(current, 2)).toBe(1);
    expect(beatLevel(current, 3)).toBe(1);
  });

  it("音频调度联动：Level 2 播放高频重拍，Level 1 播放常规弱拍", () => {
    const meterWithCustomAccents: Meter = {
      label: "4/4",
      beatsPerBar: 4,
      beatUnit: 4,
      accents: [0, 2], // 1、3 拍重音
      description: "双重音",
    };

    for (const timbre of ["wood", "electronic", "mechanical"] as const) {
      const accentClick = clickParams(timbre, true);
      const regularClick = clickParams(timbre, false);

      // Level 2 重拍：原基频，原音量
      expect(accentClick.frequency).toBeGreaterThan(regularClick.frequency);
      expect(accentClick.peak).toBeGreaterThan(regularClick.peak);

      // Level 1 常规弱拍：降频约 0.72 倍，音量降低 -6dB
      expect(regularClick.frequency).toBeCloseTo(accentClick.frequency * WEAK_PITCH_RATIO, 4);
      expect(regularClick.peak).toBeCloseTo(accentClick.peak * WEAK_GAIN_RATIO, 4);

      // 与 isAccentBeat 联动
      expect(isAccentBeat(0, meterWithCustomAccents)).toBe(true);
      expect(isAccentBeat(1, meterWithCustomAccents)).toBe(false);
      expect(isAccentBeat(2, meterWithCustomAccents)).toBe(true);
      expect(isAccentBeat(3, meterWithCustomAccents)).toBe(false);
    }
  });

  it("所有拍柱触摸目标均满足 >= 44px（min-h-11）", () => {
    const html = renderToStaticMarkup(createElement(Metronome));
    const barButtons = [...html.matchAll(/<button\b[^>]*?aria-label="第 \d+ 拍重音设置[^>]*class="([^"]*)"/g)].map(
      (m) => m[1],
    );

    expect(barButtons.length).toBeGreaterThanOrEqual(8);
    for (const className of barButtons) {
      expect(className).toMatch(/\bmin-h-11\b/);
    }
  });

  it("屏幕阅读器无障碍描述完整标明拍号、当前格数与重音属性", () => {
    const html = renderToStaticMarkup(createElement(Metronome));
    expect(html).toContain('aria-label="第 1 拍重音设置，当前为 2 格（重音拍），点击切换"');
    expect(html).toContain('aria-label="第 2 拍重音设置，当前为 1 格（常规拍），点击切换"');
    expect(html).toContain('aria-label="第 3 拍重音设置，当前为 1 格（常规拍），点击切换"');
    expect(html).toContain('aria-label="第 4 拍重音设置，当前为 1 格（常规拍），点击切换"');
  });
});
