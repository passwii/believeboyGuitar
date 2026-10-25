import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell flex-1 py-16 sm:py-24">
      <div className="measure">
        <p className="text-micro font-medium uppercase text-ink-500">404</p>
        <h1 className="mt-3 text-display font-display text-ink-950 text-balance">
          这个页面不存在
        </h1>
        <p className="mt-4 text-body text-ink-700 text-pretty">
          链接可能已经失效，或者这篇资料还没整理进来。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/library"
            className="inline-flex min-h-11 items-center rounded-control bg-accent-700 px-5 text-label text-on-accent transition-colors duration-150 hover:bg-accent-600"
          >
            去知识
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-control bg-surface-muted px-5 text-label text-ink-950 transition-colors duration-150 hover:bg-surface"
          >
            回到首页
          </Link>
        </div>
      </div>
    </main>
  );
}
