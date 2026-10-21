import type { Metadata } from "next";
import Link from "next/link";
import { CheatsheetBendTargets } from "@/components/CheatsheetBendTargets";
import { CheatsheetCaged } from "@/components/CheatsheetCaged";
import { CheatsheetChords } from "@/components/CheatsheetChords";
import { CheatsheetMeters } from "@/components/CheatsheetMeters";
import { CheatsheetScalePositions } from "@/components/CheatsheetScalePositions";
import { CheatsheetTempo } from "@/components/CheatsheetTempo";
import { CheatsheetTuning } from "@/components/CheatsheetTuning";

export const metadata: Metadata = {
  title: "速查表",
  description: "调弦、音级、推弦目标、CAGED、和弦指法、速度术语与拍号重音的一页速查",
};

/** 顶部索引：七个区块的锚点 */
const SECTIONS = [
  { id: "tuning", label: "调弦" },
  { id: "scale-positions", label: "音级音位" },
  { id: "bend-targets", label: "推弦目标" },
  { id: "caged", label: "CAGED" },
  { id: "chords", label: "和弦指法" },
  { id: "tempo", label: "速度术语" },
  { id: "meters", label: "重音模型" },
] as const;

export default function CheatsheetPage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <p className="text-micro font-medium uppercase text-ink-500">Quick reference</p>
        <h1 className="mt-3 text-display font-display text-ink-950 text-balance">速查表</h1>
        <p className="mt-4 text-body text-ink-700 text-pretty">
          散落在各篇资料里的常用数据，集中在一页。音位与音高都由标准调弦算出，
          不是抄来的表；展开任意一块就能直接查。
        </p>
      </header>

      <nav aria-label="速查区块索引" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex min-h-11 items-center rounded-control bg-surface-muted px-3 text-label text-ink-700 transition-colors duration-150 ease-[var(--ease-standard)] hover:bg-surface hover:text-ink-950"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 border-b border-rule">
        <CheatsheetTuning />
        <CheatsheetScalePositions />
        <CheatsheetBendTargets />
        <CheatsheetCaged />
        <CheatsheetChords />
        <CheatsheetTempo />
        <CheatsheetMeters />
      </div>

      <footer className="measure mt-10 text-meta text-ink-500">
        <p className="text-pretty">
          这一页是工具页，不是资料，不登记在资料库清单里。
        </p>
        <p className="mt-2">
          <Link
            href="/library"
            className="inline-flex min-h-11 items-center text-label text-accent-700 underline underline-offset-4"
          >
            回到资料库
          </Link>
        </p>
      </footer>
    </main>
  );
}
