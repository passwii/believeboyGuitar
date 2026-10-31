import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

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

describe("tuner page/controller recording lifecycle", () => {
  it("clears the reading and leaves listening after an unexpected recorder stop", async () => {
    vi.resetModules();
    const callbacks: Record<string, (value?: any) => void> = {};
    const register = (event: string) => (callback: (value?: any) => void) => {
      callbacks[event] = callback;
    };
    const unregister = (event: string) => (callback?: (value?: any) => void) => {
      if (callbacks[event] === callback) delete callbacks[event];
    };
    const recorder = {
      onStart: vi.fn(register("start")),
      onStop: vi.fn(register("stop")),
      onError: vi.fn(register("error")),
      onFrameRecorded: vi.fn(register("frame")),
      offStart: vi.fn(unregister("start")),
      offStop: vi.fn(unregister("stop")),
      offError: vi.fn(unregister("error")),
      offFrameRecorded: vi.fn(unregister("frame")),
      start: vi.fn(() => callbacks.start?.()),
      stop: vi.fn(() => callbacks.stop?.({ duration: 1000 })),
      emitFrame(frameBuffer: ArrayBuffer) {
        callbacks.frame?.({ frameBuffer, isLastFrame: false });
      },
      emitUnexpectedStop() {
        callbacks.stop?.({ duration: 1000 });
      },
    };
    let definition: any;
    vi.stubGlobal("Page", (pageDefinition: any) => {
      definition = pageDefinition;
    });
    vi.stubGlobal("wx", {
      getSetting: vi.fn(({ success }: any) =>
        success({ authSetting: { "scope.record": true } }),
      ),
      getRecorderManager: vi.fn(() => recorder),
    });

    try {
      await import("../miniprogram/pages/tuner/index");
      const instance = {
        data: { ...definition.data },
        setData(update: Record<string, unknown>) {
          Object.assign(this.data, update);
        },
      };
      definition.onLoad.call(instance);
      await definition.startTuning.call(instance);

      const sampleRate = 48000;
      const frameBuffer = new ArrayBuffer(4096 * 2);
      const view = new DataView(frameBuffer);
      for (let index = 0; index < 4096; index += 1) {
        const sample = 0.5 * Math.sin((2 * Math.PI * 82.4069 * index) / sampleRate);
        view.setInt16(index * 2, Math.round(sample * 32767), true);
      }
      recorder.emitFrame(frameBuffer);
      expect(instance.data).toMatchObject({ listening: true, noteText: "E2" });

      recorder.emitUnexpectedStop();

      expect(instance.data).toMatchObject({
        state: "error",
        listening: false,
        statusText: "录音意外停止，请重新开始调音",
        noteText: "—",
        cents: 0,
        directionText: "等待声音",
        stable: false,
      });
      expect(recorder.offStop).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
