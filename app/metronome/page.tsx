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
      <div className="mt-8">
        <Metronome />
      </div>
    </main>
  );
}
