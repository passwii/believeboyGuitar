import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const ts = readFileSync("miniprogram/pages/metronome/index.ts", "utf8");
const wxml = readFileSync("miniprogram/pages/metronome/index.wxml", "utf8");

function fakeAudio(state: string, schedule = vi.fn()) {
  return {
    state,
    currentTime: 10,
    setTimbre: vi.fn(),
    resume: vi.fn(async () => undefined),
    schedule,
    cancelFrom: vi.fn(),
    dispose: vi.fn(async () => undefined),
  };
}

async function createPageHarness(audio: ReturnType<typeof fakeAudio>) {
  vi.resetModules();
  let definition: any;
  vi.doMock("../miniprogram/adapters/metronome-audio", () => ({
    TIMBRES: [
      { id: "wood", label: "木质" },
      { id: "electronic", label: "电子" },
      { id: "mechanical", label: "机械" },
    ],
    createMetronomeAudio: vi.fn(() => audio),
  }));
  vi.stubGlobal("Page", (pageDefinition: any) => {
    definition = pageDefinition;
  });
  const setKeepScreenOn = vi.fn();
  vi.stubGlobal("wx", {
    createWebAudioContext: vi.fn(),
    setKeepScreenOn,
  });

  await import("../miniprogram/pages/metronome/index");
  const instance = {
    data: { ...definition.data },
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    },
    tick() {
      definition.tick.call(this);
    },
    stop(interrupted?: boolean) {
      definition.stop.call(this, interrupted);
    },
  };
  definition.onLoad.call(instance);
  return { definition, instance, setKeepScreenOn };
}

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
      state: "running",
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

  it.each(["suspended", "closed"])(
    "stops cleanly when the audio context becomes %s",
    async (state) => {
      const audio = fakeAudio("running");
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
      const { definition, instance, setKeepScreenOn } = await createPageHarness(audio);
      try {
        await definition.start.call(instance);
        audio.state = state;
        instance.tick();

        expect(instance.data).toMatchObject({
          phase: "idle",
          activeBeat: 0,
          status: "播放中断，请重新开始",
          wakeHint: "",
        });
        expect(audio.schedule).toHaveBeenCalledOnce();
        expect(audio.cancelFrom).toHaveBeenCalledOnce();
        expect(audio.dispose).toHaveBeenCalledOnce();
        expect(clearIntervalSpy).toHaveBeenCalledOnce();
        expect(setKeepScreenOn).toHaveBeenLastCalledWith(
          expect.objectContaining({ keepScreenOn: false }),
        );
      } finally {
        definition.stop.call(instance);
        vi.doUnmock("../miniprogram/adapters/metronome-audio");
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    },
  );

  it("stops cleanly and reports an interruption when scheduling throws", async () => {
    const schedule = vi.fn(() => {
      throw new Error("audio node scheduling failed");
    });
    const audio = fakeAudio("running", schedule);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { definition, instance } = await createPageHarness(audio);
    try {
      await definition.start.call(instance);

      expect(instance.data).toMatchObject({
        phase: "idle",
        activeBeat: 0,
        status: "播放中断，请重新开始",
        wakeHint: "",
      });
      expect(schedule).toHaveBeenCalledOnce();
      expect(audio.cancelFrom).toHaveBeenCalledOnce();
      expect(audio.dispose).toHaveBeenCalledOnce();
      expect(clearIntervalSpy).toHaveBeenCalledOnce();
    } finally {
      definition.stop.call(instance);
      vi.doUnmock("../miniprogram/adapters/metronome-audio");
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
