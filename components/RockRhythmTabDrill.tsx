import { TabDrill } from "@/components/TabDrill";
import { ROCK_RHYTHM_SECTIONS } from "@/lib/rock-rhythm-tab-exercises";

export function RockRhythmTabDrill() {
  return (
    <TabDrill
      idPrefix="rock-rhythm"
      eyebrow="PRACTICE · TAB"
      title="摇滚节奏型"
      summary="1=F · 4/4 · ♩=160。先练稳强力和弦与掌根制音，再提到原速。"
      sections={ROCK_RHYTHM_SECTIONS}
      legend={[
        { symbol: "P.M.", label: "掌根制音区间" },
        { symbol: "开 / 闷", label: "开放 / 闷音" },
        { symbol: "/", label: "滑入当前品位" },
        { symbol: "X", label: "闷音" },
        { symbol: "~", label: "延音；波纹表示揉弦" },
      ]}
    />
  );
}
