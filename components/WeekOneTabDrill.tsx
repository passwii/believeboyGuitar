import { TabDrill } from "@/components/TabDrill";
import { WEEK1_SECTIONS } from "@/lib/week-1-tab-exercises";

export function WeekOneTabDrill() {
  return (
    <TabDrill
      idPrefix="week1-tab"
      eyebrow="WEEK 01 · TAB"
      title="第 1 周运指谱"
      summary="每日必弹 + 周一至周六。先慢后快。"
      sections={WEEK1_SECTIONS}
    />
  );
}
