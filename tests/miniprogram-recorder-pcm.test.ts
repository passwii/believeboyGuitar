import { describe, expect, it, vi } from "vitest";
import {
  createRecorderPcm,
  toPcmFrame,
} from "../miniprogram/adapters/recorder-pcm";

function manager() {
  const callbacks: Record<string, (value?: unknown) => void> = {};
  return {
    callbacks,
    onStart: vi.fn((fn) => (callbacks.start = fn)),
    onStop: vi.fn((fn) => (callbacks.stop = fn)),
    onError: vi.fn((fn) => (callbacks.error = fn)),
    onFrameRecorded: vi.fn((fn) => (callbacks.frame = fn)),
    offStart: vi.fn(),
    offStop: vi.fn(),
    offError: vi.fn(),
    offFrameRecorded: vi.fn(),
    start: vi.fn((options) => {
      if (options.sampleRate === 48000) {
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

  it("registers callbacks once and unregisters them once on dispose", async () => {
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
