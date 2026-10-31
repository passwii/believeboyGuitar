import { describe, expect, it, vi } from "vitest";
import {
  createRecorderPcm,
  toPcmFrame,
} from "../miniprogram/adapters/recorder-pcm";

function manager(rejectedRates: number[] = [48000]) {
  const callbacks: Record<string, (value?: unknown) => void> = {};
  const history: Record<string, Array<(value?: unknown) => void>> = {
    start: [],
    stop: [],
    error: [],
    frame: [],
  };
  const register = (event: string) => (fn: (value?: unknown) => void) => {
    callbacks[event] = fn;
    history[event].push(fn);
    return fn;
  };
  const unregister = (event: string) => (fn?: (value?: unknown) => void) => {
    if (callbacks[event] === fn) delete callbacks[event];
  };
  return {
    callbacks,
    history,
    onStart: vi.fn(register("start")),
    onStop: vi.fn(register("stop")),
    onError: vi.fn(register("error")),
    onFrameRecorded: vi.fn(register("frame")),
    offStart: vi.fn(unregister("start")),
    offStop: vi.fn(unregister("stop")),
    offError: vi.fn(unregister("error")),
    offFrameRecorded: vi.fn(unregister("frame")),
    start: vi.fn((options) => {
      if (rejectedRates.includes(options.sampleRate)) {
        callbacks.error?.({ errMsg: "unsupported" });
      } else {
        callbacks.start?.();
      }
    }),
    stop: vi.fn(() => callbacks.stop?.({ duration: 1000 })),
    emitFrame: (buffer: ArrayBuffer) =>
      callbacks.frame?.({ frameBuffer: buffer, isLastFrame: false }),
    emitStop: (duration: number) => callbacks.stop?.({ duration }),
    emitError: (errMsg: string) => callbacks.error?.({ errMsg }),
  };
}

describe("recorder PCM adapter", () => {
  it("converts PCM16 frames", () => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setInt16(0, 32767, true);
    view.setInt16(2, -32768, true);
    expect(Array.from(toPcmFrame(buffer))).toEqual([32767 / 32768, -1]);
  });

  it("falls back from 48k to 44.1k", async () => {
    const fake = manager();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [48000, 44100],
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState: vi.fn(),
    });
    await expect(adapter.start()).resolves.toBe(44100);
    expect(fake.start).toHaveBeenCalledTimes(2);
    expect(fake.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ sampleRate: 44100 }),
    );
    adapter.dispose();
  });

  it("falls back through the default rates to 32k", async () => {
    const fake = manager([48000, 44100]);
    const adapter = createRecorderPcm({
      manager: fake as never,
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState: vi.fn(),
    });
    await expect(adapter.start()).resolves.toBe(32000);
    expect(fake.start.mock.calls.map(([options]) => options.sampleRate)).toEqual([
      48000,
      44100,
      32000,
    ]);
    adapter.dispose();
  });

  it("delivers converted frames with the active rate only while running", async () => {
    const onFrame = vi.fn();
    const fake = manager();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame,
      onError: vi.fn(),
      onState: vi.fn(),
    });
    await adapter.start();
    fake.emitFrame(new ArrayBuffer(4));
    expect(onFrame).toHaveBeenCalledWith(new Float32Array(2), 44100);
    adapter.stop();
    fake.emitFrame(new ArrayBuffer(4));
    expect(onFrame).toHaveBeenCalledTimes(1);
    adapter.dispose();
  });

  it("keeps one callback set active across restarts and unregisters on dispose", async () => {
    const fake = manager();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState: vi.fn(),
    });
    await adapter.start();
    adapter.stop();
    await adapter.start();
    adapter.dispose();
    adapter.dispose();
    expect(fake.onStart).toHaveBeenCalledTimes(2);
    expect(fake.onStop).toHaveBeenCalledTimes(2);
    expect(fake.onError).toHaveBeenCalledTimes(2);
    expect(fake.onFrameRecorded).toHaveBeenCalledTimes(2);
    expect(fake.offStart).toHaveBeenCalledTimes(2);
    expect(fake.offStop).toHaveBeenCalledTimes(2);
    expect(fake.offError).toHaveBeenCalledTimes(2);
    expect(fake.offFrameRecorded).toHaveBeenCalledTimes(2);
  });

  it("restarts after the duration limit while listening is still wanted", async () => {
    const fake = manager();
    const onState = vi.fn();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      duration: 600000,
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState,
    });
    await adapter.start();
    fake.emitStop(600000);
    expect(fake.start).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith("listening");
    adapter.stop();
    fake.emitStop(600000);
    expect(fake.start).toHaveBeenCalledTimes(2);
    adapter.dispose();
  });

  it("stops listening after an unexpected recorder stop", async () => {
    const fake = manager();
    const onState = vi.fn();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState,
    });
    await adapter.start();
    fake.emitStop(1200);
    expect(adapter.isRunning()).toBe(false);
    expect(fake.start).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenLastCalledWith("stopped");
    adapter.dispose();
  });

  it("ignores late events from the previous session after stop and restart", async () => {
    const fake = manager([]);
    const onFrame = vi.fn();
    const onError = vi.fn();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame,
      onError,
      onState: vi.fn(),
    });
    await adapter.start();
    const oldStart = fake.history.start[0];
    const oldStop = fake.history.stop[0];
    const oldError = fake.history.error[0];
    const oldFrame = fake.history.frame[0];
    adapter.stop();
    await adapter.start();
    const startCalls = fake.start.mock.calls.length;

    oldStart();
    oldFrame({ frameBuffer: new ArrayBuffer(4), isLastFrame: false });
    oldStop({ duration: 600000 });
    oldError({ errMsg: "late failure" });

    expect(adapter.isRunning()).toBe(true);
    expect(fake.start).toHaveBeenCalledTimes(startCalls);
    expect(onFrame).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it("does not emit stopped state more than once for repeated stop calls", async () => {
    const fake = manager([]);
    const onState = vi.fn();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState,
    });
    await adapter.start();
    adapter.stop();
    adapter.stop();
    expect(onState.mock.calls.filter(([state]) => state === "stopped")).toHaveLength(
      1,
    );
    expect(fake.stop).toHaveBeenCalledTimes(1);
    adapter.dispose();
  });

  it("reports errors and stops after recording has started", async () => {
    const fake = manager();
    const onError = vi.fn();
    const onState = vi.fn();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame: vi.fn(),
      onError,
      onState,
    });
    await adapter.start();
    fake.emitError("device lost");
    expect(onError).toHaveBeenCalledWith("device lost");
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(adapter.isRunning()).toBe(false);
    expect(onState).toHaveBeenLastCalledWith("stopped");
    adapter.dispose();
  });
});
