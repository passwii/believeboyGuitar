"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

/**
 * 站点导航（2026-10-25 图标化）。
 *
 * 桌面：站点标记 +「资料 / 工具 / 节拍器」，图标 + 文字。
 * 窄屏：顶部只留站点标记，导航下沉为底部 dock（首页 / 资料 / 工具 / 节拍器）。
 * 全站一个世界（信号台），不再按路由换皮。
 *
 * 结构照 iOS 导航栏：滚动模糊交给合成层，分隔线交给容器边框，不用 JS 监听。
 */
type NavItem = { href: string; label: string; icon: IconName; exact: boolean };

const DESKTOP_ITEMS: NavItem[] = [
  { href: "/library", label: "资料", icon: "library", exact: false },
  { href: "/tools", label: "工具", icon: "tools", exact: true },
  { href: "/tools/metronome", label: "节拍器", icon: "metronome", exact: false },
];

const DOCK_ITEMS: NavItem[] = [
  { href: "/", label: "首页", icon: "home", exact: true },
  { href: "/library", label: "资料", icon: "library", exact: false },
  { href: "/tools", label: "工具", icon: "tools", exact: true },
  { href: "/tools/metronome", label: "节拍", icon: "metronome", exact: false },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** 站点标记：三根电平条，读作一个正在跳的拍 */
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

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-canvas/78 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas">
        {/* 顶部安全区（BLF-1448）：PWA 全屏启动后状态栏压在导航上，
            viewport-fit=cover 让我们自己接管这块留白。 */}
        <div className="shell shell-nav pt-[env(safe-area-inset-top)]">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 text-label font-semibold tracking-tight text-ink-950"
          >
            <SiteMark />
            电吉他资料库
          </Link>
          {/* 桌面导航；移动端下沉到底部 dock，这里只留站点名 */}
          <nav aria-label="主导航" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {DESKTOP_ITEMS.map((item) => {
                const active = isActive(pathname, item);
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

      {/* 移动端底部 dock：固定、半透明模糊、避让底部安全区。
          桌面（sm+）不渲染。footer 的底部留白为它让位（见 SiteFooter）。 */}
      <nav
        aria-label="移动端导航"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-canvas/92 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas sm:hidden"
      >
        <ul className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {DOCK_ITEMS.map((item) => {
            const active = isActive(pathname, item);
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
