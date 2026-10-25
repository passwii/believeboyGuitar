import type { TabDuration, TabFinger, TabMeasure, TabNote, TabString } from "@/lib/tab";
import type { TabSection } from "@/lib/tab-practice";

/**
 * 《电吉他手的养成计划 365日》第 1 周（原书第 6 页）曲谱数据。
 *
 * 这里是“内容数据”，不参与六线谱的绘制。TAB 的排版、符杠、可访问文本由
 * components/TabStaff.tsx 统一负责，后续其他曲谱或练习也可以直接复用。
 *
 * 记谱约定：吉他低八度记谱（谱面音高 = 实际发声 + 12）。
 * 品位与指法仍属于需要实琴核对的内容，不以自动推导代替教材指法。
 */

/** 基础把位里的品位 → 指法。后续把位移动由每个音自己的 finger 明确指定。 */
export const FRET_TO_FINGER = { 5: "食", 6: "中", 7: "名", 8: "小" } as const;

export type TabFret = keyof typeof FRET_TO_FINGER;

const LOW_E_STRING: TabString = 6;
const VALID_FINGERS = new Set<TabFinger>(["食", "中", "名", "小"]);

type MeasureOptions = {
  /** 每隔几个音标一次重音；用于三音一组的十六分音符练习。 */
  accentEvery?: number;
  /** 在哪些音符下标提示“移位”，下标从 0 开始。 */
  shiftAt?: readonly number[];
};

function parseFrets(value: string): number[] {
  const frets = value.split("-").map((fret) => Number(fret));
  if (frets.some((fret) => !Number.isInteger(fret) || fret < 0)) {
    throw new Error(`无效的 TAB 品位序列：${value}`);
  }
  return frets;
}

function parseFingers(value: string): TabFinger[] {
  const fingers = [...value] as TabFinger[];
  if (fingers.some((finger) => !VALID_FINGERS.has(finger))) {
    throw new Error(`无效的 TAB 指法序列：${value}`);
  }
  return fingers;
}

/**
 * 用“品位串 + 指法串”维护一小节，避免同一组数字和指法写两遍。
 * 例：measure("5-6-7-8", "食中名小")。
 */
function measure(
  fretSequence: string,
  fingerSequence: string,
  duration: TabDuration = "8",
  options: MeasureOptions = {},
): TabMeasure {
  const frets = parseFrets(fretSequence);
  const fingers = parseFingers(fingerSequence);
  if (frets.length !== fingers.length) {
    throw new Error(
      `TAB 品位与指法数量不一致：${fretSequence}（${frets.length}） / ${fingerSequence}（${fingers.length}）`,
    );
  }

  const shiftSet = new Set(options.shiftAt ?? []);
  const notes: TabNote[] = frets.map((fret, index) => ({
    string: LOW_E_STRING,
    fret,
    duration,
    finger: fingers[index],
    shift: shiftSet.has(index) || undefined,
    accent:
      options.accentEvery && index % options.accentEvery === 0 ? true : undefined,
  }));

  return { notes };
}

