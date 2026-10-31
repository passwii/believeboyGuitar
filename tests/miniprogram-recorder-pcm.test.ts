import { describe, expect, it, vi } from "vitest";
import {
  createRecorderPcm,
  toPcmFrame,
} from "../miniprogram/adapters/recorder-pcm";

function manager(rejectedRates: number[] = [48000], stopImmediately = true) {
  const callbacks: Record<string, (value?: unknown) => void> = {};
  const register = (event: string) => (fn: (value?: unknown) => void) => {
    callbacks[event] = fn;
    return fn;
  };
  const unregister = (event: string) => (fn?: (value?: unknown) => void) => {
    if (callbacks[event] === fn) delete callbacks[event];
  };
  return {
    callbacks,
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
    stop: vi.fn(() => {
      if (stopImmediately) callbacks.stop?.({ duration: 1000 });
    }),
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

  it("registers one callback set for the adapter lifetime", async () => {
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
    expect(fake.onStart).toHaveBeenCalledTimes(1);
    expect(fake.onStop).toHaveBeenCalledTimes(1);
    expect(fake.onError).toHaveBeenCalledTimes(1);
    expect(fake.onFrameRecorded).toHaveBeenCalledTimes(1);
    expect(fake.offStart).toHaveBeenCalledTimes(1);
    expect(fake.offStop).toHaveBeenCalledTimes(1);
    expect(fake.offError).toHaveBeenCalledTimes(1);
    expect(fake.offFrameRecorded).toHaveBeenCalledTimes(1);
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

  it("waits for the old onStop before starting a requested new session", async () => {
    const fake = manager([], false);
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState: vi.fn(),
    });
    await adapter.start();
    adapter.stop();
    const nextStart = adapter.start();
    expect(fake.start).toHaveBeenCalledTimes(1);

    fake.emitStop(1000);
    await expect(nextStart).resolves.toBe(44100);
    expect(fake.start).toHaveBeenCalledTimes(2);
    expect(adapter.isRunning()).toBe(true);
    adapter.dispose();
  });

  it("stops an active session before fulfilling a new start request", async () => {
    const fake = manager([], false);
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame: vi.fn(),
      onError: vi.fn(),
      onState: vi.fn(),
    });
    await adapter.start();
    const nextStart = adapter.start();
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(fake.start).toHaveBeenCalledTimes(1);

    fake.emitStop(1000);
    await expect(nextStart).resolves.toBe(44100);
    expect(fake.start).toHaveBeenCalledTimes(2);
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
