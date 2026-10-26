import { TabDrill } from "@/components/TabDrill";
import { WEEK1_SECTIONS } from "@/lib/week-1-tab-exercises";

export function WeekOneTabDrill() {
  return (
    <TabDrill
      idPrefix="week1-tab"
      eyebrow="WEEK 01 · TAB"
      title="第一周完整运指谱例"
      summary="每日必弹 + 周一至周六。每日必弹至周三用 ♩=100，周四至周六用 ♩=110；周五、周六开始离开基础把位。"
      sections={WEEK1_SECTIONS}
    />
  );
}
