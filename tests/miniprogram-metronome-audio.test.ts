import { describe, expect, it, vi } from "vitest";
import { createMetronomeAudio } from "../miniprogram/adapters/metronome-audio";
import { METERS } from "../packages/guitar-core/src/metronome";

function fakeContext() {
  const stops: Array<ReturnType<typeof vi.fn>> = [];
  const oscillator = () => {
    const stop = vi.fn();
    stops.push(stop);
    return {
      type: "triangle",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop,
    };
  };
  return {
    currentTime: 10,
    state: "running",
    sampleRate: 48000,
    destination: {},
    createOscillator: vi.fn(oscillator),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(480) })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: "bandpass",
      frequency: { setValueAtTime: vi.fn() },
      Q: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    resume: vi.fn(async () => undefined),
    suspend: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    stops,
  };
}

describe("mini metronome audio", () => {
  it("schedules and cancels future clicks", async () => {
    const context = fakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as never,
      timbre: "electronic",
    });
    await audio.resume();
    audio.schedule(0, 10.1, METERS[0]);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    audio.cancelFrom(10.05);
    expect(context.stops[0]).toHaveBeenCalledWith(0);
  });

  it("closes the context on dispose", async () => {
    const context = fakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as never,
    });
    await audio.resume();
    await audio.dispose();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
