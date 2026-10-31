import { removeDc, rms } from "./pcm";

export type PitchReading = {
  frequency: number;
  clarity: number;
  rms: number;
};

export type PitchDetectorOptions = {
  minFrequency?: number;
  maxFrequency?: number;
  clarityThreshold?: number;
  rmsThreshold?: number;
};

export class PitchDetector {
  private readonly minFrequency: number;
  private readonly maxFrequency: number;
  private readonly clarityThreshold: number;
  private readonly rmsThreshold: number;

  constructor(options: PitchDetectorOptions = {}) {
    this.minFrequency = options.minFrequency ?? 55;
    this.maxFrequency = options.maxFrequency ?? 400;
    this.clarityThreshold = options.clarityThreshold ?? 0.9;
    this.rmsThreshold = options.rmsThreshold ?? 10 ** (-50 / 20);

    if (
      !Number.isFinite(this.minFrequency) ||
      !Number.isFinite(this.maxFrequency) ||
      !Number.isFinite(this.clarityThreshold) ||
      !Number.isFinite(this.rmsThreshold)
    ) {
      throw new RangeError("Pitch detector options must be finite");
    }
    if (
      this.minFrequency < 55 ||
      this.maxFrequency > 400 ||
      this.maxFrequency <= this.minFrequency ||
      this.clarityThreshold < 0 ||
      this.clarityThreshold > 1 ||
      this.rmsThreshold < 0 ||
      this.rmsThreshold > 1
    ) {
      throw new RangeError("Pitch detector options are outside their valid ranges");
    }
  }

  detect(frame: Float32Array, sampleRate: number): PitchReading | null {
    if (frame.length < 256 || sampleRate <= 0) return null;

    const level = rms(frame);
    if (level < this.rmsThreshold) return null;

    const samples = removeDc(frame);
    const minLag = Math.max(2, Math.floor(sampleRate / this.maxFrequency));
    const maxLag = Math.min(
      Math.floor(samples.length / 2),
      Math.ceil(sampleRate / this.minFrequency),
    );
    if (minLag >= maxLag) return null;

    const nsdf = new Float64Array(maxLag + 2);
    for (let lag = minLag - 1; lag <= maxLag + 1; lag += 1) {
      let correlation = 0;
      let energy = 0;
      for (let index = 0; index < samples.length - lag; index += 1) {
        const left = samples[index];
        const right = samples[index + lag];
        correlation += left * right;
        energy += left * left + right * right;
      }
      nsdf[lag] = energy > 0 ? (2 * correlation) / energy : 0;
    }

    const peaks: number[] = [];
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (
        nsdf[lag] > 0 &&
        nsdf[lag] > nsdf[lag - 1] &&
        nsdf[lag] >= nsdf[lag + 1]
      ) {
        peaks.push(lag);
      }
    }
    if (peaks.length === 0) return null;

    const highest = Math.max(...peaks.map((lag) => nsdf[lag]));
    const lag = peaks.find((candidate) => nsdf[candidate] >= highest * 0.9);
    if (lag === undefined || nsdf[lag] < this.clarityThreshold) return null;

    const left = nsdf[lag - 1];
    const center = nsdf[lag];
    const right = nsdf[lag + 1];
    const denominator = left - 2 * center + right;
    const offset = denominator === 0 ? 0 : (0.5 * (left - right)) / denominator;
    const estimatedFrequency = sampleRate / (lag + offset);
    if (!Number.isFinite(estimatedFrequency)) return null;
    const frequency = Math.min(
      this.maxFrequency,
      Math.max(this.minFrequency, estimatedFrequency),
    );

    return { frequency, clarity: center, rms: level };
  }
}
