/**
 * 节奏型的纯逻辑。
 *
 * 网格约定：一小节 4/4 = 16 个十六分音符位，索引 0 起。
 * 拍号与重音规则复用 `lib/metronome.ts` 的 METERS / accentIndexes，
 * 不在这里另写一份拍号模型——research/practice.md §4 M5 的结论是
 * 「拍号重音就是分组锚点」，两处模型一旦分叉，分组就会和节拍器对不上。
 *
 * 节奏型用一串字符写出来，方便肉眼核对：
 *   x = 击弦（真正出声）
 *   g = 留白，但右手保持运动（暗示律动而不实弹）
 *   . = 完全留白
 *
 * 这个模块不碰 DOM，可以在 node（vitest）下直接 import。
 */

import { METERS, accentIndexes, type Meter } from "@/lib/metronome";

/** 一小节 4/4 的十六分音符位数，也是这一页画布的格数 */
export const GRID_LENGTH = 16;

/** 格子状态 */
export type CellKind = "strike" | "ghost" | "rest";

/**
 * 画布上的格子状态：在格子种类之外再加一种「不属于这一小节」。
 * 6/8 一小节 12 格、7/8 一小节 14 格，画布始终是 16 格，
 * 多出来的那几格属于下一小节，标出来比藏起来更省心。
 */
export type CanvasCell = CellKind | "outside";

export type RhythmPattern = {
  id: string;
  /** 全名，用于标题与说明 */
  name: string;
  /** 芯片上的短名 */
  short: string;
  /** 一句话说明这个节奏型在弹什么 */
  summary: string;
  /** 16 格：击弦 / 留白但手在动 / 完全留白 */
  cells: readonly CellKind[];
  /** 节奏型自身的重音格（0 起） */
  accents: readonly number[];
  /** 建议的起步 BPM 区间 */
  bpm: readonly [number, number];
  /** 怎么练 */
  practice: readonly string[];
};

/** 模式串 → 格子 */
function parseGrid(spec: string): CellKind[] {
  if (spec.length !== GRID_LENGTH) {
    throw new Error(`节奏型网格必须是 ${GRID_LENGTH} 格，收到 ${spec.length} 格`);
  }
  return [...spec].map((char) => {
    if (char === "x") return "strike" as const;
    if (char === "g") return "ghost" as const;
    if (char === ".") return "rest" as const;
    throw new Error(`未知的格子记号：${char}`);
  });
}

/**
 * 节奏型表。
 *
 * 顺序即芯片顺序：从最基础的八分音符走到十六分全弹，再到留白与切分。
 * 每个网格都是 4/4 一小节 16 个十六分位；换拍号时按小节长度取前若干格。
 */
