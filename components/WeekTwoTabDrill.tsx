import { TabDrill } from "@/components/TabDrill";
import { WEEK2_SECTIONS } from "@/lib/week-2-tab-exercises";

export function WeekTwoTabDrill() {
  return (
    <TabDrill
      idPrefix="week2-tab"
      eyebrow="WEEK 02 · TAB"
      title="第二周右手强化谱例"
      summary="核心是拨片上下交替、空拨保持节奏，以及切分与击弦中的方向控制。先按谱面方向慢弹，再逐步提到标注速度。"
      sections={WEEK2_SECTIONS}
      legend={[
        { symbol: "⊓", label: "下拨" },
        { symbol: "∨", label: "上拨" },
        { symbol: "(⊓)", label: "空拨下" },
        { symbol: "(∨)", label: "空拨上" },
        { symbol: "~", label: "延音" },
        { symbol: "h", label: "击弦" },
        { symbol: "Q.C.", label: "轻微推弦" },
      ]}
    />
  );
}
