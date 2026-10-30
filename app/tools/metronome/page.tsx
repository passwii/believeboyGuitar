import type { Metadata } from "next";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Metronome } from "@/components/Metronome";
import { MetronomeGuide } from "@/components/MetronomeGuide";

export const metadata: Metadata = {
  title: "节拍器",
};

export default function MetronomePage() {
  return (
    <main className="metronome-focus">
      <div className="metronome-focus__inner">
        <h1 className="metronome-focus__desktop-only text-display font-display text-ink-950 text-balance">
          节拍器
        </h1>
        <div className="metronome-focus__panel">
          <Metronome />
        </div>
        {/* 安装入口放在控件下方：先让用户用起来，再谈安装（BLF-1448） */}
        <div className="metronome-focus__desktop-only mt-8 empty:hidden">
          <InstallPrompt />
        </div>
        <div className="metronome-focus__desktop-only">
          <MetronomeGuide />
        </div>
      </div>
    </main>
  );
}
