/**
 * 页脚。
 *
 * 2026-10-25 起全站是一个世界，页脚不再需要按路径换皮，也就不再需要
 * 客户端组件——它是纯静态的版权说明。
 *
 * 底部留白做两件事：安全区避让（BLF-1448）+ 为移动端底部 dock 让位
 * （dock 高度是 --dock-h 3.5rem，只在窄屏存在）。
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto pb-[calc(var(--dock-h)+1.5rem+env(safe-area-inset-bottom))] sm:pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="shell">
        <div className="border-t border-rule pt-6 text-meta text-ink-500">
          个人学习资料库 · 内容为原始资料的整理改写
        </div>
      </div>
    </footer>
  );
}
