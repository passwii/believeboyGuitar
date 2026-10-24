import type { Metadata } from "next";
import Link from "next/link";

/**
 * 旧地址的静态跳转页（BLF-1451）。机制见 app/metronome/page.tsx 的说明：
 * 静态导出用不了 redirects()，React 19 把 <meta> 提升进 head 完成跳转。
 */

export const metadata: Metadata = {
  title: "练习计划已迁移",
  alternates: { canonical: "/tools/practice" },
};
export default function PracticeRedirectPage() {
  return (
    <main className="shell flex-1 py-16 sm:py-24">
      <div className="measure">
        <p className="font-mono text-micro font-medium uppercase text-ink-500">已迁移</p>
        <h1 className="mt-3 text-display font-display text-balance text-ink-950">
          练习计划搬进了工具间
        </h1>
        <p className="mt-4 text-body text-pretty text-ink-700">
          新地址是 /tools/practice，正在带你过去……
        </p>
        <p className="mt-6">
          <Link
            href="/tools/practice"
            className="inline-flex min-h-11 items-center rounded-control bg-accent-700 px-5 text-label font-medium text-on-accent transition-colors duration-150 hover:bg-accent-600"
          >
            立即前往
          </Link>
        </p>
        {/* React 19 将 meta 提升进 head；content 只能是静态字符串 */}
        <meta httpEquiv="refresh" content="0;url=/tools/practice" />
      </div>
    </main>
  );
}
