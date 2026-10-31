# 微信工具型小程序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个只含节拍器与调音器的微信原生小程序，并抽出可被 Web、小程序和 macOS 复用的纯 TypeScript 核心。

**Architecture:** 现有 Next.js 站点保持原位；新增 `packages/guitar-core` 作为平台无关的节拍、调弦、PCM 和音高检测核心；新增 `miniprogram/` 作为独立微信项目，所有 `wx` API 只存在于适配层。

**Tech Stack:** TypeScript、原生 WXML/WXSS、微信 WebAudioContext、RecorderManager、Vitest、微信开发者工具原生 TypeScript 编译插件。

## Global Constraints

- 微信基础库最低版本：2.19.0。
- 只支持微信，不引入 Taro、uni-app 或 `web-view`。
- 节拍器与调音器只保证前台运行；`onHide` 必须停止音频或录音。
- A4 固定为 440 Hz。
- 节拍器：30–240 BPM、4/4、3/4、2/4、6/8、5/4、7/8、木质/电子/机械三种音色。
- 调音器：标准、Drop D、降半音、半音阶；自动识别 + 手动锁弦。
- 触摸目标不小于 44px；节拍器主按钮不小于 64px；只用浅色主题。
- `content/manifest.ts` 与现有 Web 行为不得改变。
- 不新增 CI、不新增后端、不新增账号或云同步。
- 每个提交作者：`DamonRock <jr.way123@gmail.com>`。
- 每个任务完成后先跑该任务列出的测试，再提交。

---

## 文件责任

| 路径 | 责任 |
| --- | --- |
| `packages/guitar-core/src/metronome.ts` | 拍号、BPM、圆盘几何、纯节拍推进 |
| `packages/guitar-core/src/tuning.ts` | 调弦预设、目标弦、音名与音分 |
| `packages/guitar-core/src/pcm.ts` | PCM16 转 Float32、RMS、去直流 |
| `packages/guitar-core/src/pitch.ts` | MPM 单音音高检测 |
| `packages/guitar-core/src/index.ts` | 共享核心公共出口 |
| `miniprogram/app.*` | 小程序入口、Tab、视觉令牌 |
| `miniprogram/adapters/metronome-audio.ts` | 微信 WebAudio 合成与排程 |
| `miniprogram/adapters/recorder-pcm.ts` | RecorderManager、采样率回退、帧生命周期 |
| `miniprogram/components/bpm-dial/` | Canvas 圆盘与触摸映射 |
| `miniprogram/components/beat-strip/` | 拍块与当前拍高亮 |
| `miniprogram/components/tuner-gauge/` | 音分指针与方向文字 |
| `miniprogram/pages/metronome/` | 节拍器页面与状态机 |
| `miniprogram/pages/tuner/` | 调音器页面与状态机 |
| `tests/guitar-core-*.test.ts` | 共享逻辑单元测试 |
| `tests/miniprogram-*.test.ts` | 小程序边界、适配器和页面契约测试 |

---

### Task 1: 抽出共享节拍器核心

**Files:**
- Move: `lib/metronome.ts` → `packages/guitar-core/src/metronome.ts`
- Create: `lib/metronome.ts`
- Create: `packages/guitar-core/src/index.ts`
- Create: `packages/guitar-core/package.json`
- Create: `packages/guitar-core/tsconfig.build.json`
- Create: `tests/guitar-core-metronome.test.ts`

**Interfaces:**
- Consumes: existing exports from `lib/metronome.ts`.
- Produces: `packages/guitar-core/src/metronome.ts` with the same `Meter`, `METERS`, `clampBpm`, `bpmToIntervalMs`, `nextBeat`, `pickResumeClick`, `retainScheduleWindow` exports.

- [ ] **Step 1: Write the import-contract test**

```ts
// tests/guitar-core-metronome.test.ts
import { describe, expect, it } from "vitest";
import {
  BPM_DEFAULT,
  METERS,
  bpmToIntervalMs,
  nextBeat,
} from "../packages/guitar-core/src/metronome";

describe("shared metronome core", () => {
  it("keeps the current metronome model", () => {
    expect(BPM_DEFAULT).toBe(90);
    expect(METERS.map((meter) => meter.label)).toEqual([
      "4/4",
      "3/4",
      "2/4",
      "6/8",
      "5/4",
      "7/8",
    ]);
    expect(bpmToIntervalMs(120)).toBe(500);
    expect(nextBeat(3, METERS[0])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/guitar-core-metronome.test.ts`

Expected: FAIL because `packages/guitar-core/src/metronome.ts` does not exist.

- [ ] **Step 3: Move the existing module without changing behavior**

```bash
mkdir -p packages/guitar-core/src
git mv lib/metronome.ts packages/guitar-core/src/metronome.ts
```

Create `lib/metronome.ts` as the compatibility re-export used by existing Web code:

```ts
export * from "../packages/guitar-core/src/metronome";
```

- [ ] **Step 4: Add package exports and build configuration**

```json
// packages/guitar-core/package.json
{
  "name": "@guitar/core",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts"
}
```

```json
// packages/guitar-core/tsconfig.build.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "module": "CommonJS",
    "moduleResolution": "node",
    "target": "ES2019",
    "rootDir": "src",
    "outDir": "../../miniprogram/generated/guitar-core",
    "incremental": false,
    "isolatedModules": false
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// packages/guitar-core/src/index.ts
export * from "./metronome";
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/guitar-core-metronome.test.ts tests/metronome.test.ts`

Expected: PASS; existing metronome tests continue to import through `lib/metronome.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/metronome.ts packages/guitar-core tests/guitar-core-metronome.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "refactor(core): 抽出共享节拍器逻辑"
```

---

### Task 2: 增加调弦、音名和音分核心

**Files:**
- Create: `packages/guitar-core/src/tuning.ts`
- Modify: `packages/guitar-core/src/index.ts`
- Create: `tests/guitar-core-tuning.test.ts`

**Interfaces:**
- Consumes: nothing outside standard JavaScript math.
- Produces:
  - `type StringId`
  - `type StringTarget`
  - `type TuningPreset`
  - `TUNING_PRESETS`
  - `centsBetween(frequency: number, target: number): number`
  - `nearestString(frequency: number, strings: readonly StringTarget[]): StringReading`
  - `noteAtFrequency(frequency: number): ChromaticNote`
  - `describeCents(cents: number, tolerance?: number): "flat" | "in-tune" | "sharp"`

- [ ] **Step 1: Write failing tests**

