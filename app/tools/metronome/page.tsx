import type { Metadata } from "next";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Metronome } from "@/components/Metronome";
import { MetronomeGuide } from "@/components/MetronomeGuide";

export const metadata: Metadata = {
  title: "节拍器",
};

export default function MetronomePage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <div className="measure mx-auto">
        <h1 className="text-display font-display text-ink-950 text-balance">节拍器</h1>
        <div className="mt-8 rounded-card border border-rule bg-surface p-5 sm:p-7">
          <Metronome />
        </div>
        {/* 安装入口放在控件下方：先让用户用起来，再谈安装（BLF-1448） */}
        <div className="mt-8 empty:hidden">
          <InstallPrompt />
        </div>
        <MetronomeGuide />
      </div>
    </main>
  );
}
