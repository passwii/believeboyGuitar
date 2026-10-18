import type { Metadata } from "next";
import { Metronome } from "@/components/Metronome";

export const metadata: Metadata = {
  title: "节拍器 · 电吉他学习资料库",
};

export default function MetronomePage() {
  return (
    <main className="mx-auto w-full max-w-[40rem] px-5 py-10 sm:py-14">
      <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        节拍器
      </h1>
      <p className="mt-3 text-sm leading-[1.8] text-ink-muted">
        先选拍号，再定速度，然后开始。声音在浏览器里合成，不需要加载音频文件。
      </p>
      <div className="mt-8">
        <Metronome />
      </div>
    </main>
  );
}
