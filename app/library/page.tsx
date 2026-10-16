import type { Metadata } from "next";
import { lessons } from "@/content/manifest";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = {
  title: "资料库 · 电吉他学习资料库",
};

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">资料库</h1>
      <p className="mt-2 text-sm text-ink-700">
        全部整理后的资料，可按主题、阶段、难度筛选。
      </p>
      <LibraryBrowser lessons={lessons} />
    </main>
  );
}