```ts
// tests/guitar-core-tuning.test.ts
import { describe, expect, it } from "vitest";
import {
  TUNING_PRESETS,
  centsBetween,
  describeCents,
  nearestString,
  noteAtFrequency,
} from "../packages/guitar-core/src/tuning";

describe("tuning core", () => {
  it("defines standard, drop D, half-step down and chromatic", () => {
    expect(TUNING_PRESETS.map((preset) => preset.id)).toEqual([
      "standard",
      "drop-d",
      "half-step-down",
      "chromatic",
    ]);
    expect(TUNING_PRESETS[0].strings.map((string) => string.frequency)).toEqual([
      82.4069,
      110,
      146.832,
      195.998,
      246.942,
      329.628,
    ]);
  });

  it("returns signed cents", () => {
    expect(centsBetween(440, 440)).toBe(0);
    expect(centsBetween(443.65, 440)).toBeCloseTo(14.27, 1);
    expect(centsBetween(436.39, 440)).toBeCloseTo(-14.27, 1);
  });

  it("selects the nearest string and describes direction", () => {
    const standard = TUNING_PRESETS[0];
    expect(nearestString(108.7, standard.strings).target.id).toBe("5");
    expect(describeCents(-12)).toBe("flat");
    expect(describeCents(2)).toBe("in-tune");
    expect(describeCents(9)).toBe("sharp");
  });

  it("names chromatic notes with sharp spelling", () => {
    expect(noteAtFrequency(440)).toMatchObject({
      name: "A",
      octave: 4,
      midi: 69,
    });
    expect(noteAtFrequency(82.4069)).toMatchObject({
      name: "E",
      octave: 2,
      midi: 40,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/guitar-core-tuning.test.ts`

Expected: FAIL because `packages/guitar-core/src/tuning.ts` does not exist.

- [ ] **Step 3: Implement the tuning module**

```ts
// packages/guitar-core/src/tuning.ts
export type StringId = "6" | "5" | "4" | "3" | "2" | "1";

export type StringTarget = {
  id: StringId;
  label: string;
  note: string;
  octave: number;
  frequency: number;
};

export type TuningId =
  | "standard"
  | "drop-d"
  | "half-step-down"
  | "chromatic";

export type TuningPreset = {
  id: TuningId;
  label: string;
  strings: readonly StringTarget[];
};

const target = (
  id: StringId,
  note: string,
  octave: number,
  frequency: number,
): StringTarget => ({
  id,
  label: `${note}${octave}`,
  note,
  octave,
  frequency,
});

const STANDARD_STRINGS = [
  target("6", "E", 2, 82.4069),
  target("5", "A", 2, 110),
  target("4", "D", 3, 146.832),
  target("3", "G", 3, 195.998),
  target("2", "B", 3, 246.942),
  target("1", "E", 4, 329.628),
] as const;

const DROP_D_STRINGS = [
  target("6", "D", 2, 73.4162),
  ...STANDARD_STRINGS.slice(1),
] as const;

const HALF_STEP_DOWN_STRINGS = [
  target("6", "Eb", 2, 77.7817),
  target("5", "Ab", 2, 103.826),
  target("4", "Db", 3, 138.591),
  target("3", "Gb", 3, 184.997),
  target("2", "Bb", 3, 233.082),
  target("1", "Eb", 4, 311.127),
] as const;

export const TUNING_PRESETS: readonly TuningPreset[] = [
  { id: "standard", label: "标准调弦", strings: STANDARD_STRINGS },
  { id: "drop-d", label: "Drop D", strings: DROP_D_STRINGS },
  { id: "half-step-down", label: "降半音", strings: HALF_STEP_DOWN_STRINGS },
  { id: "chromatic", label: "半音阶", strings: [] },
];

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type StringReading = {
  target: StringTarget;
  cents: number;
};

export type ChromaticNote = {
  name: string;
  octave: number;
  midi: number;
  frequency: number;
  cents: number;
};

export function centsBetween(frequency: number, reference: number): number {
  if (frequency <= 0 || reference <= 0) {
    throw new RangeError("frequency and reference must be positive");
  }
  return 1200 * Math.log2(frequency / reference);
}

export function nearestString(
  frequency: number,
  strings: readonly StringTarget[],
): StringReading {
  if (strings.length === 0) {
    throw new RangeError("a tuning needs at least one string");
  }
  let chosen = strings[0];
  let difference = Math.abs(centsBetween(frequency, chosen.frequency));
  for (const string of strings.slice(1)) {
    const next = Math.abs(centsBetween(frequency, string.frequency));
    if (next < difference) {
      chosen = string;
      difference = next;
    }
  }
  return {
    target: chosen,
    cents: centsBetween(frequency, chosen.frequency),
  };
}

export function noteAtFrequency(frequency: number): ChromaticNote {
  const exactMidi = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(exactMidi);
  const noteFrequency = 440 * 2 ** ((midi - 69) / 12);
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    midi,
    frequency: noteFrequency,
    cents: centsBetween(frequency, noteFrequency),
  };
}

export function describeCents(
  cents: number,
  tolerance = 3,
): "flat" | "in-tune" | "sharp" {
  if (Math.abs(cents) <= tolerance) return "in-tune";
  return cents < 0 ? "flat" : "sharp";
}
```

Update `packages/guitar-core/src/index.ts`:

```ts
export * from "./metronome";
export * from "./tuning";
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/guitar-core-tuning.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/guitar-core tests/guitar-core-tuning.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(core): 增加调弦与音分计算"
```

---

### Task 3: 增加 PCM 转换、RMS 与 MPM 音高检测

**Files:**
- Create: `packages/guitar-core/src/pcm.ts`
- Create: `packages/guitar-core/src/pitch.ts`
- Modify: `packages/guitar-core/src/index.ts`
- Create: `tests/guitar-core-pcm.test.ts`
- Create: `tests/guitar-core-pitch.test.ts`

**Interfaces:**
- Consumes: standard JavaScript math.
- Produces:
  - `pcm16ToFloat32(buffer: ArrayBuffer): Float32Array`
  - `removeDc(samples: Float32Array): Float32Array`
  - `rms(samples: Float32Array): number`
  - `class PitchDetector` with `detect(frame: Float32Array, sampleRate: number): PitchReading | null`
  - `type PitchReading = { frequency: number; clarity: number; rms: number }`

- [ ] **Step 1: Write failing PCM tests**

