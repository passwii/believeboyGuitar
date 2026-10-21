/**
 * 和弦库的纯逻辑。
 *
 * 音位本身来自 lib/guitar.ts 的 practicalChordVoicings：
 * 那是由标准调弦与音程组合推导出来的，不是手抄的指法表。
 * 这一层只做展示层的事——排序、分格、名称拼写、场景建议。
 *
 * 约定：本文件里不得出现任何具体的指法（几弦几品）。
 * 那种数字一旦调弦或音程定义变化就会变成错的，而且不会被任何测试发现。
 */

import {
  practicalChordVoicings,
  type ChordType,
  type ChordVoicing,
} from "@/lib/guitar";

/** 指板品数上限。再往上的位置对手型没有意义。 */
export const CHORD_MAX_FRET = 15;

/** 位宽上限：最高与最低品位相差超过这个数，手指就够不到。 */
export const CHORD_MAX_SPAN = 4;

/** 一次查表的参数 */
export type ChordQuery = {
  /** 根音名，如 "C" */
  root: string;
  /** 性质 id，如 "major" */
  typeId: string;
  /** 是否包含最低音不是根音的转位 */
  includeInversions: boolean;
};

/** 查一个和弦的全部实用音位。数据来自推导函数，不是查表。 */
export function queryChordVoicings(query: ChordQuery): ChordVoicing[] {
  const voicings = practicalChordVoicings(query.root, query.typeId, {
    maxFret: CHORD_MAX_FRET,
    maxSpan: CHORD_MAX_SPAN,
    rootPositionOnly: !query.includeInversions,
  });
  return sortVoicingsByPitch(voicings);
}

/** 按最低音从低到高排列。同一最低音时用品位与弦号兜底。 */
export function sortVoicingsByPitch(voicings: ChordVoicing[]): ChordVoicing[] {
  return [...voicings].sort((a, b) => {
    const aBass = a.notes[0].midi;
    const bBass = b.notes[0].midi;
    if (aBass !== bBass) return aBass - bBass;
    if (a.bassFret !== b.bassFret) return a.bassFret - b.bassFret;
    return a.bassStringNumber - b.bassStringNumber;
  });
}

/** 速查表与按法图里的一格：某根弦按什么 */
export type StringCell = {
  /** 弦号，6 = 最粗的低音弦 */
  stringNumber: number;
  /** 品位；null = 这根弦不弹 */
  fret: number | null;
  /** 音名；null = 不弹 */
  name: string | null;
  /** 是不是根音 */
  isRoot: boolean;
};

/** 把一个音位摊成六根弦的格子。索引 0 是 6 弦，与六线谱的读法一致。 */
export function stringCells(voicing: ChordVoicing): StringCell[] {
  const cells: StringCell[] = [6, 5, 4, 3, 2, 1].map((stringNumber) => ({
    stringNumber,
    fret: null,
    name: null,
    isRoot: false,
  }));

  for (const note of voicing.notes) {
    const cell = cells.find((item) => item.stringNumber === note.stringNumber);
    if (!cell) continue;
    cell.fret = note.fret;
    cell.name = note.name;
    cell.isRoot = note.isRoot;
  }

  return cells;
}

/** 品位跨度：最高与最低相差几品 */
export function voicingSpan(voicing: ChordVoicing): number {
  const frets = voicing.notes.map((note) => note.fret);
  return Math.max(...frets) - Math.min(...frets);
}

/** 这个音位最低的品位。0 表示含空弦。 */
export function voicingStartFret(voicing: ChordVoicing): number {
  return Math.min(...voicing.notes.map((note) => note.fret));
}

/** 和弦的音级构成：从音位里读出来，不是另抄一份 */
export type ChordTone = {
  /** 音级记号，如 1、♭3 */
  degreeLabel: string;
  /** 该级的音名 */
  name: string;
};

/** 一个音位里包含和弦的全部音级，按音级顺序排 */
export function chordTones(voicing: ChordVoicing): ChordTone[] {
  return [...voicing.notes]
    .map((note) => ({ degreeLabel: note.degreeLabel, name: note.name }))
    .sort((a, b) => Number(a.degreeLabel.replace(/[^0-9]/g, "")) - Number(b.degreeLabel.replace(/[^0-9]/g, "")));
}