export const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  {
    id: "eighth-notes",
    name: "八分音符",
    short: "八分音符",
    summary: "每拍两个音：1 和 and，方向交替。",
    cells: parseGrid("x.x.x.x.x.x.x.x."),
    accents: [0],
    bpm: [80, 110],
    practice: [
      "先把每拍两个八分弹成「下—上」，只用手腕，手肘不要跟着甩。",
      "左手先只触不按做闷音，眼睛只看右手：两下要一样密、一样轻。",
      "第 1 拍的第一下加重，其余轻——这是后面所有分组练习的底子。",
    ],
  },
  {
    id: "quarter-and-eighth",
    name: "四八分",
    short: "四八分",
    summary: "四个四分打底，第 2、4 拍后半各补一个八分：1、2&、3、4&。",
    cells: parseGrid("x...x.x..x...x.x"),
    accents: [0, 8],
    bpm: [70, 100],
    practice: [
      "先只弹第 1、3 拍的两个四分音符（两下一小节），稳了再补第 2、4 拍后半。",
      "补的时候出声数「1 2 3 4&」，漏掉一个八分就算这遍没过。",
      "第 2、4 拍后半的八分用上扫，音量要比四分轻，不要盖住强拍。",
    ],
  },
  {
    id: "samba",
    name: "桑巴",
    short: "桑巴",
    summary: "十六分骨架上的切分：每拍三下（1、&、a），第 1、3 拍加重。",
    cells: parseGrid("x.xxx.xxx.xxx.xx"),
    accents: [0, 8],
    bpm: [70, 100],
    practice: [
      "用闷音在 7 品只触不按做闷音，先只弹重音（第 1、3 拍），把它钉在节拍器的重音上。",
      "再补每拍的 & 和 a：切分音要轻，重音仍然是这一小节的骨架。",
      "换和弦时优先让左手在重音那一下到位，切分音是手腕的事。",
    ],
  },
  {
    id: "sixteenth-full",
    name: "十六分全弹",
    short: "16 分全弹",
    summary: "16 个十六分全部出声：最费力的一种弹法，用来对照。",
    cells: parseGrid("xxxxxxxxxxxxxxxx"),
    accents: [0],
    bpm: [60, 80],
    practice: [
      "60–75 BPM 起步：右手连续扫十六分，1 用下扫、2 用上扫，先不加任何重音。",
      "左手只触不按做闷音，专注扫弦手均匀、不碰错弦、不吃音。",
      "连续十遍没有错位再 +5 BPM；错位就退回上一档重练，不要硬顶。",
    ],
  },
  {
    id: "sixteenth-ghost",
    name: "十六分留白",
    short: "16 分留白",
    summary:
      "Sex Machine 式：1 和 and 出声，e 和 a 不碰弦，但扫弦手一直在动。",
    cells: parseGrid("xgxgxgxgxgxgxgxg"),
    accents: [0],
    bpm: [80, 110],
    practice: [
      "1 和 and 一定下扫，e 和 a 一定上扫——只是 e 和 a 不碰到弦。",
      "关键在于手不能停：留白的十六分里，扫弦手照样走完上下行程。",
      "先用 60–75 BPM 确认「一拍只出两个音、手却没停」，再往上提速。",
    ],
  },
  {
    id: "dotted-eighth",
    name: "附点八分",
    short: "附点八分",
    summary: "长—短交替：每拍一个附点八分加一个十六分，数「1 a 2 a」。",
    cells: parseGrid("x..xx..xx..xx..x"),
    accents: [0],
    bpm: [90, 120],
    practice: [
      "先只弹每拍的第一个长音（四个音一小节），把它拖够长。",
      "再补每拍第二个短音：它紧跟在长音后面，两个音的音量要一样大。",
      "长短差是听感的全部：长音不够长、两个音音量不一致，一听就露。",
    ],
  },
  {
    id: "shuffle",
    name: "摇摆",
    short: "shuffle",
    summary:
      "和八分音符同一张格子，区别在长短：1-la-2-la-3-la-4-la，4/4 里重音落在第 1、3 拍。",
    cells: parseGrid("x.x.x.x.x.x.x.x."),
    accents: [0, 8],
    bpm: [80, 110],
    practice: [
      "心里数「1-la-2-la-3-la-4」，嘴上仍然说「1 和 2 和」，手按八分走。",
      "摇摆的重音落在第 1、3 拍，第 4 拍后半留空，音符拖到下一小节。",
      "先用闷音练：长短不均最容易在闷音里被听出来。",
    ],
  },
  {
    id: "triplet-feel",
    name: "三连音感",
    short: "3 连音感",
    summary: "每拍三个音，长-短短。格子上是近似位置，只表示先后。",
    cells: parseGrid("xx.xxx.xxx.xxx.x"),
    accents: [0, 8],
    bpm: [60, 80],
    practice: [
      "先用一个音做三连音：每拍三个，均匀的「du-ku-du-ku-du-ku」。",
      "60–70 BPM 起，把每拍三个音分清楚：长-短短（1-la-2-la）。",
      "格子上的位置是近似的，只表示先后；精确时值靠节拍器，不靠眼睛。",
    ],
  },
];

/** 「十六分全弹」是所有对比的基准 */
export const FULL_PATTERN_ID = "sixteenth-full";

export function patternById(id: string): RhythmPattern {
  const found = RHYTHM_PATTERNS.find((pattern) => pattern.id === id);
  if (found) return found;
  const fallback = RHYTHM_PATTERNS[0];
  if (!fallback) throw new Error("节奏型表是空的");
  return fallback;
}

/** 一拍占几个十六分音符位：四分音符一拍 = 4 格，八分音符一拍 = 2 格 */
export function cellsPerBeat(meter: Meter): number {
  return meter.beatUnit === 8 ? 2 : 4;
}

/** 一小节有几个十六分音符位（4/4 = 16，6/8 = 12，7/8 = 14） */
export function barCells(meter: Meter): number {
  return meter.beatsPerBar * cellsPerBeat(meter);
}

/**
 * 这一页能用的拍号：一小节长度必须放得进 16 格的画布。
 * 5/4 需要 20 格，放不下，所以不出现在选择器里。
 */
export const RHYTHM_METERS: readonly Meter[] = METERS.filter(
  (meter) => barCells(meter) <= GRID_LENGTH,
);

function kindAt(pattern: RhythmPattern, index: number): CellKind {
  return pattern.cells[index] ?? "rest";
}