```ts
// tests/guitar-core-pcm.test.ts
import { describe, expect, it } from "vitest";
import {
  pcm16ToFloat32,
  removeDc,
  rms,
} from "../packages/guitar-core/src/pcm";

function pcm(...values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 2);
  const view = new DataView(buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, true));
  return buffer;
}

describe("PCM helpers", () => {
  it("converts little-endian PCM16", () => {
    expect(Array.from(pcm16ToFloat32(pcm(0, 32767, -32768)))).toEqual([
      0,
      32767 / 32768,
      -1,
    ]);
  });

  it("removes DC and reports RMS", () => {
    const samples = new Float32Array([1, -1, 1, -1]);
    expect(rms(samples)).toBeCloseTo(1);
    const centered = removeDc(new Float32Array([1, 1, 1, 1]));
    expect(Array.from(centered)).toEqual([0, 0, 0, 0]);
  });

  it("rejects an odd byte length", () => {
    expect(() => pcm16ToFloat32(new ArrayBuffer(3))).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Write failing pitch tests**

```ts
// tests/guitar-core-pitch.test.ts
import { describe, expect, it } from "vitest";
import { PitchDetector } from "../packages/guitar-core/src/pitch";

const SAMPLE_RATE = 48000;
const FRAME_SIZE = 4096;

function sine(frequency: number, amplitude = 0.35): Float32Array {
  return Float32Array.from(
    { length: FRAME_SIZE },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE),
  );
}

function harmonic(frequency: number): Float32Array {
  return Float32Array.from({ length: FRAME_SIZE }, (_, index) => {
    const t = index / SAMPLE_RATE;
    return (
      0.22 * Math.sin(2 * Math.PI * frequency * t) +
      0.14 * Math.sin(4 * Math.PI * frequency * t) +
      0.07 * Math.sin(6 * Math.PI * frequency * t)
    );
  });
}

describe("PitchDetector", () => {
  const detector = new PitchDetector();

  it.each([82.4069, 110, 146.832, 195.998, 246.942, 329.628])(
    "detects %.4f Hz within one cent",
    (frequency) => {
      const reading = detector.detect(sine(frequency), SAMPLE_RATE);
      expect(reading).not.toBeNull();
      expect(1200 * Math.log2(reading!.frequency / frequency)).toBeCloseTo(0, 0);
      expect(reading!.clarity).toBeGreaterThan(0.9);
    },
  );

  it("handles a harmonic-rich guitar-like wave", () => {
    const reading = detector.detect(harmonic(82.4069), SAMPLE_RATE);
    expect(reading).not.toBeNull();
    expect(1200 * Math.log2(reading!.frequency / 82.4069)).toBeCloseTo(0, 0);
  });

  it("returns null for silence", () => {
    expect(detector.detect(new Float32Array(FRAME_SIZE), SAMPLE_RATE)).toBeNull();
  });

  it("returns null for unstable noise", () => {
    let state = 0x12345678;
    const noise = Float32Array.from({ length: FRAME_SIZE }, () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return (state / 0xffffffff - 0.5) * 0.8;
    });
    expect(detector.detect(noise, SAMPLE_RATE)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
npx vitest run tests/guitar-core-pcm.test.ts tests/guitar-core-pitch.test.ts
```

Expected: FAIL because `pcm.ts` and `pitch.ts` do not exist.

- [ ] **Step 4: Implement PCM helpers**

```ts
// packages/guitar-core/src/pcm.ts
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
```

- [ ] **Step 5: Implement the MPM detector**

```ts
// packages/guitar-core/src/pitch.ts
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

    const nsdf = new Float64Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag += 1) {
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
    for (let lag = minLag + 1; lag < maxLag; lag += 1) {
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
    const offset =
      denominator === 0 ? 0 : (0.5 * (left - right)) / denominator;
    const frequency = sampleRate / (lag + offset);
    if (
      !Number.isFinite(frequency) ||
      frequency < this.minFrequency ||
      frequency > this.maxFrequency
    ) {
      return null;
    }

    return { frequency, clarity: center, rms: level };
  }
}
```

Update `packages/guitar-core/src/index.ts`:

```ts
export * from "./metronome";
export * from "./pcm";
export * from "./pitch";
export * from "./tuning";
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/guitar-core-pcm.test.ts tests/guitar-core-pitch.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/guitar-core tests/guitar-core-pcm.test.ts tests/guitar-core-pitch.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(core): 增加 PCM 与音高检测"
```

---

### Task 4: 建立微信小程序壳与共享核心构建

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Create: `miniprogram/app.ts`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/sitemap.json`
- Create: `miniprogram/project.config.json`
- Create: `miniprogram/tsconfig.json`
- Create: `miniprogram/pages/metronome/index.{ts,json,wxml,wxss}`
- Create: `miniprogram/pages/tuner/index.{ts,json,wxml,wxss}`
- Create: `tests/miniprogram-shell.test.ts`

**Interfaces:**
- Consumes: `packages/guitar-core/src/index.ts`.
- Produces:
  - `npm run mini:core` emits `miniprogram/generated/guitar-core/`.
  - `npm run mini:check` type-checks the mini program.
  - A launchable two-tab WeChat project.

- [ ] **Step 1: Write the shell contract test**

```ts
// tests/miniprogram-shell.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("mini program shell", () => {
  it("has exactly the metronome and tuner tabs", () => {
    const app = JSON.parse(read("miniprogram/app.json"));
    expect(app.pages).toEqual([
      "pages/metronome/index",
      "pages/tuner/index",
    ]);
    expect(app.tabBar.list.map((item: { text: string }) => item.text)).toEqual([
      "节拍器",
      "调音器",
    ]);
  });

  it("uses native TypeScript compilation and base library 2.19.0", () => {
    const project = JSON.parse(read("miniprogram/project.config.json"));
    expect(project.setting.useCompilerPlugins).toContain("typescript");
    expect(project.libVersion).toBe("2.19.0");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/miniprogram-shell.test.ts`

Expected: FAIL because `miniprogram/app.json` does not exist.

- [ ] **Step 3: Install official mini program typings**

Run:

```bash
npm install --save-dev --save-exact miniprogram-api-typings@5.2.3
```

Expected: `package.json` contains `"miniprogram-api-typings": "5.2.3"`.

- [ ] **Step 4: Add root build and type-check scripts**

Set the scripts block to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "lint": "eslint",
  "test": "vitest run",
  "typecheck": "npm run mini:core && tsc --noEmit && tsc -p miniprogram/tsconfig.json --noEmit",
  "mini:core": "tsc -p packages/guitar-core/tsconfig.build.json",
  "mini:check": "npm run mini:core && tsc -p miniprogram/tsconfig.json --noEmit",
  "icons": "node scripts/generate-icons.mjs"
}
```

Add `"miniprogram"` to root `tsconfig.json` `exclude` and add
`"types": ["node", "miniprogram-api-typings"]` to root `compilerOptions` so
node-only tests can import adapter files that reference the `WechatMiniprogram`
namespace.

Append to `.gitignore`:

```gitignore
# mini program generated shared core
/miniprogram/generated/
```

- [ ] **Step 5: Create the mini project configuration**

```json
// miniprogram/project.config.json
{
  "appid": "touristappid",
  "compileType": "miniprogram",
  "libVersion": "2.19.0",
  "miniprogramRoot": "./",
  "projectname": "guitar-tools",
  "setting": {
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true,
    "useCompilerPlugins": ["typescript"]
  }
}
```

```json
// miniprogram/tsconfig.json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "module": "CommonJS",
    "moduleResolution": "node",
    "types": ["miniprogram-api-typings"],
    "isolatedModules": false
  },
  "include": ["**/*.ts", "**/*.d.ts"]
}
```

```json
// miniprogram/app.json
{
  "pages": [
    "pages/metronome/index",
    "pages/tuner/index"
  ],
  "window": {
    "navigationBarBackgroundColor": "#f1f2ec",
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "吉他工具",
    "backgroundColor": "#f1f2ec",
    "backgroundTextStyle": "dark"
  },
  "tabBar": {
    "color": "#5c6a61",
    "selectedColor": "#267b55",
    "backgroundColor": "#fbfcf8",
    "borderStyle": "white",
    "list": [
      { "pagePath": "pages/metronome/index", "text": "节拍器" },
      { "pagePath": "pages/tuner/index", "text": "调音器" }
    ]
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

```ts
// miniprogram/app.ts
App({});
```

```json
// miniprogram/sitemap.json
{
  "desc": "工具型小程序，不需要微信搜索收录",
  "rules": [{ "action": "disallow", "page": "*" }]
}
```

- [ ] **Step 6: Add shared visual tokens and page shells**

```css
/* miniprogram/app.wxss */
page {
  --color-canvas: #f1f2ec;
  --color-surface: #fbfcf8;
  --color-surface-muted: #e4e9e1;
  --color-ink-950: #1d2520;
  --color-ink-700: #49534c;
  --color-ink-500: #5c6a61;
  --color-ink-200: #c7cfc7;
  --color-ink-100: #dde3dc;
  --color-accent-700: #267b55;
  --color-accent-100: #d8e9de;
  --color-accent-50: #edf4ee;
  --color-on-accent: #ffffff;
  --color-rule: #c9d1c8;
  --ease-standard: cubic-bezier(.32, .72, 0, 1);
  min-height: 100%;
  background: var(--color-canvas);
  color: var(--color-ink-950);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}

button::after {
  border: 0;
}

.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
}
```

Create both page shells with a title and an empty tool area:

```xml
<!-- miniprogram/pages/metronome/index.wxml -->
<view class="page"><view class="title">节拍器</view></view>
```

```xml
<!-- miniprogram/pages/tuner/index.wxml -->
<view class="page"><view class="title">调音器</view></view>
```

```ts
// miniprogram/pages/metronome/index.ts
Page({});
```

```ts
// miniprogram/pages/tuner/index.ts
Page({});
```

Each page gets `{ "navigationBarTitleText": "节拍器" }` or `{ "navigationBarTitleText": "调音器" }` in its `.json`.

- [ ] **Step 7: Run the shell checks**

Run:

```bash
npm run mini:core
npm run mini:check
npx vitest run tests/miniprogram-shell.test.ts
```

Expected: all commands exit 0; `miniprogram/generated/guitar-core/index.js` exists.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore miniprogram tests/miniprogram-shell.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(miniprogram): 建立微信双工具小程序壳"
```

---

### Task 5: 实现微信节拍器音频适配

**Files:**
- Create: `miniprogram/adapters/metronome-audio.ts`
- Create: `tests/miniprogram-metronome-audio.test.ts`

**Interfaces:**
- Consumes:
  - `Meter`, `accentIndexes`, `nextBeat` from `generated/guitar-core/metronome`.
- Produces:
  - `type Timbre = "wood" | "electronic" | "mechanical"`
  - `TIMBRES`
  - `createMetronomeAudio(options)` returning `resume`, `schedule`, `cancelFrom`, `setTimbre`, `suspend`, `dispose`, `currentTime`, `state`.

- [ ] **Step 1: Write adapter tests with an injected fake context**

```ts
// tests/miniprogram-metronome-audio.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  createMetronomeAudio,
} from "../miniprogram/adapters/metronome-audio";
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
        exponentialRampToValueAt: vi.fn(),
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
  };
}

