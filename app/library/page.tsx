import type { Metadata } from "next";
import { lessons } from "@/content/manifest";
import { LibraryBrowser } from "@/components/LibraryBrowser";
import { SectionIcon } from "@/components/SiteIcons";

export const metadata: Metadata = {
  title: "知识",
};

/**
 * 知识（/library，BLF-1452 视觉重设计）。
 *
 * 只留图标 + 标题：搜索框与结果列表自己会说明这一页能做什么，
 * 导语段落已经退场。
 */
export default function LibraryPage() {
  return (
    <main className="shell flex-1 pt-4 pb-10 sm:py-14">
      <header className="flex items-center gap-2.5">
        <SectionIcon id="knowledge" className="size-6 flex-none text-ink-500" />
        <h1 className="text-title font-display text-ink-950">知识</h1>
      </header>
      <LibraryBrowser lessons={lessons} />
    </main>
  );
}
