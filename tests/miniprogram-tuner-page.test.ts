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

describe("tuner page platform wiring", () => {
  it("requests microphone permission and handles denial through settings", () => {
    expect(ts).toContain('scope: "scope.record"');
    expect(ts).toContain('wx.getSetting');
    expect(ts).toContain("wx.authorize");
    expect(ts).toContain("wx.showModal");
    expect(ts).toContain("controller.setPermissionResult(permitted)");
    expect(ts).toContain("wx.openSetting");
  });

  it("stops and releases recording on hide and unload", () => {
    expect(ts).toContain("onHide()");
    expect(ts).toContain("onUnload()");
    expect(ts).toContain("this.stopTuning()");
    expect(ts).toContain("runtime.recorder?.dispose()");
    expect(ts).toContain("this.setData(controller.stop())");
  });

  it("delegates PCM frames and user actions to the controller", () => {
    expect(ts).toContain("frameSize: 8");
    expect(ts).toContain("controller.handleFrame(samples, sampleRate)");
    expect(ts).toContain("controller.cyclePreset()");
    expect(ts).toContain("controller.resetMode()");
    expect(ts).toContain("controller.selectString(");
  });

  it("renders automatic, manual and chromatic controls", () => {
    expect(wxml).toContain("自动");
    expect(wxml).toContain("手动锁弦");
    expect(wxml).toContain("半音阶");
    expect(wxml).toContain("tuner-gauge");
  });

  it("keeps direction and stable cues accessible in the gauge", () => {
    expect(gaugeWxml).toContain("aria-label=");
    expect(gaugeWxml).toContain("directionText");
    expect(gaugeWxml).toContain("已调准");
    expect(gaugeTs).toContain("Math.max(-50, Math.min(50, cents))");
    expect(gaugeTs).toContain("needlePercent");
  });
});
