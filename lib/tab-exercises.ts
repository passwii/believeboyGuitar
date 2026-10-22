import type { TabDuration, TabMeasure, TabNote, TabString } from "@/lib/tab";

/**
 * 《电吉他手的养成计划 365日》第 1 周（原书第 6 页）曲谱数据。
 *
 * 数据来源与校验：
 *  - 四条练习全部在 6 弦（最粗弦）的 5–8 品上；
 *  - 品位与指法一一对应：5 = 食、6 = 中、7 = 名、8 = 小；
 *  - 记谱音高由「标准调弦 EADGBE + 品位」推导（见 lib/tab.ts），
 *    再与原书五线谱逐个核对；音名与指法仍建议练习前在琴上核对。
 *
 * 记谱约定：吉他低八度记谱（谱面音高 = 实际发声 + 12）。
 *   6 弦 5 品 = A3，6 品 = B♭3，7 品 = B3，8 品 = C4
 */

/** 品位 → 指法 */
export const FRET_TO_FINGER = { 5: "食", 6: "中", 7: "名", 8: "小" } as const;

export type TabFret = keyof typeof FRET_TO_FINGER;

const LOW_E_STRING: TabString = 6;

function note(fret: TabFret, duration: TabDuration): TabNote {
  return {
    string: LOW_E_STRING,
    fret,
    duration,
    finger: FRET_TO_FINGER[fret],
  };
}

function measure(frets: readonly TabFret[], duration: TabDuration = "8"): TabMeasure {
  return { notes: frets.map((fret) => note(fret, duration)) };
}

export type TabSection = {
  id: string;
  title: string;
  /** CD 轨起始时间 */
  cdStart: string;
  /** 速度：♩= */
  bpm: number;
  /** 原书这一节的四小节曲谱 */
  measures: readonly TabMeasure[];
  /** 标题下的练习要求 */
  focus: string;
  /** 谱面下方的补充提示 */
  tip: string;
};

export const WEEK1_SECTIONS: readonly TabSection[] = [
  {
    id: "daily",
    title: "每日必弹",
    cdStart: "0:00~",
    bpm: 100,
    measures: [
      measure([5, 6, 7, 8, 5, 6, 7, 8]),
      measure([8, 7, 6, 5, 8, 7, 6, 5]),
      measure([5, 6, 7, 8, 8, 7, 6, 5]),
      measure([5, 6, 7, 8, 8, 7, 6, 5]),
    ],
    focus: "每根手指尽量分开，中指、无名指、小指要垂直按弦进行练习。",
    tip: "按照一根手指按一个品格的顺序来弹奏。本周请每天先弹这一段谱例，再进入每天的练习内容。",
  },
  {
    id: "monday",
    title: "周一",
    cdStart: "0:13~",
    bpm: 100,
    measures: [
      measure([5, 7, 6, 8, 5, 7, 6, 8]),
      measure([5, 7, 6, 8, 5, 7, 6, 8]),
      measure([8, 6, 7, 5, 8, 6, 7, 5]),
      measure([8, 6, 7, 5, 8, 6, 7, 5]),
    ],
    focus: "食指 → 无名指 → 中指 → 小指，小指 → 中指 → 无名指 → 食指 的练习。",
    tip: "无名指和小指在弹奏时容易不自觉地抬起，这是无效的多余动作。请在练习时特别注意！",
  },
  {
    id: "tuesday",
    title: "周二",
    cdStart: "0:26~",
    bpm: 100,
    measures: [
      measure([5, 6, 5, 7, 5, 8, 5, 7]),
      measure([5, 6, 5, 7, 5, 8, 5, 7]),
      measure([8, 7, 8, 6, 8, 5, 8, 6]),
      measure([8, 7, 8, 6, 8, 5, 8, 6]),
    ],
    focus: "前半段以食指为基准，后半段以小指为基准的运指练习。",
    tip: "第一至第二小节要把食指固定按在品格上来弹奏。第三至第四小节注意小指的运用，千万别「手忙脚乱」哦。",
  },
  {
    id: "wednesday",
    title: "周三",
    cdStart: "0:39~",
    bpm: 100,
    measures: [
      measure([5, 6, 7, 5, 6, 7, 6, 7, 8, 6, 7, 8], "8t"),
      measure([8, 7, 6, 8, 7, 6, 7, 6, 5, 7, 6, 5], "8t"),
      measure([5, 6, 7, 6, 7, 8, 8, 7, 6, 7, 6, 5], "8t"),
      measure([5, 6, 7, 6, 7, 8, 8, 7, 6, 7, 6, 5], "8t"),
    ],
    focus: "按照谱子中指定的指法顺序弹奏三连音。",
    tip: "运指时，从小指换到其他手指容易出错。请使用拨片上下交替拨弦。",
  },
];
