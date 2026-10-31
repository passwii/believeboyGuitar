export function pcm16ToFloat32(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength % 2 !== 0) {
    throw new RangeError("PCM16 data must contain an even number of bytes");
  }

  const view = new DataView(buffer);
  const samples = new Float32Array(buffer.byteLength / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
}

export function removeDc(samples: Float32Array): Float32Array {
  let sum = 0;
  for (const sample of samples) sum += sample;
  const mean = samples.length === 0 ? 0 : sum / samples.length;
  const output = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    output[index] = samples[index] - mean;
  }
  return output;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}