/**
 * 画布上某一格的状态。
 * 超出这一小节长度（6/8、7/8 的尾巴）返回 "outside"。
 */
export function canvasCell(
  pattern: RhythmPattern,
  index: number,
  meter: Meter,
): CanvasCell {
  if (index >= barCells(meter)) return "outside";
  return kindAt(pattern, index);
}

/** 某一类格子在小节内的下标（0 起） */
export function indexesOf(
  pattern: RhythmPattern,
  kind: CellKind,
  limit = GRID_LENGTH,
): number[] {
  const result: number[] = [];
  for (let index = 0; index < Math.min(limit, pattern.cells.length); index += 1) {
    if (kindAt(pattern, index) === kind) result.push(index);
  }
  return result;
}

/** 每小节击弦次数 */
export function strikeCount(pattern: RhythmPattern, limit = GRID_LENGTH): number {
  return indexesOf(pattern, "strike", limit).length;
}

/** 每小节「留白但手在动」的格数 */
export function ghostCount(pattern: RhythmPattern, limit = GRID_LENGTH): number {
  return indexesOf(pattern, "ghost", limit).length;
}

/** 每小节完全留白的格数 */
export function restCount(pattern: RhythmPattern, limit = GRID_LENGTH): number {
  return indexesOf(pattern, "rest", limit).length;
}

/** 击弦密度：击弦数 ÷ 小节格数 */
export function density(pattern: RhythmPattern, limit = GRID_LENGTH): number {
  if (limit <= 0) return 0;
  return strikeCount(pattern, limit) / limit;
}

/** 相对「十六分全弹」省下多少次击弦 */
export function savedStrikes(pattern: RhythmPattern, limit = GRID_LENGTH): number {
  const full = RHYTHM_PATTERNS.find((item) => item.id === FULL_PATTERN_ID);
  if (!full) return 0;
  return strikeCount(full, limit) - strikeCount(pattern, limit);
}

/** 拍号的重音拍落在网格上的哪几格 */
export function meterAccentCells(meter: Meter): number[] {
  const perBeat = cellsPerBeat(meter);
  return accentIndexes(meter).map((beat) => beat * perBeat);
}

/**
 * 网格上要标重音的格：节奏型自身的重音 ∪ 拍号的重音。
 * 两者重合时只算一格。
 */
export function accentCells(pattern: RhythmPattern, meter: Meter): number[] {
  const limit = barCells(meter);
  const merged = new Set<number>([...pattern.accents, ...meterAccentCells(meter)]);
  return [...merged].filter((index) => index < limit).sort((a, b) => a - b);
}

/** 每格的数拍口诀：四分音符一拍是「1 e & a」，八分音符一拍是「1 &」 */
export function countLabels(meter: Meter): string[] {
  const perBeat = cellsPerBeat(meter);
  const labels: string[] = [];
  for (let beat = 0; beat < meter.beatsPerBar; beat += 1) {
    if (perBeat >= 4) labels.push(String(beat + 1), "e", "&", "a");
    else labels.push(String(beat + 1), "&");
  }
  return labels;
}

/** 一组节奏：按重音切出来的一小段 */
export type RhythmGroup = {
  /** 1 起 */
  index: number;
  /** 起始格（0 起，含） */
  startCell: number;
  /** 结束格（0 起，含） */
  endCell: number;
  /** 在拍号里的起始拍（0 起） */
  beatStart: number;
  /** 在拍号里的结束拍（0 起，含） */
  beatEnd: number;
  /** 组首是否落在重音上 */
  accent: boolean;
  /** 「第 1 拍」或「第 1–3 拍」 */
  beatLabel: string;
  /** 「第 1 组：重音 → 第 1 拍（十六分第 1–4 格）」 */
  description: string;
  /** 这一组具体怎么练 */
  instruction: string;
};

/**
 * 把小节按重音切成可以练的组。
 *
 * 分组锚点的优先级：
 * 1. 拍号本身有多个重音（6/8、7/8）——它们的听感结构由拍号决定：
 *    6/8 是 3+3，7/8 是 2+2+3，直接按重音切。
 * 2. 其余拍号（4/4、3/4、2/4）只有第 1 拍一个重音，按拍分组：
 *    每拍一组，重音落在第一组，其余组靠节拍器的拍点对齐。
 *    节奏型自己另有重音时（例如桑巴落在第 1、3 拍），那一组也会被标出来——
 *    这正是「在你想让重音落的地方分」。
 */
