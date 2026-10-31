"use client";

import { usePathname } from "next/navigation";

/**
 * 页脚。
 *
 * 2026-10-25 起全站是一个世界，页脚不按路径换皮。
 * 手机上的节拍器与每周练习需要专注模式，所以这些页面的窄屏隐藏页脚；
 * 桌面仍保留正常站点外壳。
 *
 * 底部留白做两件事：安全区避让（BLF-1448）+ 为移动端底部 dock 让位
 * （dock 高度是 --dock-h 3.5rem，只在窄屏存在）。
 */
export function SiteFooter() {
  const pathname = usePathname();
  const focusMode =
    pathname === "/metronome" ||
    pathname.startsWith("/practice/week-") ||
    pathname === "/library/fretboard-scale";

  return (
    <footer
      className={`${focusMode ? "hidden sm:block " : ""}mt-auto pb-[calc(var(--dock-h)+1.5rem+env(safe-area-inset-bottom))] sm:pb-[max(2.5rem,env(safe-area-inset-bottom))]`}
    >
      <div className="shell">
        <div className="border-t border-rule pt-6 text-meta text-ink-500">
          个人练习站 · TAB / 音阶 / 节拍器
        </div>
      </div>
    </footer>
  );
}
