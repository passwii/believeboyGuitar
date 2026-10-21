import type { Metadata } from "next";
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
        <div className="mt-8">
          <Metronome />
        </div>
        <MetronomeGuide />
      </div>
    </main>
  );
}