describe("mini metronome audio", () => {
  it("schedules and cancels future clicks", () => {
    const context = fakeContext();
    const audio = createMetronomeAudio({
      contextFactory: () => context as never,
      timbre: "electronic",
    });
    audio.schedule(0, 10.1, METERS[0]);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    audio.cancelFrom(10.05);
    expect(context.createOscillator.mock.results[0].value.stop).toHaveBeenCalledWith(0);
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
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/miniprogram-metronome-audio.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter by extracting parameters from `lib/metronome-audio.ts`**

Required public surface:

```ts
export type Timbre = "wood" | "electronic" | "mechanical";
export const TIMBRES = [
  { id: "wood", label: "木质" },
  { id: "electronic", label: "电子" },
  { id: "mechanical", label: "机械" },
] as const;

export function createMetronomeAudio(options: {
  timbre?: Timbre;
  contextFactory?: () => WechatMiniprogram.WebAudioContext;
}): {
  readonly timbre: Timbre;
  readonly state: string;
  readonly currentTime: number;
  setTimbre(next: Timbre): void;
  resume(): Promise<void>;
  schedule(beatIndex: number, time: number, meter: Meter): void;
  cancelFrom(time: number): void;
  suspend(): Promise<void>;
  dispose(): Promise<void>;
};
```

Implementation requirements:

- Copy the three `TIMBRE_SPECS` from `lib/metronome-audio.ts`.
- Reuse `isAccentBeat` and `clickParams` logic.
- Lazy-create context in `resume()`.
- Track `{ source, start, end }` in `scheduled`.
- `cancelFrom(time)` calls `source.stop(0)` for `start > time`.
- `dispose()` closes the context and clears all references.
- No `window`, `document`, `AudioContext`, or React references.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/miniprogram-metronome-audio.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/adapters/metronome-audio.ts tests/miniprogram-metronome-audio.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(miniprogram): 增加微信节拍器音频适配"
```

---

### Task 6: 实现圆盘与拍块组件

**Files:**
- Create: `miniprogram/components/bpm-dial/index.{ts,json,wxml,wxss}`
- Create: `miniprogram/components/beat-strip/index.{ts,json,wxml,wxss}`
- Create: `tests/miniprogram-metronome-components.test.ts`

**Interfaces:**
- Consumes:
  - `bpmToDialAngle`, `dialPointToBpm` from shared core.
- Produces:
  - `<bpm-dial value="{{bpm}}" bind:change="onDialChange" />`
  - `<beat-strip beats="{{beats}}" accents="{{accents}}" active="{{activeBeat}}" running="{{running}}" />`

- [ ] **Step 1: Write the component contract test**

```ts
// tests/miniprogram-metronome-components.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("metronome components", () => {
  it("uses a canvas dial with touch and slider semantics", () => {
    const wxml = read("miniprogram/components/bpm-dial/index.wxml");
    const ts = read("miniprogram/components/bpm-dial/index.ts");
    expect(wxml).toContain('type="2d"');
    expect(wxml).toContain("bindtouchstart");
    expect(wxml).toContain('aria-role="slider"');
    expect(ts).toContain("dialPointToBpm");
    expect(ts).toContain("triggerEvent(\"change\"");
  });

  it("renders one beat block per beat", () => {
    const wxml = read("miniprogram/components/beat-strip/index.wxml");
    expect(wxml).toContain("wx:for");
    expect(wxml).toContain("beat--active");
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/miniprogram-metronome-components.test.ts`

Expected: FAIL because the component files do not exist.

- [ ] **Step 3: Implement `beat-strip`**

`index.json`:

```json
{ "component": true }
```

`index.ts`:

```ts
Component({
  properties: {
    beats: { type: Number, value: 4 },
    accents: { type: Array, value: [] },
    active: { type: Number, value: 0 },
    running: { type: Boolean, value: false },
  },
});
```

`index.wxml`:

```xml
<view class="strip" aria-hidden="true">
  <view
    wx:for="{{beats}}"
    wx:key="*this"
    class="beat {{running && active === index ? 'beat--active' : ''}} {{accents.indexOf(index) >= 0 ? 'beat--accent' : ''}}"
  >
    <view class="beat__index">{{index + 1}}</view>
    <view class="beat__bar"></view>
    <view class="beat__bar"></view>
    <view class="beat__bar"></view>
  </view>
</view>
```

`index.wxss`:

```css
.strip {
  display: flex;
  gap: 10rpx;
  height: 132rpx;
}
.beat {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 10rpx;
  border: 2rpx solid var(--color-rule);
  border-radius: 20rpx;
  background: var(--color-surface-muted);
  box-sizing: border-box;
}
.beat--accent {
  border-color: var(--color-accent-100);
  background: var(--color-accent-50);
}
.beat--active {
  border-color: var(--color-accent-700);
  background: var(--color-accent-700);
}
.beat__index {
  position: absolute;
  top: 8rpx;
  right: 10rpx;
  color: var(--color-ink-500);
  font-size: 20rpx;
  font-variant-numeric: tabular-nums;
}
.beat__bar {
  flex: 1;
  border-radius: 4rpx;
  background: var(--color-ink-100);
}
.beat--active .beat__bar {
  background: rgba(255, 255, 255, 0.55);
}
```

- [ ] **Step 4: Implement `bpm-dial`**

Required behavior:

- `properties`: `value`, `min`, `max`.
- Canvas 2D draws a 270° ring from lower-left to lower-right.
- Touch inside the center 45% radius does not change BPM.
- Touch angle maps through `dialPointToBpm`.
- `bindtouchstart`, `bindtouchmove`, `bindtouchend`.
- `triggerEvent("change", { value })`.
- Outer `view` has `aria-role="slider"`, `aria-label="速度"`, and BPM text.
- Large BPM and `tempoName(value)` are WXML overlays, not canvas text.

Use these core calls:

```ts
import {
  clampBpm,
  dialPointToBpm,
  tempoName,
} from "../../generated/guitar-core";
```

Create `index.json`, `index.wxml`, `index.wxss`, and `index.ts` with complete canvas lifecycle:

```ts
Component({
  properties: {
    value: { type: Number, value: 90 },
  },
  data: {
    tempoName: tempoName(90),
  },
  observers: {
    value(next: number) {
      this.setData({ tempoName: tempoName(next) });
      this.draw();
    },
  },
  lifetimes: {
    ready() {
      this.prepareCanvas();
    },
  },
  methods: {
    prepareCanvas() {
      this.createSelectorQuery()
        .select("#dial")
        .fields({ node: true, size: true })
        .exec((result: any[]) => {
          const item = result[0];
          if (!item?.node) return;
          const dpr = wx.getSystemInfoSync().pixelRatio;
          item.node.width = item.width * dpr;
          item.node.height = item.height * dpr;
          const context = item.node.getContext("2d");
          context.scale(dpr, dpr);
          (this as any).dial = {
            canvas: item.node,
            context,
            size: Math.min(item.width, item.height),
          };
          this.draw();
        });
    },
    draw() {
      const dial = (this as any).dial;
      if (!dial) return;
      const { context: ctx, size } = dial;
      const value = clampBpm(this.data.value);
      const center = size / 2;
      const radius = center - 18;
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = "round";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#c9d1c8";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0.75 * Math.PI, 2.25 * Math.PI);
      ctx.stroke();
      const angle = ((bpmToDialAngle(value) - 90) * Math.PI) / 180;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      ctx.fillStyle = "#267b55";
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    },
    measure(callback: (rect: any) => void) {
      this.createSelectorQuery()
        .select(".dial-shell")
        .boundingClientRect((rect: any) => callback(rect))
        .exec();
    },
    updateFromTouch(event: any) {
      const touch = event.touches?.[0] ?? event.changedTouches?.[0];
      if (!touch) return;
      this.measure((rect: any) => {
        if (!rect) return;
        const dx = touch.clientX - (rect.left + rect.width / 2);
        const dy = touch.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance < Math.min(rect.width, rect.height) * 0.45 / 2) return;
        const value = dialPointToBpm(dx, dy);
        this.triggerEvent("change", { value });
      });
    },
    onTouchStart(event: any) {
      this.updateFromTouch(event);
    },
    onTouchMove(event: any) {
      this.updateFromTouch(event);
    },
  },
});
```

`index.wxml`:

```xml
<view
  class="dial-shell"
  aria-role="slider"
  aria-label="速度"
  aria-valuemin="30"
  aria-valuemax="240"
  aria-valuetext="每分钟 {{value}} 拍"
  bindtouchstart="onTouchStart"
  bindtouchmove="onTouchMove"
>
  <canvas type="2d" id="dial" class="dial"></canvas>
  <view class="dial__readout" aria-hidden="true">
    <text class="dial__bpm">{{value}}</text>
    <text class="dial__tempo">{{tempoName}}</text>
  </view>
</view>
```

Add the missing `bpmToDialAngle` import and set `.dial-shell` to a square with
`position: relative`, `.dial` to `width: 100%; height: 100%`, and
`.dial__readout` centered absolutely.

- [ ] **Step 5: Run component checks**

Run: `npx vitest run tests/miniprogram-metronome-components.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add miniprogram/components tests/miniprogram-metronome-components.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(miniprogram): 增加节拍圆盘与拍块组件"
```

---

### Task 7: 完成节拍器页面与生命周期

**Files:**
- Modify: `miniprogram/pages/metronome/index.{ts,wxml,wxss,json}`
- Create: `tests/miniprogram-metronome-page.test.ts`

**Interfaces:**
- Consumes:
  - Task 5 `createMetronomeAudio`
  - Task 6 `<bpm-dial>` and `<beat-strip>`
  - shared `METERS`, `clampBpm`, `nextBeat`, `bpmToIntervalMs`
- Produces: a runnable metronome page with start/stop and screen wake lock.

- [ ] **Step 1: Write page contract tests**

```ts
// tests/miniprogram-metronome-page.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ts = readFileSync("miniprogram/pages/metronome/index.ts", "utf8");
const wxml = readFileSync("miniprogram/pages/metronome/index.wxml", "utf8");

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
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/miniprogram-metronome-page.test.ts`

Expected: FAIL because the real page is not implemented.

- [ ] **Step 3: Implement page state and scheduler**

Use module-local runtime state:

```ts
import {
  BPM_DEFAULT,
  DEFAULT_METER,
  METERS,
  bpmToIntervalMs,
  clampBpm,
  nextBeat,
  type Meter,
} from "../../generated/guitar-core";
import {
  TIMBRES,
  createMetronomeAudio,
  type Timbre,
} from "../../adapters/metronome-audio";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const START_LEAD_S = 0.06;
const CHANGED_LEAD_S = 0.02;

type PendingClick = { beat: number; time: number };

const runtime = {
  audio: null as ReturnType<typeof createMetronomeAudio> | null,
  timer: null as number | null,
  phase: "idle" as "idle" | "running",
  meter: DEFAULT_METER as Meter,
  bpm: BPM_DEFAULT,
  timbre: "wood" as Timbre,
  nextBeatIndex: 0,
  nextBeatTime: 0,
  pending: [] as PendingClick[],
};

function resetRuntime() {
  runtime.timer = null;
  runtime.phase = "idle";
  runtime.meter = DEFAULT_METER;
  runtime.bpm = BPM_DEFAULT;
  runtime.timbre = "wood";
  runtime.nextBeatIndex = 0;
  runtime.nextBeatTime = 0;
  runtime.pending = [];
}
```

Page data:

```ts
data: {
  bpm: BPM_DEFAULT,
  meter: DEFAULT_METER,
  meters: METERS,
  timbres: TIMBRES,
  timbre: TIMBRES[0],
  activeBeat: 0,
  phase: "idle",
  status: "准备开始",
  wakeHint: "",
}
```

Required methods:

- `onLoad()` resets runtime and synchronizes data.
- `onHide()` and `onUnload()` call `this.stop()`.
- `onDialChange(event)` calls `this.changeBpm(event.detail.value)`.
- `toggle()` calls `this.stop()` when running, otherwise `this.start()`.
- `decrementBpm()` and `incrementBpm()` call `this.changeBpm(runtime.bpm - 1)` and `this.changeBpm(runtime.bpm + 1)`.
- `changeBpm(value)` updates runtime, data, and reschedules future clicks.
- `cycleMeter()` advances `METERS`, resets to beat 1, and reschedules when running.
- `cycleTimbre()` advances `TIMBRES`, calls `audio.setTimbre`, and reschedules future clicks.
- `start()` creates audio through `wx.createWebAudioContext`, awaits `resume()`, sets keep-screen-on, sets next beat time to `currentTime + START_LEAD_S`, and starts a 25ms interval.
- `tick()` schedules while `nextBeatTime < currentTime + SCHEDULE_AHEAD_S`.
- `tick()` removes due pending clicks and calls `setData({ activeBeat })` only when the beat changes.
- `stop()` clears the timer, cancels future clicks, sets keep-screen-on false, closes audio, resets active beat and phase, and calls `setData`.
- `changeBpm`, `cycleMeter`, and `cycleTimbre` use `cancelFrom(now)` before rescheduling.

Exact `tick()` scheduling rule:

```ts
const now = runtime.audio.currentTime;
while (runtime.nextBeatTime < now + SCHEDULE_AHEAD_S) {
  const beat = runtime.nextBeatIndex;
  const time = runtime.nextBeatTime;
  runtime.audio.schedule(beat, time, runtime.meter);
  runtime.pending.push({ beat, time });
  runtime.nextBeatIndex = nextBeat(beat, runtime.meter);
  runtime.nextBeatTime = time + bpmToIntervalMs(runtime.bpm) / 1000;
}
```

Rescheduling rule:

```ts
const now = runtime.audio.currentTime;
const future = runtime.pending.filter((click) => click.time > now);
runtime.audio.cancelFrom(now);
runtime.pending = [];
const anchor = future[0] ?? {
  beat: runtime.nextBeatIndex,
  time: now + CHANGED_LEAD_S,
};
runtime.nextBeatIndex = anchor.beat;
runtime.nextBeatTime = anchor.time;
```

- [ ] **Step 4: Implement the WXML**

Use this structure:

```xml
<view class="page metronome">
  <view class="metronome__status">
    <text class="metronome__meter">{{meter.label}}</text>
    <text class="metronome__phase">{{status}}</text>
  </view>

  <beat-strip
    beats="{{meter.beatsPerBar}}"
    accents="{{meter.accents}}"
    active="{{activeBeat}}"
    running="{{phase === 'running'}}"
  />

  <view class="metronome__dial">
    <bpm-dial value="{{bpm}}" bind:change="onDialChange" />
    <view class="metronome__steps">
      <button class="step" bindtap="decrementBpm" aria-label="减速 1 BPM">−</button>
      <button class="step" bindtap="incrementBpm" aria-label="加速 1 BPM">+</button>
    </view>
  </view>

  <view class="metronome__transport">
    <button class="tool-button" bindtap="cycleMeter">
      <text class="tool-button__label">拍号</text>
      <text class="tool-button__value">{{meter.label}}</text>
    </button>
    <button
      class="play-button {{phase === 'running' ? 'play-button--stop' : ''}}"
      bindtap="toggle"
      aria-label="{{phase === 'running' ? '停止' : '开始'}}"
    >
      {{phase === 'running' ? '停止' : '开始'}}
    </button>
    <button class="tool-button" bindtap="cycleTimbre">
      <text class="tool-button__label">音色</text>
      <text class="tool-button__value">{{timbre.label}}</text>
    </button>
  </view>

  <text class="metronome__hint">{{wakeHint}}</text>
</view>
```

Register components in `index.json`:

```json
{
  "usingComponents": {
    "bpm-dial": "../../components/bpm-dial/index",
    "beat-strip": "../../components/beat-strip/index"
  },
  "navigationBarTitleText": "节拍器"
}
```

Add page WXSS for a full-height flex column: beat strip fixed, dial flexible,
transport fixed, 64px play button, 44px step/tool buttons, safe-area padding.

- [ ] **Step 5: Run tests and type-check**

Run:

```bash
npx vitest run tests/miniprogram-metronome-page.test.ts tests/miniprogram-metronome-audio.test.ts
npm run mini:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/metronome tests/miniprogram-metronome-page.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(miniprogram): 完成节拍器页面"
```

---

### Task 8: 实现录音适配器与采样率回退

**Files:**
- Create: `miniprogram/adapters/recorder-pcm.ts`
- Create: `tests/miniprogram-recorder-pcm.test.ts`

**Interfaces:**
- Consumes:
  - `pcm16ToFloat32` from shared core.
  - `wx.getRecorderManager()` when no manager is injected.
- Produces:
  - `createRecorderPcm(options)` with `start(): Promise<number>`, `stop(): void`, `dispose(): void`, `isRunning(): boolean`.
  - `toPcmFrame(buffer: ArrayBuffer): Float32Array` re-export for tests.

- [ ] **Step 1: Write tests with a fake RecorderManager**

```ts
// tests/miniprogram-recorder-pcm.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  createRecorderPcm,
  toPcmFrame,
} from "../miniprogram/adapters/recorder-pcm";

function manager() {
  const callbacks: Record<string, (value?: unknown) => void> = {};
  return {
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
    stop: vi.fn(() => callbacks.stop?.()),
    emitFrame: (buffer: ArrayBuffer) =>
      callbacks.frame?.({ frameBuffer: buffer, isLastFrame: false }),
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
    adapter.dispose();
  });

  it("ignores frames after stop", () => {
    const onFrame = vi.fn();
    const fake = manager();
    const adapter = createRecorderPcm({
      manager: fake as never,
      rates: [44100],
      onFrame,
      onError: vi.fn(),
      onState: vi.fn(),
    });
    fake.start({ sampleRate: 44100 });
    adapter.stop();
    fake.emitFrame(new ArrayBuffer(4));
    expect(onFrame).not.toHaveBeenCalled();
    adapter.dispose();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/miniprogram-recorder-pcm.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter**

Required behavior:

- `toPcmFrame()` delegates to `pcm16ToFloat32`.
- `start()` registers one set of callbacks, tries rates in order until `onStart`.
- `onError` during an attempt advances to the next rate; once running, it calls `onError` and stops.
- Successful start resolves with the active sample rate.
- `onFrameRecorded` ignores frames unless running and calls `onFrame(toPcmFrame(frameBuffer), activeRate)`.
- `onStop` restarts recording only if the page still wants to listen and the stop came from the 10-minute duration limit.
- `stop()` marks the session inactive before calling `manager.stop()`.
- `dispose()` stops and calls available `off*` methods once.

Use this public type shape:

```ts
export type RecorderPcmOptions = {
  manager?: WechatMiniprogram.RecorderManager;
  rates?: readonly number[];
  frameSize?: number;
  duration?: number;
  onFrame(samples: Float32Array, sampleRate: number): void;
  onError(message: string): void;
  onState(state: "starting" | "listening" | "stopped"): void;
};
```

Use `duration: 600000` and `frameSize: 8` by default.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/miniprogram-recorder-pcm.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/adapters/recorder-pcm.ts tests/miniprogram-recorder-pcm.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(miniprogram): 增加麦克风 PCM 适配"
```

---

### Task 9: 完成调音器指针组件与页面

**Files:**
- Create: `miniprogram/components/tuner-gauge/index.{ts,json,wxml,wxss}`
- Modify: `miniprogram/pages/tuner/index.{ts,wxml,wxss,json}`
- Create: `tests/miniprogram-tuner-page.test.ts`

**Interfaces:**
- Consumes:
  - Task 3 `PitchDetector`
  - Task 8 `createRecorderPcm`
  - `TUNING_PRESETS`, `nearestString`, `noteAtFrequency`, `describeCents`, `centsBetween`
- Produces: a working tuner page.

- [ ] **Step 1: Write page contract tests**

```ts
// tests/miniprogram-tuner-page.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ts = readFileSync("miniprogram/pages/tuner/index.ts", "utf8");
const wxml = readFileSync("miniprogram/pages/tuner/index.wxml", "utf8");

describe("tuner page", () => {
  it("requests microphone permission and stops on hide", () => {
    expect(ts).toContain("scope.record");
    expect(ts).toContain("onHide()");
    expect(ts).toContain("stopTuning()");
  });

  it("uses 4096-sample pitch detection and median smoothing", () => {
    expect(ts).toContain("new PitchDetector");
    expect(ts).toContain("medianFrequency");
    expect(ts).toContain("55");
    expect(ts).toContain("400");
  });

  it("renders automatic, manual and chromatic states", () => {
    expect(wxml).toContain("自动");
    expect(wxml).toContain("手动锁弦");
    expect(wxml).toContain("半音阶");
    expect(wxml).toContain("tuner-gauge");
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/miniprogram-tuner-page.test.ts`

Expected: FAIL because the tuner page is not implemented.

- [ ] **Step 3: Implement `tuner-gauge`**

Properties: `cents`, `direction`, `stable`.

- Clamp needle to `[-50, 50]`.
- Compute `needlePercent = (clamped + 50) / 100`.
- WXML shows a left/right scale, a needle, and the text `偏低 / 准 / 偏高`.
- `stable` uses accent color and `aria-label="已调准"`.

`index.wxml`:

```xml
<view class="gauge" aria-label="{{directionText}} {{cents}} 音分">
  <view class="gauge__scale">
    <text>-50</text>
    <text>0</text>
    <text>+50</text>
  </view>
  <view class="gauge__track">
    <view class="gauge__zero"></view>
    <view class="gauge__needle {{stable ? 'gauge__needle--stable' : ''}}" style="left: {{needlePercent}}%;"></view>
  </view>
  <text class="gauge__text">{{directionText}} {{cents}}¢</text>
</view>
```

- [ ] **Step 4: Implement tuner page state**

Page data must include:

```ts
{
  preset: TUNING_PRESETS[0],
  presetIndex: 0,
  chromatic: false,
  mode: "auto",
  manualStringId: "",
  state: "idle",
  statusText: "准备调音",
  noteText: "—",
  cents: 0,
  directionText: "等待声音",
  stable: false,
  listening: false,
}
```

Required behavior:

- `startTuning()` checks `wx.getSetting()`, calls `wx.authorize({ scope: "scope.record" })`, then starts the recorder adapter.
- Denied permission calls `wx.showModal` and exposes `openSettings()` using `wx.openSetting`.
- `onFrame(samples, sampleRate)` computes `rms`; if below `10 ** (-50 / 20)`, sets status “声音太小”.
- Otherwise calls `detector.detect(samples, sampleRate)`; null sets status “信号不稳定”.
- Valid frequencies keep a 5-value history and use `medianFrequency()`.
- In auto mode, `nearestString()` selects the current string.
- In manual mode, cents are calculated against the selected target.
- In chromatic mode, `noteAtFrequency()` supplies note name, octave and cents.
- The “准” state requires `Math.abs(cents) <= 3` for at least 200ms.
- `stopTuning()` stops the adapter, clears history, and returns to `idle`.
- `onHide()` and `onUnload()` call `stopTuning()`.
- Preset cycling uses `TUNING_PRESETS`; entering chromatic clears manual lock and hides string buttons.
- Tapping a string sets `mode: "manual"` and `manualStringId`; tapping the mode chip resets to auto.

`medianFrequency` is a page-local pure helper:

```ts
function medianFrequency(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
```

- [ ] **Step 5: Implement tuner WXML**

Required structure:

```xml
<view class="page tuner">
  <view class="tuner__toolbar">
    <button class="chip" bindtap="cyclePreset">{{preset.label}}</button>
    <button class="chip" bindtap="resetMode">{{mode === 'manual' ? '手动锁弦' : '自动'}}</button>
    <button class="tuner__start" bindtap="toggleTuning">
      {{listening ? '停止调音' : '开始调音'}}
    </button>
  </view>

  <view class="tuner__reading">
    <text class="tuner__note">{{noteText}}</text>
    <tuner-gauge
      cents="{{cents}}"
      direction="{{directionText}}"
      stable="{{stable}}"
    />
  </view>

  <view wx:if="{{!chromatic}}" class="strings">
    <button
      wx:for="{{preset.strings}}"
      wx:key="id"
      class="string {{manualStringId === item.id ? 'string--locked' : ''}}"
      data-id="{{item.id}}"
      bindtap="selectString"
    >
      <text class="string__note">{{item.label}}</text>
      <text class="string__number">{{item.id}} 弦</text>
    </button>
  </view>

  <text class="tuner__status">{{statusText}}</text>
</view>
```

Register `tuner-gauge` in the page `.json`.

- [ ] **Step 6: Add styling**

Use the existing palette. Requirements:

- Toolbar wraps within 375px.
- Preset and mode chips are at least 44px high.
- Start button is at least 44px, visually primary.
- Six string buttons fit in one row on 390px and wrap to two rows below 360px.
- Note display uses at least 64px type.
- Gauge has a center zero mark and clear needle.
- Direction text is visible without relying on color.

- [ ] **Step 7: Run tests and type-check**

Run:

```bash
npx vitest run tests/miniprogram-tuner-page.test.ts tests/miniprogram-recorder-pcm.test.ts
npm run mini:check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add miniprogram/components/tuner-gauge miniprogram/pages/tuner tests/miniprogram-tuner-page.test.ts
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "feat(miniprogram): 完成调音器页面"
```

---

### Task 10: 边界守护、文档与全量验证

**Files:**
- Create: `tests/miniprogram-boundaries.test.ts`
- Modify: `README.md`
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: documented commands and automated guards for platform isolation and lifecycle cleanup.

- [ ] **Step 1: Write the boundary test**

```ts
// tests/miniprogram-boundaries.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe("mini program boundaries", () => {
  it("keeps wx APIs out of guitar-core", () => {
    for (const path of files("packages/guitar-core/src")) {
      expect(readFileSync(path, "utf8")).not.toMatch(/\bwx\./);
    }
  });

  it("keeps React and Next out of the mini program", () => {
    for (const path of files("miniprogram")) {
      if (!/\.(ts|wxml|wxss)$/.test(path)) continue;
      expect(readFileSync(path, "utf8")).not.toMatch(/from ["']react|next\//);
    }
  });

  it("stops both tools on hide", () => {
    expect(readFileSync("miniprogram/pages/metronome/index.ts", "utf8")).toContain("onHide()");
    expect(readFileSync("miniprogram/pages/tuner/index.ts", "utf8")).toContain("onHide()");
  });
});
```

- [ ] **Step 2: Run the boundary test**

Run: `npx vitest run tests/miniprogram-boundaries.test.ts`

Expected: PASS.

- [ ] **Step 3: Update README**

Add a section:

```md
## 微信小程序

`miniprogram/` 是独立的微信原生小程序，只包含节拍器与调音器。

```bash
npm run mini:core
npm run mini:check
```

用微信开发者工具打开 `miniprogram/`。本地测试可使用 `touristappid`，
发布前在开发者工具中填入正式 AppID。
```

- [ ] **Step 4: Update DEVELOPMENT.md**

Add `miniprogram/` to the repository structure table and add:

```md
小程序改动至少运行：

npm run mini:check && npx vitest run tests/miniprogram-*.test.ts
```

- [ ] **Step 5: Run the complete automated gate**

Run:

```bash
npm run mini:core
npm run typecheck
npm test
npm run build
```

Expected:

- `mini:core` emits shared JS and declarations.
- `typecheck` exits 0.
- `npm test` reports all tests passing.
- `next build` completes static export to `out/`.

- [ ] **Step 6: Run the WeChat manual gate**

Open `miniprogram/` in WeChat DevTools with base library 2.19.0:

- Both tabs open without console errors.
- Metronome starts, stops, changes BPM/meter/timbre without leaked clicks.
- `onHide` stops metronome and releases audio.
- Tuner permission denial shows settings entry.
- Tuner permission approval starts PCM frames.
- Standard, Drop D, half-step and chromatic modes render.
- Auto selection and manual string lock both work.
- On iPhone and Android, hide the mini program while each tool is running and confirm no audio or recording continues.

- [ ] **Step 7: Commit**

```bash
git add tests/miniprogram-boundaries.test.ts README.md DEVELOPMENT.md
git -c user.name='DamonRock' -c user.email='jr.way123@gmail.com' \
  commit -m "test(miniprogram): 补齐边界与交付文档"
```

---

## 完成标准

- 微信开发者工具能直接打开 `miniprogram/`，两个 Tab 都可运行。
- 节拍器完整覆盖现有 PWA 的前台功能。
- 调音器在真机上完成三种预设、半音阶、自动与手动锁弦。
- `npm run typecheck && npm test && npm run build` 通过。
- `npm run mini:check` 通过。
- 明确记录真机验证结果；若某 Android 机型不支持 48kHz，44.1kHz 回退仍可用。
