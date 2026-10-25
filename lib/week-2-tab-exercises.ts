import type {
  TabDuration,
  TabFinger,
  TabMeasure,
  TabNote,
  TabPick,
  TabString,
} from "@/lib/tab";
import type { TabSection } from "@/lib/tab-practice";

/**
 * 第 2 周：右手交替拨弦。
 *
 * 拨片轨迹保存在 TabMeasure.picking，与音高数据分开：
 * 八分音符上的十六分空拨可以比 notes 更密，不会被误当成新的音。
 * 周五、周六原明细里的“延音”和技巧标记存在少量对应关系不唯一的情况，
 * 这里按能确定的拍点落谱，并在练习提示中标注需核对处。
 */

type NoteOptions = {
  finger?: TabFinger;
  tie?: boolean;
  silent?: boolean;
  fretLabel?: string;
  hammerOn?: boolean;
  quarterChoke?: boolean;
  slot?: number;
};

function note(
  string: TabString,
  fret: number,
  duration: TabDuration,
  options: NoteOptions = {},
): TabNote {
  return { string, fret, duration, ...options };
}

function rest(
  string: TabString,
  fret: number,
  duration: TabDuration,
  slot?: number,
): TabNote {
  return { string, fret, duration, silent: true, slot };
}

function parsePicks(pattern: string): TabPick[] {
  return pattern
    .trim()
    .split(/\s+/)
    .map((token) => {
      const ghost = token.startsWith("(");
      const direction = token.replace(/[()]/g, "");
      if (direction !== "D" && direction !== "U") {
        throw new Error(`无效的拨片轨迹：${token}`);
      }
      return {
        stroke: direction === "D" ? "down" : "up",
        ghost: ghost || undefined,
      } as TabPick;
    });
}

function measure(notes: readonly TabNote[], picking?: readonly TabPick[]): TabMeasure {
  return { notes, picking };
}

/**
 * 周四：每个格子都保留，空拨格不显示品位，但符干与拨片轨迹仍占同一拍点。
 */
function ghostGridMeasure(frets: readonly number[], pattern: string): TabMeasure {
  const picking = parsePicks(pattern);
  if (picking.length !== frets.length) {
    throw new Error("空拨格数量与拨片轨迹不一致");
  }

  const notes = frets.map((fret, index) =>
    picking[index].ghost
      ? rest(6, fret, "16")
      : note(6, fret, "16"),
  );
  return measure(notes, picking);
}

const D_U_8 = parsePicks("D U D U D U D U");
const D_U_12 = parsePicks("D U D U D U D U D U D U");
const D_U_16 = parsePicks("D U D U D U D U D U D U D U D U");

