"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HOME, SECTIONS, SITE, type Section } from "@/content/site";
import { SiteIcon, SectionIcon } from "@/components/SiteIcons";

/**
 * 站点导航（BLF-1452 Stage 1 + 视觉重设计）。
 *
 * 分类顺序就是首页的顺序：练习 → 知识 → 工具 → 节拍器，全部读
 * `content/site.ts` 的 SECTIONS。图标与名称成对出现，当前项靠强调色 +
 * `aria-current` 标记，不靠下划线。
 *
 * 两种外壳：
 * - 宽屏：粘性半透明导航，左边站名（回首页），右边四个分类。
 * - 窄屏 / PWA：顶部完全不占位——安装后这里是状态栏，再顶着一条站名栏
 *   只是把内容往下推（BLF-1452 评论拍板）。分类全部沉到底部 dock，
 *   五项：首页 + 四个分类，图标在上、名称在下。
 *
 * /tools 子树套 .zone-tools：暗色仪器区里导航跟着换皮（globals.css）。
 */
const DOCK_ITEMS: readonly (Section | typeof HOME)[] = [HOME, ...SECTIONS];

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  if (item.href === "/") return pathname === "/";
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const dark = pathname.startsWith("/tools");

  return (
    <>
      {/* 窄屏没有顶部导航栏，但 PWA 全屏时状态栏仍然压在内容上：
          用一段纯安全区的留白接管它，内容从状态栏下方开始。
          宽屏不需要（导航栏自己带 padding）。 */}
      <div
        aria-hidden="true"
        className="h-[env(safe-area-inset-top)] shrink-0 sm:hidden"
      />

      <header
        className={`sticky top-0 z-30 hidden border-b border-rule bg-canvas/78 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas sm:block ${
          dark ? "zone-tools" : ""
        }`}
      >
        {/* 顶部安全区（BLF-1448）：PWA 全屏启动后状态栏压在导航上，
            viewport-fit=cover 让我们自己接管这块留白，否则站点名会被时间 / 刘海盖住。
            安全区随屏幕旋转变化，只能用 env() 现算，不能写死像素。 */}
        <div className="shell shell-nav pt-[env(safe-area-inset-top)]">
          <Link
            href={HOME.href}
            aria-current={pathname === HOME.href ? "page" : undefined}
            className="flex min-h-11 items-center font-display text-label font-semibold tracking-tight text-ink-950"
          >
            {SITE.name}
          </Link>

          <nav aria-label="主导航">
            <ul className="flex items-center gap-1">
              {SECTIONS.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2 rounded-control px-3 text-label transition-colors duration-150 ${
                        active
                          ? "font-semibold text-ink-950"
                          : "text-ink-700 hover:text-ink-950"
                      }`}
                    >
                      <SectionIcon
                        id={item.id}
                        weight={active ? 2 : 1.6}
                        className={`size-[18px] ${active ? "text-accent-700" : "text-ink-500"}`}
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
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-canvas/92 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas sm:hidden ${
          dark ? "zone-tools" : ""
        }`}
      >
        <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {DOCK_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const icon =
              "id" in item ? (
                <SectionIcon
                  id={item.id}
                  weight={active ? 2.1 : 1.6}
                  className="size-5"
                />
              ) : (
                <SiteIcon name="home" weight={active ? 2.1 : 1.6} className="size-5" />
              );
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[var(--dock-h)] flex-col items-center justify-center gap-1 text-meta transition-colors duration-150 ${
                    active
                      ? "font-semibold text-accent-700"
                      : "text-ink-500 hover:text-ink-950"
                  }`}
                >
                  {icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
