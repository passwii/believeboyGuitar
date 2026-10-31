import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("metronome components", () => {
  it("uses a canvas dial with touch and slider semantics", () => {
    const wxml = read("miniprogram/components/bpm-dial/index.wxml");
    const ts = read("miniprogram/components/bpm-dial/index.ts");
    const wxss = read("miniprogram/components/bpm-dial/index.wxss");
    expect(wxml).toContain('type="2d"');
    expect(wxml).toContain("bindtouchstart");
    expect(wxml).toContain("bindtouchmove");
    expect(wxml).toContain("bindtouchend");
    expect(wxml).toContain('aria-role="slider"');
    expect(wxml).toContain('aria-label="速度"');
    expect(wxml).toContain("aria-value" + "now");
    expect(wxml).toContain("aria-valuetext");
    expect(wxml).toContain("dial__readout");
    expect(ts).toContain("dialPointToBpm");
    expect(ts).toContain("bpmToDialAngle");
    expect(ts).toContain("prepareCanvas");
    expect(ts).toContain("context.scale(dpr, dpr)");
    expect(ts).toContain("Math.hypot(dx, dy)");
    expect(ts).toContain('triggerEvent("change"');
    expect(wxss).toMatch(/min-(?:width|height):\s*88rpx/);
  });

  it("renders one beat block per beat", () => {
    const wxml = read("miniprogram/components/beat-strip/index.wxml");
    expect(wxml).toContain("wx:for");
    expect(wxml).toContain("beat--active");
    expect(wxml).toContain("beat--accent");
    expect(wxml).toContain("{{index + 1}}");
  });
});
