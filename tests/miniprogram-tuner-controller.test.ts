import { describe, expect, it } from "vitest";
import { createTunerController } from "../miniprogram/pages/tuner/controller";

function listeningController() {
  const controller = createTunerController();
  controller.start();
  controller.setPermissionResult(true);
  controller.recorderStarted();
  return controller;
}

function noiseFrame(seed = 17) {
  const frame = new Float32Array(4096);
  let value = seed;
  for (let index = 0; index < frame.length; index += 1) {
    value = (value * 16807) % 2147483647;
    frame[index] = (value / 1073731823.5 - 1) * 0.08;
  }
  return frame;
}

describe("tuner controller", () => {
  it("records a denied microphone permission outcome", () => {
    const controller = createTunerController();
    controller.start();
    controller.setPermissionResult(false);

    expect(controller.getState()).toMatchObject({
      state: "idle",
      listening: false,
      permissionDenied: true,
      statusText: "需要麦克风权限才能调音",
    });
  });

  it("clears the reading and smoothing state when tuning stops", () => {
    const controller = listeningController();
    controller.acceptFrequency(82.4069, 1000);
    controller.stop();

    expect(controller.getState()).toMatchObject({
      state: "idle",
      statusText: "准备调音",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
      listening: false,
    });
    controller.start();
    controller.setPermissionResult(true);
    controller.recorderStarted();
    controller.acceptFrequency(82.4069, 1300);
    expect(controller.getState().stable).toBe(false);
  });

  it("invalidates the previous reading for quiet and unpitched frames", () => {
    const controller = listeningController();
    controller.acceptFrequency(82.4069, 1000);
    controller.handleFrame(new Float32Array(4096), 44100, 1100);
    expect(controller.getState()).toMatchObject({
      statusText: "声音太小",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
    });

    controller.acceptFrequency(82.4069, 1200);
    controller.handleFrame(noiseFrame(), 44100, 1300);
    expect(controller.getState()).toMatchObject({
      statusText: "信号不稳定",
      noteText: "—",
      cents: 0,
      directionText: "等待声音",
      stable: false,
    });
  });

  it("uses the median of the latest five frequency readings", () => {
    const controller = listeningController();
    [82.4069, 82.4069, 140, 82.4069, 82.4069].forEach((frequency, index) => {
      controller.acceptFrequency(frequency, 1000 + index * 30);
    });

    expect(controller.getState().noteText).toBe("E2");
    expect(controller.getState().cents).toBe(0);
  });

  it("selectString uses the chosen target", () => {
    const controller = listeningController();
    controller.selectString("5");
    controller.acceptFrequency(82.4069, 1000);

    expect(controller.getState()).toMatchObject({
      mode: "manual",
      manualStringId: "5",
      noteText: "A2",
    });
  });

  it("returns a chromatic note name, octave and cents", () => {
    const controller = listeningController();
    controller.cyclePreset();
    controller.cyclePreset();
    controller.cyclePreset();
    controller.acceptFrequency(440, 1000);

    expect(controller.getState()).toMatchObject({
      chromatic: true,
      noteText: "A4",
      cents: 0,
    });
  });

  it("requires 200ms of continuous in-tune readings", () => {
    const controller = listeningController();
    controller.acceptFrequency(82.4069, 1000);
    expect(controller.getState().stable).toBe(false);
    controller.acceptFrequency(82.4069, 1199);
    expect(controller.getState().stable).toBe(false);
    controller.acceptFrequency(82.4069, 1200);

    expect(controller.getState()).toMatchObject({
      stable: true,
      directionText: "准",
      statusText: "音高已稳定",
    });
  });
});
