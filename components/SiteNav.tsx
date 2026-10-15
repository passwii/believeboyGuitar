import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "主页" },
  { href: "/library", label: "资料库" },
];

export function SiteNav() {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="font-semibold tracking-tight text-ink-950">
          电吉他学习资料库
        </Link>
        <nav className="flex gap-5 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-700 hover:text-accent-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
