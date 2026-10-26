import type { Metadata } from "next";
import { ChordLibrary } from "@/components/ChordLibrary";

export const metadata: Metadata = {
  title: "和弦库",
};

export default function ChordsPage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <h1 className="mt-3 text-display font-display text-ink-950 text-balance">
          和弦库
        </h1>
        <p className="mt-4 text-body text-ink-700 text-pretty">
          选一个根音和性质，列出它在指板上的实用按法。
          每个按法都由标准调弦与音程组合推导，不是抄的指法表。
        </p>
      </header>

      <ChordLibrary />
    </main>
  );
}
