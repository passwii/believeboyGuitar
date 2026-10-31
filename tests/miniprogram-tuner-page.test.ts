import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ts = readFileSync("miniprogram/pages/tuner/index.ts", "utf8");
const wxml = readFileSync("miniprogram/pages/tuner/index.wxml", "utf8");
const gaugeTsPath = "miniprogram/components/tuner-gauge/index.ts";
const gaugeWxmlPath = "miniprogram/components/tuner-gauge/index.wxml";
const gaugeTs = existsSync(gaugeTsPath) ? readFileSync(gaugeTsPath, "utf8") : "";
const gaugeWxml = existsSync(gaugeWxmlPath)
  ? readFileSync(gaugeWxmlPath, "utf8")
  : "";

describe("tuner page", () => {
  it("requests microphone permission and stops on hide and unload", () => {
    expect(ts).toContain("scope.record");
    expect(ts).toContain("onHide()");
    expect(ts).toContain("onUnload()");
    expect(ts).toContain("stopTuning()");
    expect(ts).toContain("wx.openSetting");
  });

  it("uses 4096-sample pitch detection and median smoothing", () => {
    expect(ts).toContain("new PitchDetector");
    expect(ts).toContain("medianFrequency");
    expect(ts).toContain("frameSize: 8");
    expect(ts).toContain("minFrequency: 55");
    expect(ts).toContain("maxFrequency: 400");
  });

  it("renders automatic, manual and chromatic states", () => {
    expect(wxml).toContain("自动");
    expect(wxml).toContain("手动锁弦");
    expect(wxml).toContain("半音阶");
    expect(wxml).toContain("tuner-gauge");
  });

  it("keeps spoken direction and note cues available in the gauge", () => {
    expect(gaugeWxml).toContain("aria-label=");
    expect(gaugeWxml).toContain("directionText");
    expect(gaugeWxml).toContain("已调准");
    expect(gaugeTs).toContain("Math.max(-50, Math.min(50, cents))");
    expect(gaugeTs).toContain("needlePercent");
  });

  it("exposes the stable state only after an in-tune interval", () => {
    expect(ts).toContain("200");
    expect(ts).toContain("Math.abs(cents) <= 3");
    expect(ts).toContain("medianFrequency");
  });
});
