import { TabDrill } from "@/components/TabDrill";
import { WEEK2_SECTIONS } from "@/lib/week-2-tab-exercises";

export function WeekTwoTabDrill() {
  return (
    <TabDrill
      idPrefix="week2-tab"
      eyebrow="WEEK 02 · TAB"
      title="第 2 周交替拨弦"
      summary="下拨、上拨、空拨保持连续。"
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