export const WEEK2_SECTIONS: readonly TabSection[] = [
  {
    id: "daily-picking",
    title: "每日必弹 · 右手节奏控制",
    bpm: 120,
    rhythm: "四分 → 八分 → 三连音 → 十六分",
    focus: "清楚地区分拨片下拨与上拨，严格按照谱面上方的方向标记弹奏。",
    tip: "每小节换一种密度，速度不变。先确保拨片方向完全正确，再追求连贯；空弦用拨片垂直触弦。",
    labels: ["3 弦空弦", "⊓ 下拨", "∨ 上拨"],
    measures: [
      measure(
        Array.from({ length: 4 }, () => note(3, 0, "q")),
        parsePicks("D D D D"),
      ),
      measure(
        Array.from({ length: 8 }, () => note(3, 0, "8")),
        D_U_8,
      ),
      measure(
        Array.from({ length: 12 }, () => note(3, 0, "8t")),
        D_U_12,
      ),
      measure(
        Array.from({ length: 16 }, () => note(3, 0, "16")),
        D_U_16,
      ),
    ],
  },
  {
    id: "monday-c-arpeggio",
    title: "周一 · C 和弦分解",
    bpm: 120,
    rhythm: "八分音符",
    focus: "左手按住 C 和弦，右手用拨片上下交替弹奏分解和弦。",
    tip: "左手保持和弦形状，不因换弦而松开。第 4 小节最后一音回到 5 弦 3 品。",
    labels: ["C 和弦", "5–4–3–2–1 弦"],
    measures: [
      measure(
        [
          note(5, 3, "8", { finger: "名" }),
          note(4, 2, "8", { finger: "中" }),
          note(3, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(1, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(3, 0, "8"),
          note(4, 2, "8", { finger: "中" }),
        ],
        D_U_8,
      ),
      measure(
        [
          note(5, 3, "8", { finger: "名" }),
          note(4, 2, "8", { finger: "中" }),
          note(3, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(1, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(3, 0, "8"),
          note(4, 2, "8", { finger: "中" }),
        ],
        D_U_8,
      ),
      measure(
        [
          note(5, 3, "8", { finger: "名" }),
          note(4, 2, "8", { finger: "中" }),
          note(3, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(1, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(3, 0, "8"),
          note(4, 2, "8", { finger: "中" }),
        ],
        D_U_8,
      ),
      measure(
        [
          note(5, 3, "8", { finger: "名" }),
          note(4, 2, "8", { finger: "中" }),
          note(3, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(1, 0, "8"),
          note(2, 1, "8", { finger: "食" }),
          note(3, 0, "8"),
          note(5, 3, "8", { finger: "名" }),
        ],
        D_U_8,
      ),
    ],
  },
  {
    id: "tuesday-d-triplets",
    title: "周二 · D 和弦三连音",
    bpm: 90,
    rhythm: "三连音",
    focus: "D → Dadd9 → D → Dsus4 → D；第一拍下上下，第二拍上下上。",
    tip: "最容易错的是每两拍之间的拨片方向翻面。先把第一拍的「下上下」和第二拍的「上下上」单独接顺。",
    labels: ["D", "Dadd9", "Dsus4", "1 弦 3 品 = 小指"],
    measures: [
      measure(
        [
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
        ],
        D_U_12,
      ),
      measure(
        [
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 0, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
        ],
        D_U_12,
      ),
      measure(
        [
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
        ],
        D_U_12,
      ),
      measure(
        [
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 3, "8t", { finger: "小" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
          note(4, 0, "8t", { finger: "食" }),
          note(3, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "中" }),
          note(1, 2, "8t", { finger: "名" }),
          note(2, 3, "8t", { finger: "食" }),
          note(3, 2, "8t"),
        ],
        D_U_12,
      ),
    ],
  },
  {
    id: "wednesday-chord-tones",
    title: "周三 · A / D 和弦组成音",
    bpm: 110,
    rhythm: "前两小节八分 · 后两小节三连音",
    focus: "A → D → A → D，坚持上下交替，不用「下下上」的经济拨弦。",
    tip: "前两小节每拍两音，后两小节每拍三音。第三、四小节尤其容易顺手改成经济拨弦，注意保持交替。",
    labels: ["A 和弦", "D 和弦", "全部交替拨弦"],
    measures: [
      measure(
        [
          note(5, 5, "8", { finger: "中" }),
          note(4, 4, "8", { finger: "食" }),
          note(4, 7, "8", { finger: "小" }),
          note(3, 4, "8", { finger: "食" }),
          note(5, 5, "8", { finger: "中" }),
          note(4, 4, "8", { finger: "食" }),
          note(4, 7, "8", { finger: "小" }),
          note(3, 4, "8", { finger: "食" }),
        ],
        D_U_8,
      ),
      measure(
        [
          note(4, 5, "8", { finger: "中" }),
          note(3, 4, "8", { finger: "食" }),
          note(3, 7, "8", { finger: "小" }),
          note(2, 4, "8", { finger: "食" }),
          note(4, 5, "8", { finger: "中" }),
          note(3, 4, "8", { finger: "食" }),
          note(3, 7, "8", { finger: "小" }),
          note(2, 4, "8", { finger: "食" }),
        ],
        D_U_8,
      ),
      measure(
        [
          note(5, 5, "8t", { finger: "中" }),
          note(4, 4, "8t", { finger: "食" }),
          note(4, 7, "8t", { finger: "小" }),
          note(3, 4, "8t", { finger: "食" }),
          note(4, 7, "8t", { finger: "小" }),
          note(4, 4, "8t", { finger: "食" }),
          note(5, 5, "8t", { finger: "中" }),
          note(4, 4, "8t", { finger: "食" }),
          note(4, 7, "8t", { finger: "小" }),
          note(3, 4, "8t", { finger: "食" }),
          note(4, 7, "8t", { finger: "小" }),
          note(4, 4, "8t", { finger: "食" }),
        ],
        D_U_12,
      ),
      measure(
        [
          note(4, 5, "8t", { finger: "中" }),
          note(3, 4, "8t", { finger: "食" }),
          note(3, 7, "8t", { finger: "小" }),
          note(2, 4, "8t", { finger: "食" }),
          note(3, 7, "8t", { finger: "小" }),
          note(3, 4, "8t", { finger: "食" }),
          note(4, 5, "8t", { finger: "中" }),
          note(3, 4, "8t", { finger: "食" }),
          note(3, 7, "8t", { finger: "小" }),
          note(2, 4, "8t", { finger: "食" }),
          note(3, 7, "8t", { finger: "小" }),
          note(3, 4, "8t", { finger: "食" }),
        ],
        D_U_12,
      ),
    ],
  },
  {
    id: "thursday-ghost-picking",
    title: "周四 · 空拨保持节奏",
    bpm: 120,
    rhythm: "十六分拨片运动 · Em → G / A → G",
    focus: "括号里的上拨不碰弦，但右手继续按十六分音符上下挥动。",
    tip: "谱面只在实际触弦的格子写品位，空挥格保留符干和拨片标记。先不按和弦，只用右手把轨迹挥顺。",
    labels: ["Em → G", "A → G", "括号 = 空拨"],
    measures: [
      ghostGridMeasure(
        [0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        "D (U) D (U) D (U) D U D (U) D (U) D (U) D U",
      ),
      ghostGridMeasure(
        [5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        "D (U) D (U) D (U) D U D (U) D (U) D (U) D U",
      ),
      ghostGridMeasure(
        [0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        "D (U) D (U) D (U) D U D (U) D (U) D (U) D U",
      ),
      ghostGridMeasure(
        [5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        "D (U) D (U) D (U) D U D (U) D (U) D (U) D U",
      ),
    ],
  },
  {
    id: "friday-syncopation",
    title: "周五 · 切分音里的持续交替",
    bpm: 100,
    rhythm: "八分音符 · 十六分拨片轨迹 · Gm",
    focus: "在延音与切分中保持右手持续上下挥动，不让空拨打乱节奏。",
    tip: "拨片轨迹按十六分动作记录；音符落在八分时值上。第 3 小节原明细只写「结构类似」，页面按第 1 小节复用，需对照原书核对。",
    labels: ["Gm", "延音 = ~", "空拨 = 括号"],
    measures: [
      measure(
        [
          note(4, 3, "8", { finger: "名", slot: 0 }),
          note(3, 3, "8", { finger: "名", slot: 2 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 4 }),
          note(3, 3, "8", { finger: "名", slot: 6 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 8 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 10 }),
          note(3, 3, "8", { finger: "名", tie: true, slot: 12 }),
          note(3, 1, "8", { finger: "食", slot: 14 }),
        ],
        parsePicks("D U D U (D) U (D) U (D) U (D) U (D) U (D) U"),
      ),
      measure(
        [
          note(4, 3, "8", { finger: "名", slot: 0 }),
          note(3, 3, "8", { finger: "名", slot: 2 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 4 }),
          note(3, 3, "8", { finger: "名", slot: 6 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 8 }),
          note(4, 0, "8", { slot: 10 }),
          note(4, 1, "8", { finger: "食", slot: 12 }),
          note(4, 2, "8", { finger: "中", slot: 14 }),
        ],
        parsePicks("D U D U (D) U (D) U (D) U D U D U D U"),
      ),
      measure(
        [
          note(4, 3, "8", { finger: "名", slot: 0 }),
          note(3, 3, "8", { finger: "名", slot: 2 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 4 }),
          note(3, 3, "8", { finger: "名", slot: 6 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 8 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 10 }),
          note(3, 3, "8", { finger: "名", tie: true, slot: 12 }),
          note(3, 1, "8", { finger: "食", slot: 14 }),
        ],
        parsePicks("D U D U (D) U (D) U (D) U (D) U (D) U (D) U"),
      ),
      measure(
        [
          note(4, 3, "8", { finger: "名", slot: 0 }),
          note(3, 3, "8", { finger: "名", slot: 2 }),
          note(3, 1, "8", { finger: "食", tie: true, slot: 4 }),
          note(3, 3, "8", { finger: "名", slot: 6 }),
          note(3, 4, "8", { finger: "中", slot: 8 }),
          note(3, 4, "8", { finger: "中", slot: 10 }),
          note(3, 3, "8", { finger: "名", slot: 12 }),
          note(3, 1, "8", { finger: "食", slot: 14 }),
        ],
        parsePicks("D U D U (D) U (D) U D U D U D (U) (D) (U)"),
      ),
    ],
  },
  {
    id: "saturday-hammer-on",
    title: "周六 · 击弦与 Q.C.",
    bpm: 100,
    rhythm: "G · 切分拨片轨迹 · h = 击弦",
    focus: "左手击弦时，右手继续空拨保持上下交替；Q.C. 只做轻微推弦。",
    tip: "5 弦 3.5 品是 Quarter Choke 的记法，不是新的品格。原明细每小节标出 15 个拨片动作，延音与空拨的落音位置不完全唯一；页面按原样保留轨迹，请对照原书核对。",
    labels: ["G", "h = Hammer-on", "Q.C. = Quarter Choke"],
    measures: [
      measure(
        [
          note(5, 3, "16", { slot: 0 }),
          note(5, 5, "16", { hammerOn: true, slot: 2 }),
          note(5, 3, "16", { tie: true, slot: 5 }),
          note(5, 5, "16", { slot: 8 }),
          note(5, 3, "16", { fretLabel: "3.5", quarterChoke: true, slot: 9 }),
          note(5, 5, "16", { tie: true, slot: 12 }),
          note(5, 5, "16", { tie: true, slot: 14 }),
        ],
        parsePicks("D (U) U (D) U (D) U D (U) D U (D) U (D) U"),
      ),
      measure(
        [
          note(5, 3, "16", { slot: 0 }),
          note(5, 5, "16", { hammerOn: true, slot: 2 }),
          note(5, 3, "16", { tie: true, slot: 5 }),
          note(5, 5, "16", { slot: 8 }),
          note(5, 3, "16", { slot: 9 }),
          note(5, 3, "16", { slot: 12 }),
          note(5, 5, "16", { hammerOn: true, slot: 14 }),
        ],
        parsePicks("D (U) U (D) U (D) U D (U) D U (D) U (D) U"),
      ),
      measure(
        [
          note(5, 3, "16", { slot: 0 }),
          note(5, 5, "16", { hammerOn: true, slot: 2 }),
          note(5, 3, "16", { tie: true, slot: 5 }),
          note(5, 5, "16", { slot: 8 }),
          note(5, 3, "16", { fretLabel: "3.5", quarterChoke: true, slot: 9 }),
          note(5, 5, "16", { tie: true, slot: 12 }),
          note(5, 5, "16", { tie: true, slot: 14 }),
        ],
        parsePicks("D (U) U (D) U (D) U D (U) D U (D) U (D) U"),
      ),
      measure(
        [
          note(5, 3, "16", { slot: 0 }),
          note(5, 5, "16", { hammerOn: true, slot: 2 }),
          note(5, 3, "16", { tie: true, slot: 5 }),
          note(5, 5, "16", { finger: "名", slot: 8 }),
          note(5, 3, "16", { finger: "食", slot: 9 }),
          note(5, 4, "16", { finger: "中", slot: 10 }),
          note(5, 3, "16", { finger: "食", slot: 11 }),
          note(6, 6, "16", {
            finger: "小",
            fretLabel: "6",
            quarterChoke: true,
            slot: 12,
          }),
        ],
        parsePicks("D (U) U (D) U (D) U D U D U D (U) (D) (U)"),
      ),
    ],
  },
];
