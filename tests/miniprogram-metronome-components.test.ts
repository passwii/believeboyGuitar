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
    expect(wxml).toContain('aria-valuemin="30"');
    expect(wxml).toContain('aria-valuemax="240"');
    expect(wxml).toContain("aria-valuetext");
    expect(wxml).toContain("dial__readout");
    expect(ts).toContain("dialPointToBpm");
    expect(ts).toContain("bpmToDialAngle");
    expect(ts).toContain("clampBpm(dialPointToBpm(dx, dy))");
    expect(ts).not.toContain("min: { type: Number");
    expect(ts).not.toContain("max: { type: Number");
    expect(ts).toContain("prepareCanvas");
    expect(ts).toContain("context.scale(dpr, dpr)");
    expect(ts).toContain("width: item.width");
    expect(ts).toContain("height: item.height");
    expect(ts).toContain("const centerX = width / 2");
    expect(ts).toContain("const centerY = height / 2");
    expect(ts).toContain("rect.left + rect.width / 2");
    expect(ts).toContain("Math.hypot(dx, dy)");
    expect(ts).toContain('triggerEvent("change"');
    expect(wxss).toMatch(/\.dial\s*\{[^}]*position:\s*absolute/);
    expect(wxss).toContain("top: 0");
    expect(wxss).toContain("right: 0");
    expect(wxss).toContain("bottom: 0");
    expect(wxss).toContain("left: 0");
    expect(wxml).toContain('class="dial__ratio"');
    expect(wxss).not.toContain("aspect-ratio");
    expect(wxss).toMatch(/\.dial__ratio\s*\{[^}]*padding-top:\s*100%/);
    expect(wxss).toMatch(/min-width:\s*44px/);
    expect(wxss).toMatch(/min-height:\s*44px/);
  });

  it("renders one beat block per beat", () => {
    const wxml = read("miniprogram/components/beat-strip/index.wxml");
    const ts = read("miniprogram/components/beat-strip/index.ts");
    expect(wxml).toContain("wx:for");
    expect(wxml).toContain('wx:for="{{beatItems}}"');
    expect(wxml).toContain("beat--active");
    expect(wxml).toContain("beat--accent");
    expect(wxml).toContain("{{index + 1}}");
    expect(ts).toContain("beatItems");
    expect(ts).toContain("beats(count: number)");
  });
});