/** 按法图要画哪几品 */
export type FretWindow = {
  /** 画出来的第一品 */
  start: number;
  /** 画出来的最后一品 */
  end: number;
  /** 几行品格 */
  rows: number;
  /** 是否含空弦（空弦画在琴枕上方） */
  hasOpenStrings: boolean;
};

/**
 * 按法图的品域。
 * 含空弦时从第 1 品画起，空弦标在琴枕上方；否则从最低的那一品画起。
 * 行数不少于 4 行，看起来才像一个常规的和弦框。
 */
export function chordBoxWindow(voicing: ChordVoicing): FretWindow {
  const frets = voicing.notes.map((note) => note.fret);
  const min = Math.min(...frets);
  const max = Math.max(...frets);

  if (min === 0) {
    const rows = Math.max(4, max);
    return { start: 1, end: rows, rows, hasOpenStrings: true };
  }

  const rows = Math.max(4, max - min + 1);
  return { start: min, end: min + rows - 1, rows, hasOpenStrings: false };
}

/**
 * 和弦记号。
 *
 * 记号由和弦自己的音级记号推出，不另抄一份写法表：
 * 三和弦看三音与五音，七和弦看三音、五音与七音。
 */
export function chordSymbol(root: string, type: ChordType): string {
  const has = (label: string) => type.degreeLabels.includes(label);

  if (type.kind === "triad") {
    if (has("♭3") && has("♭5")) return `${root}dim`;
    if (has("♯5")) return `${root}aug`;
    return has("♭3") ? `${root}m` : root;
  }

  if (has("♭♭7")) return `${root}dim7`;
  const quality = has("♭3") ? "m" : "";
  const seventh = has("7") ? "maj7" : "7";
  const flatFive = has("♭5") ? "♭5" : "";
  return `${root}${quality}${seventh}${flatFive}`;
}

/** 中文全名，如「C 大三和弦」 */
export function chordName(root: string, type: ChordType): string {
  return `${root} ${type.label}`;
}

/**
 * 性质的一句话性格。
 * 由音级记号推出，所以新增性质时不会漏写。
 */
export function chordCharacter(type: ChordType): string {
  const has = (label: string) => type.degreeLabels.includes(label);

  if (has("♭♭7")) return "四音对称，声音发闷，多作过渡和弦";
  if (has("♭5") && has("♭3")) return "小三度叠上减五度，声音紧绷、不稳定";
  if (has("♯5")) return "五度被撑开，声音悬浮";
  if (has("7") && has("♭3")) return "小七度叠大三度，柔和的布鲁斯色彩";
  if (has("7")) return "大七度叠大三度，比大三和弦更柔";
  if (has("♭7")) return "小七度带来往上游解决的倾向";
  if (has("♭3")) return "小三度，声音柔和偏暗";
  return "大三度，声音明亮开阔";
}

/** 最低音所在弦对应的场景。键是弦号。 */
const BASS_SCENES: Record<number, string> = {
  6: "位置最低，适合垫在歌的低音线条里",
  5: "中低把位，是伴奏里最常听到的一层",
  4: "中把位，音色比 6 弦清亮",
  3: "偏高，适合做分解和弦的上声部",
  2: "高把位，多用在爵士里铺底",
  1: "最高的一层，只在需要亮色时用",
};

/**
 * 一个音位的用法提示：位置 + 场景 + 这个按法本身的特点。
 * 和弦的性质只说一次（在结果标题上），这里讲的是「这个按法」。
 */
export function voicingSuggestion(voicing: ChordVoicing): string {
  const bass = voicing.notes[0];
  const root = voicing.notes.find((note) => note.isRoot);

  const where = (note: (typeof voicing.notes)[number]) =>
    note.fret === 0 ? `${note.stringNumber} 弦空弦` : `${note.stringNumber} 弦 ${note.fret} 品`;

  const lead = bass.isRoot
    ? `根音在 ${where(bass)}，是这个按法的最低音`
    : `最低音是 ${where(bass)} 的 ${bass.degreeLabel} 级，根音在 ${root ? where(root) : "别处"}`;

  const parts = [`${lead}，${BASS_SCENES[bass.stringNumber] ?? "位置居中"}`];

  const openCount = voicing.notes.filter((note) => note.fret === 0).length;
  if (openCount > 0) parts.push(`含 ${openCount} 根空弦，音色更透`);

  const span = voicingSpan(voicing);
  if (span >= 3) parts.push(`最高与最低相差 ${span} 品，手指要张开一点`);

  return `${parts.join("；")}。`;
}
