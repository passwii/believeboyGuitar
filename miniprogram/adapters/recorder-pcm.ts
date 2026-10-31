import { pcm16ToFloat32 } from "../generated/guitar-core/pcm";

export type RecorderPcmOptions = {
  manager?: WechatMiniprogram.RecorderManager;
  rates?: readonly number[];
  frameSize?: number;
  duration?: number;
  onFrame(samples: Float32Array, sampleRate: number): void;
  onError(message: string): void;
  onState(state: "starting" | "listening" | "stopped"): void;
};

type RecorderEvents = {
  onStart(listener: () => void): void;
  onStop(listener: (result: { duration?: number }) => void): void;
  onError(listener: (result: { errMsg?: string }) => void): void;
  onFrameRecorded(
    listener: (result: { frameBuffer: ArrayBuffer; isLastFrame: boolean }) => void,
  ): void;
  offStart?: (listener?: () => void) => void;
  offStop?: (listener?: (result: { duration?: number }) => void) => void;
  offError?: (listener?: (result: { errMsg?: string }) => void) => void;
  offFrameRecorded?: (
    listener?: (result: { frameBuffer: ArrayBuffer; isLastFrame: boolean }) => void,
  ) => void;
};

export function toPcmFrame(buffer: ArrayBuffer): Float32Array {
  return pcm16ToFloat32(buffer);
}

export function createRecorderPcm(options: RecorderPcmOptions): {
  start(): Promise<number>;
  stop(): void;
  dispose(): void;
  isRunning(): boolean;
} {
  const manager = (options.manager ?? wx.getRecorderManager()) as
    WechatMiniprogram.RecorderManager & RecorderEvents;
  const rates = options.rates?.length ? options.rates : [48000, 44100];
  const duration = options.duration ?? 600000;
  const frameSize = options.frameSize ?? 8;
  let callbacksRegistered = false;
  let disposed = false;
  let wantsListening = false;
  let running = false;
  let starting = false;
  let rateIndex = 0;
  let attemptRate = 0;
  let activeRate = 0;
  let lastStartError = "Recorder failed to start";
  let resolveStart: ((rate: number) => void) | null = null;
  let rejectStart: ((error: Error) => void) | null = null;
  let startPromise: Promise<number> | null = null;

  const startOptions = (sampleRate: number) =>
    ({
      duration,
      frameSize,
      format: "PCM",
      numberOfChannels: 1,
      sampleRate,
    }) as WechatMiniprogram.RecorderManagerStartOption;

  function finishAttempt(errorMessage: string): void {
    starting = false;
    wantsListening = false;
    running = false;
    options.onState("stopped");
    options.onError(errorMessage);
    rejectStart?.(new Error(errorMessage));
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
  }

  function beginAttempt(): void {
    if (!wantsListening || disposed) return;
    if (rateIndex >= rates.length) {
      finishAttempt(lastStartError);
      return;
    }
    attemptRate = rates[rateIndex];
    try {
      manager.start(startOptions(attemptRate));
    } catch (error) {
      lastStartError = error instanceof Error ? error.message : String(error);
      rateIndex += 1;
      if (rateIndex >= rates.length) {
        finishAttempt(lastStartError);
      } else {
        beginAttempt();
      }
    }
  }

  const onStart = (): void => {
    if (!wantsListening || disposed || !starting) return;
    running = true;
    starting = false;
    activeRate = attemptRate;
    options.onState("listening");
    resolveStart?.(activeRate);
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
  };

  const onError = (result: { errMsg?: string }): void => {
    const message = result.errMsg ?? "Recorder error";
    if (starting && wantsListening) {
      lastStartError = message;
      rateIndex += 1;
      beginAttempt();
      return;
    }
    if (!running) return;
    running = false;
    wantsListening = false;
    options.onState("stopped");
    options.onError(message);
    manager.stop();
  };

  const onStop = (result: { duration?: number }): void => {
    const wasActive = running || starting;
    running = false;
    starting = false;
    if (
      wantsListening &&
      !disposed &&
      typeof result.duration === "number" &&
      result.duration >= duration
    ) {
      void start().catch(() => undefined);
      return;
    }
    wantsListening = false;
    if (wasActive) options.onState("stopped");
    rejectStart?.(new Error("Recorder stopped before starting"));
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
  };

  const onFrameRecorded = (result: {
    frameBuffer: ArrayBuffer;
    isLastFrame: boolean;
  }): void => {
    if (running) options.onFrame(toPcmFrame(result.frameBuffer), activeRate);
  };

  function registerCallbacks(): void {
    if (callbacksRegistered) return;
    manager.onStart(onStart);
    manager.onStop(onStop);
    manager.onError(onError);
    manager.onFrameRecorded(onFrameRecorded);
    callbacksRegistered = true;
  }

  function start(): Promise<number> {
    if (disposed) return Promise.reject(new Error("Recorder has been disposed"));
    if (running) return Promise.resolve(activeRate);
    if (startPromise) return startPromise;

    wantsListening = true;
    starting = true;
    rateIndex = 0;
    options.onState("starting");
    registerCallbacks();
    const pendingStart = new Promise<number>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    startPromise = pendingStart;
    beginAttempt();
    return pendingStart;
  }

  function stop(): void {
    wantsListening = false;
    const wasActive = running || starting;
    starting = false;
    running = false;
    options.onState("stopped");
    if (wasActive) manager.stop();
    if (rejectStart) {
      rejectStart(new Error("Recorder start was stopped"));
      rejectStart = null;
      resolveStart = null;
      startPromise = null;
    }
  }

  function dispose(): void {
    if (disposed) return;
    stop();
    disposed = true;
    if (callbacksRegistered) {
      const events = manager as RecorderEvents;
      events.offStart?.(onStart);
      events.offStop?.(onStop);
      events.offError?.(onError);
      events.offFrameRecorded?.(onFrameRecorded);
      callbacksRegistered = false;
    }
  }

  return { start, stop, dispose, isRunning: () => running };
}
