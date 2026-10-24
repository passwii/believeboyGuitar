import type { Metadata } from "next";
import Link from "next/link";
import { RhythmPatterns } from "@/components/RhythmPatterns";

export const metadata: Metadata = {
  title: "节奏型",
};

export default function RhythmsPage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <p className="font-mono text-micro font-medium uppercase text-ink-500">Rhythm patterns</p>
        <h1 className="mt-3 text-display font-display text-ink-950 text-balance">节奏型</h1>
        <p className="mt-4 text-body text-ink-700 text-pretty">
          把十六分音符的网格摊开：哪些格子要出声，哪些格子只让手保持运动。
          再按重音把一小节切成能慢练的组。
        </p>
        <p className="mt-3 text-meta text-ink-500">
          拍号与重音沿用
          <Link
            href="/tools/metronome"
            className="inline-flex min-h-11 items-center text-accent-700 underline underline-offset-4"
          >
            节拍器
          </Link>
          里的模型——节拍器的重音就是这里的分组锚点。
        </p>
      </header>

      <div className="mt-10">
        <RhythmPatterns />
      </div>
    </main>
  );
}
