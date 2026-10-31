import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ts = readFileSync("miniprogram/pages/metronome/index.ts", "utf8");
const wxml = readFileSync("miniprogram/pages/metronome/index.wxml", "utf8");

describe("metronome page", () => {
  it("uses the audio clock lookahead scheduler", () => {
    expect(ts).toContain("LOOKAHEAD_MS = 25");
    expect(ts).toContain("SCHEDULE_AHEAD_S = 0.12");
    expect(ts).toContain("createMetronomeAudio");
  });

  it("stops on hide and unload", () => {
    expect(ts).toContain("onHide()");
    expect(ts).toContain("onUnload()");
    expect(ts).toContain("this.stop()");
  });

  it("keeps the screen awake while running", () => {
    expect(ts).toContain("setKeepScreenOn");
    expect(wxml).toContain("bpm-dial");
    expect(wxml).toContain("beat-strip");
  });
});