export function rhythmGroups(meter: Meter, pattern?: RhythmPattern): RhythmGroup[] {
  const perBeat = cellsPerBeat(meter);
  const meterAccents = accentIndexes(meter);
  const patternAccentBeats =
    pattern && pattern.accents.length > 0
      ? [...new Set(pattern.accents.map((cell) => Math.floor(cell / perBeat)))].sort(
          (a, b) => a - b,
        )
      : [];
  const accentBeats = new Set<number>([...meterAccents, ...patternAccentBeats]);

  const starts =
    meterAccents.length >= 2
      ? meterAccents
      : Array.from({ length: meter.beatsPerBar }, (_, index) => index);

  return starts.map((beatStart, position) => {
    const nextStart = starts[position + 1];
    const beatEnd = (nextStart ?? meter.beatsPerBar) - 1;
    const startCell = beatStart * perBeat;
    const endCell = (beatEnd + 1) * perBeat - 1;
    const accent = accentBeats.has(beatStart);
    const beatLabel =
      beatStart === beatEnd
        ? `第 ${beatStart + 1} 拍`
        : `第 ${beatStart + 1}–${beatEnd + 1} 拍`;

    const group: RhythmGroup = {
      index: position + 1,
      startCell,
      endCell,
      beatStart,
      beatEnd,
      accent,
      beatLabel,
      description: `第 ${position + 1} 组：${accent ? "重音 → " : ""}${beatLabel}（十六分第 ${
        startCell + 1
      }–${endCell + 1} 格）`,
      instruction: "",
    };

    group.instruction = accent
      ? `先只弹这一组的头一个音（十六分第 ${startCell + 1} 格），对齐节拍器的重音；连续十遍都对上了，再把这一组整组填满。`
      : `这一组没有重音。先用嘴数着${beatLabel}把这组的位置走准，再把组内的音一个个填进去。`;

    return group;
  });
}

/** 某一格区间里的击弦次数 */
export function strikesInRange(
  pattern: RhythmPattern,
  startCell: number,
  endCell: number,
): number {
  let count = 0;
  for (let index = startCell; index <= endCell; index += 1) {
    if (kindAt(pattern, index) === "strike") count += 1;
  }
  return count;
}

/** 下标列表 → 「1、3、5」 */
export function formatIndexes(indexes: readonly number[]): string {
  if (indexes.length === 0) return "无";
  return indexes.map((index) => String(index + 1)).join("、");
}

/** 网格的无障碍描述：读屏靠它拿到这一格到底是击弦还是留白 */
export function describeGrid(pattern: RhythmPattern, meter: Meter): string {
  const limit = barCells(meter);
  const strikes = indexesOf(pattern, "strike", limit);
  const ghosts = indexesOf(pattern, "ghost", limit);
  const accents = accentCells(pattern, meter);
  const outside = GRID_LENGTH - limit;

  const parts = [`节奏型「${pattern.name}」`];
  parts.push(
    outside > 0
      ? `${meter.label} 一小节 ${limit} 个十六分音符位，画布共 ${GRID_LENGTH} 格（末尾 ${outside} 格不属于这一小节）`
      : `${meter.label} 一小节 ${limit} 个十六分音符位`,
  );
  parts.push(`击弦在第 ${formatIndexes(strikes)} 格`);
  if (ghosts.length > 0) {
    parts.push(`留白但右手保持运动的是第 ${formatIndexes(ghosts)} 格`);
  }
  parts.push(`重音在第 ${formatIndexes(accents)} 格`);
  return `${parts.join("，")}。`;
}

/** 某个 BPM 下一个十六分音符有多长（毫秒） */
export function sixteenthDurationMs(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0;
  return 60000 / bpm / 4;
}

/** 起步速度建议：慢练判据 + 提速阶梯 */
export function bpmAdvice(pattern: RhythmPattern): string {
  const [low, high] = pattern.bpm;
  return `从 ${low} BPM 起步（每小节 ${strikeCount(pattern)} 次击弦，密度 ${Math.round(
    density(pattern) * 100,
  )}%）。连续十遍没有错位再 +5 BPM；到 ${high} 还不稳，说明是速度问题不是节奏问题，退回 ${low} 慢练。`;
}

/** 留白型相对全弹省下的击弦，写成人话 */
export function savingAdvice(pattern: RhythmPattern, limit = GRID_LENGTH): string {
  const saved = savedStrikes(pattern, limit);
  if (saved <= 0) {
    return "这已经是每小节的击弦上限，没有可省的部分。";
  }
  const full = patternById(FULL_PATTERN_ID);
  const percent = Math.round((saved / Math.max(1, strikeCount(full, limit))) * 100);
  return `每小节比十六分全弹少 ${saved} 次击弦（少 ${percent}%），少掉的那几下正是「暗示律动但不实弹」的位置。`;
}
