"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/library", label: "资料库" },
  { href: "/metronome", label: "节拍器" },
];

/**
 * 粘性半透明导航。
 *
 * 结构照 iOS 导航栏：左侧站点名、右侧入口。滚动后由浏览器合成层做模糊，
 * 分隔线交给 layout.tsx 的容器边框，避免 JS 监听滚动。
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-canvas/78 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas">
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
        <nav aria-label="主导航">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
  );
}
