import type { Metadata } from "next";
import { lessons } from "@/content/manifest";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = {
  title: "资料库 · 电吉他学习资料库",
};

export default function LibraryPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        资料库
      </h1>
      <p className="mt-4 text-base leading-[1.8] text-ink-muted">
        全部整理后的资料，可按主题、阶段、难度筛选。
      </p>
      <LibraryBrowser lessons={lessons} />
    </main>
  );
}
