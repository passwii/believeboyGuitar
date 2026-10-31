import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

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

  it("does not release a newer run's wake lock when an older start fails", async () => {
    vi.resetModules();
    let rejectFirstResume: (error: Error) => void = () => undefined;
    const firstResume = new Promise<void>((_resolve, reject) => {
      rejectFirstResume = reject;
    });
    const locks: boolean[] = [];
    const makeAudio = (resume: () => Promise<void>) => ({
      currentTime: 10,
      setTimbre: vi.fn(),
      resume,
      schedule: vi.fn(),
      cancelFrom: vi.fn(),
      dispose: vi.fn(async () => undefined),
    });
    const firstAudio = makeAudio(() => firstResume);
    const secondAudio = makeAudio(async () => undefined);
    const createAudio = vi.fn().mockReturnValueOnce(firstAudio).mockReturnValueOnce(secondAudio);
    let pageDefinition: any;
    let pageInstance: any;
    vi.doMock("../miniprogram/adapters/metronome-audio", () => ({
      TIMBRES: [
        { id: "wood", label: "木质" },
        { id: "electronic", label: "电子" },
        { id: "mechanical", label: "机械" },
      ],
      createMetronomeAudio: createAudio,
    }));
    vi.stubGlobal("Page", (definition: any) => {
      pageDefinition = definition;
    });
    vi.stubGlobal("wx", {
      createWebAudioContext: vi.fn(),
      setKeepScreenOn: vi.fn(({ keepScreenOn }: { keepScreenOn: boolean }) => {
        locks.push(keepScreenOn);
      }),
    });

    try {
      await import("../miniprogram/pages/metronome/index");
      pageInstance = {
        data: { ...pageDefinition.data },
        setData(update: Record<string, unknown>) {
          Object.assign(this.data, update);
        },
        tick() {
          pageDefinition.tick.call(this);
        },
      };
      const staleStart = pageDefinition.start.call(pageInstance) as Promise<void>;
      pageDefinition.stop.call(pageInstance);
      await pageDefinition.start.call(pageInstance);
      expect(locks).toEqual([false, true]);

      rejectFirstResume(new Error("stale audio failed"));
      await staleStart;

      expect(locks).toEqual([false, true]);
    } finally {
      if (pageDefinition && pageInstance) pageDefinition.stop.call(pageInstance);
      vi.doUnmock("../miniprogram/adapters/metronome-audio");
      vi.unstubAllGlobals();
    }
  });
});
