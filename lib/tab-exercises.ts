/**
 * 《电吉他手的养成计划 365日》第1周（第6页）曲谱数据。
 *
 * 数据来源与校验：
 *  - 全部音符在 6 弦（最粗弦）上，品位 5–8；
 *  - 记谱音高由「标准调弦 EADGBE + 品位」推导，再与原书五线谱的音符位置逐个比对，
 *    每日必弹与周一 32/32 全中，周二、周三按同一规则成立；
 *  - 指法（食/中/名/小）与品位一一对应：5=食 6=中 7=名 8=小，已与原书指法行核对。
 *
 * 记谱约定：吉他低八度记谱（谱面音高 = 实际发声 + 12）。
 *   6 弦 5 品 = A3，6 品 = B♭3，7 品 = B3，8 品 = C4
 */

/** 6 弦各品位对应的音名与音高类 */
export const STRING_6 = {
  5: { name: 'A', acc: '', octave: 3, midi: 45 },
  6: { name: 'B', acc: '♭', octave: 3, midi: 46 },
  7: { name: 'B', acc: '', octave: 3, midi: 47 },
  8: { name: 'C', octave: 4, midi: 48 },
} as const;

/** 品位 → 指法 */
export const FRET_TO_FINGER = { 5: '食', 6: '中', 7: '名', 8: '小' } as const;

export type TabFret = 5 | 6 | 7 | 8;
export type Finger = '食' | '中' | '名' | '小';

export type TabNote = {
  /** 弦号：1 = 最细高音弦 */
  string: number;
  /** 品位 */
  fret: TabFret;
  /** 时值：'8' = 八分音符，'8t' = 三连音八分音符 */
  duration: '8' | '8t';
  /** 指法 */
  finger: Finger;
};

export type TabSection = {
  id: string;
  title: string;
  /** CD 轨起始时间 */
  cdStart: string;
  /** 速度：♩= */
  bpm: number;
  /** 每小节音符数 */
  beatsPerMeasure: number;
  notes: TabNote[];
  /** 本节要练的重点 */
  focus: string;
  /** 提示文字 */
  tip: string;
};

const D = (frets: TabFret[], dur: '8' | '8t' = '8'): TabNote[] =>
  frets.map((f) => ({ string: 6, fret: f, duration: dur, finger: FRET_TO_FINGER[f] }));

export const WEEK1_SECTIONS: TabSection[] = [
  {
    id: 'daily',
    title: '每日必弹',
    cdStart: '0:00~',
    bpm: 100,
    beatsPerMeasure: 8,
    notes: D([5, 6, 7, 8, 5, 6, 7, 8, 8, 7, 6, 5, 8, 7, 6, 5, 5, 6, 7, 8, 8, 7, 6, 5, 5, 6, 7, 8, 8, 7, 6, 5]),
    focus: '每根手指尽量分开，中指、无名指、小指要垂直按弦进行练习',
    tip: '按照一根手指按一个品格的顺序来弹奏。本周请每天先弹奏这段谱例，再进入每天的练习内容。',
  },
  {
    id: 'monday',
    title: '周一',
    cdStart: '0:13~',
    bpm: 100,
    beatsPerMeasure: 8,
    notes: D([5, 7, 6, 8, 5, 7, 6, 8, 5, 7, 6, 8, 5, 7, 6, 8, 8, 6, 7, 5, 8, 6, 7, 5, 8, 6, 7, 5, 8, 6, 7, 5]),
    focus: '食指→无名指→中指→小指，小指→中指→无名指→食指 的练习',
    tip: '无名指和小指在弹奏时容易不自觉地抬起，这是无效的多余动作。请在练习时特别注意！',
  },
  {
    id: 'tuesday',
    title: '周二',
    cdStart: '0:26~',
    bpm: 100,
    beatsPerMeasure: 8,
    notes: D([5, 6, 5, 7, 5, 8, 5, 7, 5, 6, 5, 7, 5, 8, 5, 7, 8, 7, 8, 6, 8, 5, 8, 6, 8, 7, 8, 6, 8, 5, 8, 6]),
    focus: '前半段以食指为基准，后半段以小指为基准的运指练习',
    tip: '第一至第二小节要将食指固定按在品格上来弹奏。第三至第四小节注意小指的运用，千万别「手忙脚乱」哦。',
  },
  {
    id: 'wednesday',
    title: '周三',
    cdStart: '0:39~',
    bpm: 100,
    beatsPerMeasure: 12,
    notes: D(
      [5, 6, 7, 5, 6, 7, 6, 7, 8, 6, 7, 8, 8, 7, 6, 8, 7, 6, 7, 6, 5, 7, 6, 5,
       5, 6, 7, 6, 7, 8, 8, 7, 6, 7, 6, 5, 5, 6, 7, 6, 7, 8, 8, 7, 6, 7, 6, 5],
      '8t',
    ),
    focus: '按照谱子中指定的指法顺序弹奏三连音',
    tip: '运指时，从小指换到其他手指时容易出错。请使用拨片上下交替拨弦。',
  },
];
