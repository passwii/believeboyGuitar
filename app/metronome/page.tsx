import type { Metadata } from "next";
import Link from "next/link";

/**
 * 旧地址的静态跳转页（BLF-1451）。
 *
 * 本站是 `output: "export"` 的纯静态站，Next 的 redirects() 不可用
 * （官方文档列为 static export 不支持特性），所以旧路由在客户端跳：
 * React 19 会把页面里的 <meta> 提升进 <head>，静态导出的 HTML 同样生效；
 * 无 JS 时退化为可点的链接。已安装的 PWA start_url 还是旧地址，
 * 这个壳必须一直留着。
 */

export const metadata: Metadata = {
  title: "节拍器已迁移",
  alternates: { canonical: "/tools/metronome" },
};
export default function MetronomeRedirectPage() {
  return (
    <main className="shell flex-1 py-16 sm:py-24">
      <div className="measure">
        <p className="font-mono text-micro font-medium uppercase text-ink-500">已迁移</p>
        <h1 className="mt-3 text-display font-display text-balance text-ink-950">
          节拍器搬进了工具间
        </h1>
        <p className="mt-4 text-body text-pretty text-ink-700">
          新地址是 /tools/metronome，正在带你过去……
        </p>
        <p className="mt-6">
          <Link
            href="/tools/metronome"
            className="inline-flex min-h-11 items-center rounded-control bg-accent-700 px-5 text-label font-medium text-on-accent transition-colors duration-150 hover:bg-accent-600"
          >
            立即前往
          </Link>
        </p>
        {/* React 19 将 meta 提升进 head；content 只能是静态字符串 */}
        <meta httpEquiv="refresh" content="0;url=/tools/metronome" />
      </div>
    </main>
  );
}
