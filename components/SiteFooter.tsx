"use client";

import { usePathname } from "next/navigation";

/**
 * 页脚（BLF-1451 从 layout.tsx 拆出）。
 *
 * 拆成客户端组件只有一个原因：/tools 子树是暗色仪器区，页脚必须跟着
 * 换皮，而根布局是服务端组件拿不到路径。逻辑与 SiteNav 相同：
 * /tools 前缀套 .zone-tools，颜色全部走语义令牌。
 *
 * 底部留白做两件事：安全区避让（BLF-1448）+ 为移动端底部 dock 让位
 * （dock 高度是 --dock-h 3.5rem，只在窄屏存在）。
 */
export function SiteFooter() {
  const pathname = usePathname();
  const dark = pathname.startsWith("/tools");

  return (
    <footer
      className={`mt-auto pb-[calc(var(--dock-h)+1.5rem+env(safe-area-inset-bottom))] sm:pb-[max(2.5rem,env(safe-area-inset-bottom))] ${
        dark ? "zone-tools" : ""
      }`}
    >
      <div className="shell">
        <div className="border-t border-rule pt-6 text-meta text-ink-500">
          个人学习资料库 · 内容为原始资料的整理改写
        </div>
      </div>
    </footer>
  );
}
