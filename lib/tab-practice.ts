import type { TabMeasure } from "@/lib/tab";

/** 一组练习谱共用的内容结构，不包含具体绘制逻辑。 */
export type TabSection = {
  id: string;
  title: string;
  /** CD 轨起始时间；没有可靠时间时不填。 */
  cdStart?: string;
  /** 速度：♩= */
  bpm: number;
  /** 这一节的主要节奏型，用于谱面上方的信息栏。 */
  rhythm: string;
  /** 标题下的练习要求 */
  focus: string;
  /** 谱面下方的补充提示 */
  tip: string;
  /** 额外标签，例如和弦进行、拨片规则或技巧名。 */
  labels?: readonly string[];
  /** 每节固定四小节 */
  measures: readonly TabMeasure[];
};
