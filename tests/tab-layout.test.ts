import { describe, expect, it } from "vitest";
import {
  TAB_LAYOUT,
  tabBeamRowY,
  tabBeamYs,
  tabFretBaselineY,
  tabMeasureGroupsByWidth,
  tabMeasureWidth,
  tabNoteFontSize,
  tabNoteX,
  tabStemSpan,
  tabStringY,
  tabSystemWidth,
  tabTripletMark,
} from "@/lib/tab-layout";

/**
 * 谱面几何的守护测试。
 *
 * 这一组锁住的是「节奏符号必须贴着品位数字」：符杠的高度跟着音符走，符干一路
 * 落到数字上沿。曾经符干断在谱面顶部、离数字一百多个单位，读起来像谱面顶上
 * 另起了一行符号。
 */

describe("TAB 谱面几何", () => {
  it("六线等距排列，一弦在最上面", () => {
    expect(tabStringY(0, 1)).toBe(TAB_LAYOUT.staffTop);
    expect(tabStringY(0, 6)).toBe(TAB_LAYOUT.staffTop + 5 * TAB_LAYOUT.stringGap);
    expect(tabStringY(0, 2) - tabStringY(0, 1)).toBe(TAB_LAYOUT.stringGap);
  });

  it("第二个谱表整体下移一个谱表高度", () => {
    expect(tabStringY(TAB_LAYOUT.systemHeight, 6) - tabStringY(0, 6)).toBe(
      TAB_LAYOUT.systemHeight,
    );
  });

  it("音符均分小节，首尾音符都不压小节线", () => {
    const measureX = TAB_LAYOUT.systemPadX;
    const count = 12;
    const first = tabNoteX(measureX, 0, count);
    const last = tabNoteX(measureX, count - 1, count);

    // 数字半宽按密集字号估，左右都留在小节线以内
    const halfDigit = TAB_LAYOUT.denseNoteFontSize * 0.62 * 0.5;
    expect(first - halfDigit).toBeGreaterThan(measureX);
    expect(last + halfDigit).toBeLessThan(measureX + TAB_LAYOUT.measureWidth);
  });

  it("音符挤到一起时换小字号", () => {
    expect(tabNoteFontSize(8)).toBe(TAB_LAYOUT.noteFontSize);
    expect(tabNoteFontSize(TAB_LAYOUT.denseNoteCount)).toBe(TAB_LAYOUT.denseNoteFontSize);
  });

  it("品位数字以弦线为中心", () => {
    const stringY = tabStringY(0, 4);
    const baseline = tabFretBaselineY(stringY);
    expect(baseline - stringY).toBe(5);
    // 15px 等宽数字的字形高度约 0.78em，基线上方 11.7、下方 3.3
    expect(baseline - TAB_LAYOUT.noteFontSize * TAB_LAYOUT.fretGlyphTop).toBeLessThan(stringY);
    expect(stringY - (baseline - TAB_LAYOUT.noteFontSize * TAB_LAYOUT.fretGlyphTop)).toBeCloseTo(6.7);
  });

  it("符干从符杠落到数字上沿，不悬在半空", () => {
    const stringY = tabStringY(0, 6);
    const beamY = tabBeamRowY(stringY);
    const stem = tabStemSpan({ stringY, fontSize: TAB_LAYOUT.noteFontSize, beamY });

    expect(stem.top).toBe(beamY);
    expect(stem.bottom).toBeGreaterThan(stringY - 14);
    expect(stem.bottom).toBeLessThan(stringY);
    // 符干短而清楚：不跨到别的弦上去
    expect(stem.bottom - stem.top).toBeGreaterThan(10);
    expect(stem.bottom - stem.top).toBeLessThan(TAB_LAYOUT.stringGap);
  });

  it("符杠贴着最高那个音符，不会飘到谱面顶上", () => {
    const lowString = tabStringY(0, 6);
    const highString = tabStringY(0, 1);

    expect(tabBeamRowY(lowString)).toBe(lowString - TAB_LAYOUT.stemLength);
    expect(tabBeamRowY(lowString)).toBeGreaterThan(TAB_LAYOUT.staffTop);
    // 音符靠到一弦时符杠才升到谱表上方，并给三连音标记留出余量
    expect(tabBeamRowY(highString)).toBe(TAB_LAYOUT.rhythmFloor);
    expect(tabBeamRowY(highString)).toBeLessThan(TAB_LAYOUT.staffTop);
  });

  it("十六分音符两条符杠，间距固定", () => {
    expect(tabBeamYs(24, 2)).toEqual([24, 24 + TAB_LAYOUT.beamGap]);
    expect(tabBeamYs(24, 1)).toEqual([24]);
  });

  it("三连音的括号与数字都在符杠上方", () => {
    const mark = tabTripletMark(100, 40, 120);
    expect(mark.centerX).toBe(80);
    expect(mark.tickY).toBeGreaterThan(mark.lineY);
    expect(mark.lineY).toBeLessThan(100);
    expect(mark.labelY).toBeLessThan(mark.lineY);
  });

  it("谱表宽度按小节数与留白算出来", () => {
    expect(tabSystemWidth()).toBe(
      TAB_LAYOUT.systemPadX * 2 + TAB_LAYOUT.measureWidth * TAB_LAYOUT.measuresPerSystem,
    );
  });

  it("手机谱表优先两小节一行，密集小节自然退成一节一行", () => {
    const normal = tabMeasureWidth(8);
    const triplet = tabMeasureWidth(12);
    const sixteenth = tabMeasureWidth(16);

    expect(tabMeasureGroupsByWidth([normal, normal, normal, normal])).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(tabMeasureGroupsByWidth([triplet, triplet, triplet, triplet])).toEqual([
      [0],
      [1],
      [2],
      [3],
    ]);
    expect(tabMeasureGroupsByWidth([normal, triplet, normal, normal])).toEqual([
      [0],
      [1],
      [2, 3],
    ]);
    expect(tabMeasureGroupsByWidth([sixteenth])).toEqual([[0]]);
  });

  it("密集小节自动加宽，十六分音符有足够的横向间距", () => {
    const eighthWidth = tabMeasureWidth(8);
    const tripletWidth = tabMeasureWidth(12);
    const sixteenthWidth = tabMeasureWidth(16);

    expect(eighthWidth).toBe(TAB_LAYOUT.measureWidth);
    expect(tripletWidth).toBeGreaterThan(eighthWidth);
    expect(sixteenthWidth).toBeGreaterThan(tripletWidth);
    expect(
      sixteenthWidth - TAB_LAYOUT.measurePadX * 2,
    ).toBe(16 * TAB_LAYOUT.minNoteSpacing);
    expect(tabSystemWidth([sixteenthWidth, sixteenthWidth, sixteenthWidth, sixteenthWidth])).toBe(
      TAB_LAYOUT.systemPadX * 2 + sixteenthWidth * 4,
    );
  });
});
