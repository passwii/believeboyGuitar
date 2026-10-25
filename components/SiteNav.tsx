"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 站点导航（BLF-1451 重构）。
 *
 * 桌面：站点名 +「资料 / 工具 / 节拍器」。资料与工具是两个空间的入口；
 * 节拍器是全站最高频的工具，保留直达。
 * 移动端：顶部只留站点名，导航整体下沉为底部 dock（书桌 / 资料 / 工具 /
 * 节拍器），带底部安全区避让——这是 PWA 应用感最大的一步。
 *
 * 全站一个世界（2026-10-25）：不再有暗色工具区，导航只有一套外观。
 * 结构照 iOS 导航栏：滚动模糊交给合成层，分隔线交给容器边框，不用 JS 监听。
 */

const DESKTOP_ITEMS = [
  { href: "/library", label: "资料", exact: false },
  { href: "/tools", label: "工具", exact: true },
  { href: "/tools/metronome", label: "节拍器", exact: false },
] as const;

const DOCK_ITEMS = [
  { href: "/", label: "书桌", exact: true },
  { href: "/library", label: "资料", exact: false },
  { href: "/tools", label: "工具", exact: true },
  { href: "/tools/metronome", label: "节拍器", exact: false },
] as const;

function isActive(pathname: string, item: { href: string; exact: boolean }) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-rule bg-canvas/78 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas"
      >
        {/* 顶部安全区（BLF-1448）：PWA 全屏启动后状态栏压在导航上，
            viewport-fit=cover 让我们自己接管这块留白，否则站点名会被时间 / 刘海盖住。
            安全区随屏幕旋转变化，只能用 env() 现算，不能写死像素。 */}
        <div className="shell shell-nav pt-[env(safe-area-inset-top)]">
          <Link
            href="/"
            className="flex min-h-11 items-center font-display text-label font-semibold tracking-tight text-ink-950"
          >
            电吉他学习资料库
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
                      className={`flex min-h-11 items-center rounded-control px-3 text-label transition-colors duration-150 ${
                        active
                          ? "font-semibold text-ink-950"
                          : "text-ink-700 hover:text-ink-950"
                      }`}
                    >
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
                  className={`flex min-h-[var(--dock-h)] flex-col items-center justify-center px-1 text-meta transition-colors duration-150 ${
                    active
                      ? "font-semibold text-ink-950"
                      : "text-ink-500 hover:text-ink-950"
                  }`}
                >
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
