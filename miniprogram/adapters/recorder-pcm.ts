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
  const rates = options.rates?.length ? options.rates : [48000, 44100, 32000];
  const duration = options.duration ?? 600000;
  const frameSize = options.frameSize ?? 8;
  let disposed = false;
  let callbacksRegistered = false;
  let wantsListening = false;
  let running = false;
  let starting = false;
  let stopping = false;
  let managerSessionOpen = false;
  let state: "starting" | "listening" | "stopped" = "stopped";
  let rateIndex = 0;
  let attemptRate = 0;
  let activeRate = 0;
  let generationCounter = 0;
  let activeGeneration = 0;
  let issuedGeneration = 0;
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

  function setState(next: "starting" | "listening" | "stopped"): void {
    if (state === next) return;
    state = next;
    options.onState(next);
  }

  function registerCallbacks(): void {
    if (callbacksRegistered) return;
    manager.onStart(onStart);
    manager.onStop(onStop);
    manager.onError(onError);
    manager.onFrameRecorded(onFrameRecorded);
    callbacksRegistered = true;
  }

  function unregisterCallbacks(): void {
    if (!callbacksRegistered) return;
    const events = manager as RecorderEvents;
    events.offStart?.(onStart);
    events.offStop?.(onStop);
    events.offError?.(onError);
    events.offFrameRecorded?.(onFrameRecorded);
    callbacksRegistered = false;
  }

  function rejectPendingStart(error: Error): void {
    rejectStart?.(error);
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
  }

  function finishAttempt(errorMessage: string): void {
    starting = false;
    wantsListening = false;
    running = false;
    activeGeneration = ++generationCounter;
    setState("stopped");
    options.onError(errorMessage);
    rejectPendingStart(new Error(errorMessage));
  }

  function beginAttempt(): void {
    if (!wantsListening || disposed || stopping || !starting) return;
    if (rateIndex >= rates.length) {
      finishAttempt(lastStartError);
      return;
    }
    attemptRate = rates[rateIndex];
    issuedGeneration = activeGeneration;
    managerSessionOpen = true;
    try {
      manager.start(startOptions(attemptRate));
    } catch (error) {
      if (issuedGeneration !== activeGeneration || !managerSessionOpen) return;
      managerSessionOpen = false;
      lastStartError = error instanceof Error ? error.message : String(error);
      rateIndex += 1;
      if (rateIndex >= rates.length) {
        finishAttempt(lastStartError);
      } else {
        beginAttempt();
      }
    }
  }

  function onStart(): void {
    if (
      issuedGeneration !== activeGeneration ||
      !wantsListening ||
      disposed ||
      stopping ||
      !starting
    ) return;
    running = true;
    starting = false;
    activeRate = attemptRate;
    setState("listening");
    resolveStart?.(activeRate);
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
  }

  function onError(result: { errMsg?: string }): void {
    if (disposed || stopping || issuedGeneration !== activeGeneration) return;
    const message = result.errMsg ?? "Recorder error";
    if (starting && wantsListening) {
      managerSessionOpen = false;
      lastStartError = message;
      rateIndex += 1;
      beginAttempt();
      return;
    }
    if (!running) return;
    running = false;
    wantsListening = false;
    stopping = true;
    activeGeneration = ++generationCounter;
    setState("stopped");
    options.onError(message);
    manager.stop();
  }

  function onStop(result: { duration?: number }): void {
    if (disposed) return;
    const wasRequestedStop = stopping;
    if (!wasRequestedStop && issuedGeneration !== activeGeneration) return;
    const wasActive = running || starting || managerSessionOpen;
    running = false;
    managerSessionOpen = false;
    stopping = false;

    if (wasRequestedStop) {
      if (wantsListening && starting) {
        beginAttempt();
      } else {
        starting = false;
        setState("stopped");
      }
      return;
    }

    if (
      wantsListening &&
      typeof result.duration === "number" &&
      result.duration >= duration
    ) {
      startNewSession();
      return;
    }
    wantsListening = false;
    starting = false;
    activeGeneration = ++generationCounter;
    if (wasActive) setState("stopped");
    rejectPendingStart(new Error("Recorder stopped before starting"));
  }

  function onFrameRecorded(result: {
    frameBuffer: ArrayBuffer;
    isLastFrame: boolean;
  }): void {
    if (
      issuedGeneration === activeGeneration &&
      running &&
      !stopping &&
      !disposed
    ) {
      options.onFrame(toPcmFrame(result.frameBuffer), activeRate);
    }
  }

  function createStartRequest(): Promise<number> {
    wantsListening = true;
    starting = true;
    rateIndex = 0;
    activeGeneration = ++generationCounter;
    lastStartError = "Recorder failed to start";
    setState("starting");
    const pendingStart = new Promise<number>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    startPromise = pendingStart;
    return pendingStart;
  }

  function startNewSession(): void {
    const pendingStart = createStartRequest();
    void pendingStart.catch(() => undefined);
    registerCallbacks();
    if (!stopping) beginAttempt();
  }

  function start(): Promise<number> {
    if (disposed) return Promise.reject(new Error("Recorder has been disposed"));
    if (startPromise) return startPromise;
    if (running) {
      stopping = true;
      running = false;
      const pendingStart = createStartRequest();
      manager.stop();
      return pendingStart;
    }

    const pendingStart = createStartRequest();
    registerCallbacks();
    if (!stopping) beginAttempt();
    return pendingStart;
  }

  function stop(): void {
    if (!wantsListening && !running && !starting) return;
    wantsListening = false;
    const requestManagerStop = managerSessionOpen && !stopping;
    if (requestManagerStop) stopping = true;
    const wasActive = running || starting;
    starting = false;
    running = false;
    activeGeneration = ++generationCounter;
    if (startPromise) rejectPendingStart(new Error("Recorder start was stopped"));
    if (wasActive || requestManagerStop) setState("stopped");
    if (requestManagerStop) manager.stop();
  }

  function dispose(): void {
    if (disposed) return;
    stop();
    disposed = true;
    unregisterCallbacks();
  }

  return { start, stop, dispose, isRunning: () => running };
}
