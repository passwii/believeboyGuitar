"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "首页", icon: "home", match: (path) => path === "/" },
  {
    href: "/practice",
    label: "练习",
    icon: "repeat",
    match: (path) => path === "/practice" || path.startsWith("/practice/"),
  },
  {
    href: "/library",
    label: "资料库",
    icon: "library",
    match: (path) => path === "/library" || path.startsWith("/library/"),
  },
  {
    href: "/metronome",
    label: "节拍器",
    icon: "metronome",
    match: (path) => path === "/metronome",
  },
];

function SiteMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 flex-none items-end justify-center gap-[3px] rounded-control bg-accent-700 px-[5px] py-1.5"
    >
      <span className="h-2 w-1 rounded-full bg-on-accent" />
      <span className="h-3.5 w-1 rounded-full bg-on-accent" />
      <span className="h-1.5 w-1 rounded-full bg-on-accent" />
    </span>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const focusMode =
    pathname === "/metronome" || pathname.startsWith("/practice/week-");

  return (
    <>
      <header
        className={`${focusMode ? "hidden sm:block " : ""}sticky top-0 z-30 border-b border-rule bg-canvas/78 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas`}
      >
        <div className="shell shell-nav pt-[env(safe-area-inset-top)]">
          <Link
            href="/"
            aria-label="练习站首页"
            className="flex min-h-11 items-center gap-2.5 text-label font-semibold tracking-tight text-ink-950"
          >
            <SiteMark />
            练习站
          </Link>

          <nav aria-label="主导航" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-1.5 rounded-control px-3 text-label transition-colors duration-150 ${
                        active
                          ? "bg-surface-muted font-semibold text-ink-950"
                          : "text-ink-700 hover:text-ink-950"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        className={`size-4 ${active ? "text-accent-700" : "text-ink-500"}`}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <nav
        aria-label="移动端导航"
        className={
          focusMode
            ? "hidden"
            : "fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-canvas/92 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas sm:hidden"
        }
      >
        <ul className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[var(--dock-h)] flex-col items-center justify-center gap-0.5 px-1 text-meta transition-colors duration-150 ${
                    active ? "font-semibold text-ink-950" : "text-ink-500 hover:text-ink-950"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className={`size-5 ${active ? "text-accent-700" : "text-ink-500"}`}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
