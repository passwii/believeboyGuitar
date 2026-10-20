import type { Metadata } from "next";
import { lessons } from "@/content/manifest";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = {
  title: "资料库",
};

export default function LibraryPage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <h1 className="text-display font-display text-ink-950 text-balance">资料库</h1>
        <p className="mt-3 text-body text-ink-700 text-pretty">
          全部整理后的资料，可按主题、阶段、难度筛选。
        </p>
      </header>
      <LibraryBrowser lessons={lessons} />
    </main>
  );
}