export const WEEK1_SECTIONS: readonly TabSection[] = [
  {
    id: "daily",
    title: "每日必弹",
    cdStart: "0:00~",
    bpm: 100,
    rhythm: "八分音符",
    measures: [
      measure("5-6-7-8-5-6-7-8", "食中名小食中名小"),
      measure("8-7-6-5-8-7-6-5", "小名中食小名中食"),
      measure("5-6-7-8-8-7-6-5", "食中名小小名中食"),
      measure("5-6-7-8-8-7-6-5", "食中名小小名中食"),
    ],
    focus: "每根手指尽量分开，中指、无名指、小指要垂直按弦。",
    tip: "一指一品，5–8 品分别对应食指、中指、无名指、小指。每天先弹这一段，再进入当天的练习。",
  },
  {
    id: "monday",
    title: "周一 · 交错换指",
    cdStart: "0:13~",
    bpm: 100,
    rhythm: "八分音符",
    measures: [
      measure("5-7-6-8-5-7-6-8", "食名中小食名中小"),
      measure("5-7-6-8-5-7-6-8", "食名中小食名中小"),
      measure("8-6-7-5-8-6-7-5", "小中名食小中名食"),
      measure("8-6-7-5-8-6-7-5", "小中名食小中名食"),
    ],
    focus: "食指 → 无名指 → 中指 → 小指，再按相反顺序倒回。",
    tip: "无名指和小指容易不自觉地抬起，这是无效的多余动作。换指时让手指贴着弦走。",
  },
  {
    id: "tuesday",
    title: "周二 · 固定基准指",
    cdStart: "0:26~",
    bpm: 100,
    rhythm: "八分音符",
    measures: [
      measure("5-6-5-7-5-8-5-7", "食中食名食小食名"),
      measure("5-6-5-7-5-8-5-7", "食中食名食小食名"),
      measure("8-7-8-6-8-5-8-6", "小名小中小食小中"),
      measure("8-7-8-6-8-5-8-6", "小名小中小食小中"),
    ],
    focus: "前两小节固定食指，后两小节固定小指，再用其余手指扩展。",
    tip: "第一至第二小节让食指一直按在 5 品；第三至第四小节小指不要离开 8 品，别「手忙脚乱」。",
  },
  {
    id: "wednesday",
    title: "周三 · 三连音",
    cdStart: "0:39~",
    bpm: 100,
    rhythm: "三连音",
    measures: [
      measure("5-6-7-5-6-7-6-7-8-6-7-8", "食中名食中名中名小中名小", "8t"),
      measure("8-7-6-8-7-6-7-6-5-7-6-5", "小名中小名中名中食名中食", "8t"),
      measure("5-6-7-6-7-8-8-7-6-7-6-5", "食中名中名小小名中名中食", "8t"),
      measure("5-6-7-6-7-8-8-7-6-7-6-5", "食中名中名小小名中名中食", "8t"),
    ],
    focus: "按谱面标出的指法顺序弹三连音，右手用拨片上下交替。",
    tip: "请使用拨片上下交替拨弦。从小指换回其他手指时最容易出错，先把每组三连音的第一个音卡稳，再追求连起来。",
  },
  {
    id: "thursday",
    title: "周四 · 三音循环",
    bpm: 110,
    rhythm: "十六分音符 · 三音一组重音",
    measures: [
      measure(
        "5-6-7-5-6-7-5-6-7-5-6-7-5-6-7-5",
        "食中名食中名食中名食中名食中名食",
        "16",
        { accentEvery: 3 },
      ),
      measure(
        "7-5-6-7-5-6-7-8-8-7-6-8-7-6-8-7",
        "名食中名食中名小小名中小名中小名",
        "16",
        { accentEvery: 3 },
      ),
      measure(
        "8-7-6-8-7-6-8-7-6-8-7-6-8-7-6-8",
        "小名中小名中小名中小名中小名中小",
        "16",
        { accentEvery: 3 },
      ),
      measure(
        "6-8-7-6-8-7-6-8-7-6-5-7-6-5-4-5",
        "中小名中小名中小名中食名中食食食",
        "16",
        { accentEvery: 3, shiftAt: [14] },
      ),
    ],
    focus: "以三个音为一个单位循环，拍点仍按 4/4 的十六分音符走。",
    tip: "重音落在每组第一个音。最后一小节 6→5→4→5 含一次把位移动，先单独把这一拍接顺。",
  },
  {
    id: "friday",
    title: "周五 · 移动一个品格",
    bpm: 110,
    rhythm: "八分音符",
    measures: [
      measure("5-6-7-8-6-7-8-9", "食中名小食中名小"),
      measure("5-6-7-8-4-5-6-7", "食中名小食中名小"),
      measure("8-7-6-5-9-8-7-6", "小名中食小名中食"),
      measure("8-7-6-5-7-6-5-4", "小名中食小名中食"),
    ],
    focus: "每组四连音的后半组整体移动一个品格，拇指与手掌保持稳定。",
    tip: "第 1、3 小节后半组右移 1 品，第 2、4 小节后半组左移 1 品。靠手指伸展换品，不让左手拇指跟着跑。",
  },
  {
    id: "saturday",
    title: "周六 · 移动两个品格",
    bpm: 110,
    rhythm: "八分音符",
    measures: [
      measure("5-7-6-8-4-6-5-7", "食名中小食名中小"),
      measure("5-7-6-8-6-8-7-9", "食名中小食名中小"),
      measure("7-9-8-10-6-8-7-9", "食名中小食名中小"),
      measure("5-7-6-8-4-6-5-7", "食名中小食名中小"),
    ],
    focus: "用交错指法做两个品格的位移，第 3 小节扩大到第 10 品。",
    tip: "食指移到第 7 品时，拇指也要一起移动。换把位时手指尽量不要远离指板。",
  },
];
