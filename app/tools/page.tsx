import type { Metadata } from "next";
import { SectionIcon } from "@/components/SiteIcons";
import { ToolTiles } from "@/components/ToolPages";

export const metadata: Metadata = {
  title: "工具间",
};

/**
 * 工具间（/tools，BLF-1451；BLF-1452 视觉重设计）。
 *
 * 一张卡片一个工具：图标 + 名称 + 一句用途。清单的唯一事实来源仍是
 * `components/ToolPages.tsx` 的 TOOL_PAGES，这里与首页分类卡片都只读它。
 */
export default function ToolsIndexPage() {
  return (
    <main className="shell flex-1 pt-4 pb-10 sm:py-14">
      <div className="sheet">
        <header className="flex items-center gap-2.5">
          <SectionIcon id="tools" className="size-6 flex-none text-ink-500" />
          <h1 className="text-title font-display text-ink-950">工具间</h1>
        </header>

        <ToolTiles />
      </div>
    </main>
  );
}
