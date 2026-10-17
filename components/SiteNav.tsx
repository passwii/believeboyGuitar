import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/library", label: "资料库" },
];

export function SiteNav() {
  return (
    <header className="border-b border-ink-200 bg-surface">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-4">
        <Link href="/" className="font-semibold tracking-tight text-ink-950">
          电吉他学习资料库
        </Link>
        <nav aria-label="主导航" className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-700 underline-offset-4 hover:text-accent-700 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
