import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "节拍器已迁移",
  alternates: { canonical: "/metronome" },
};

export default function MetronomeRedirectPage() {
  return (
    <main className="shell flex-1 py-16 sm:py-24">
      <div className="measure">
        <p className="text-micro font-medium uppercase text-ink-500">已迁移</p>
        <h1 className="mt-3 text-display font-display text-ink-950">节拍器已移到主入口</h1>
        <p className="mt-4 text-body text-ink-700">正在前往 /metronome。</p>
        <p className="mt-6">
          <Link
            href="/metronome"
            className="inline-flex min-h-11 items-center rounded-control bg-accent-700 px-5 text-label font-medium text-on-accent"
          >
            立即前往
          </Link>
        </p>
        <meta httpEquiv="refresh" content="0;url=/metronome" />
      </div>
    </main>
  );
}
