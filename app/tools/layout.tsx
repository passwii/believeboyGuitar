import type { ReactNode } from "react";

/**
 * 工具区的暗色仪器外壳（BLF-1451，方向 B「舞台侧」）。
 *
 * .zone-tools 在 globals.css 里整体换掉语义令牌的值：舞台黑画布、琥珀强调。
 * 里面的工具组件一行不改就跟暗——颜色全部走语义令牌，这正是当初
 * 「组件不许写死颜色」约定的回报。导航与页脚是布局的兄弟节点，
 * 它们各自用 usePathname 判断是否套同一个类。
 *
 * 注意这不是暗色模式：根布局 colorScheme 仍是 light，换皮只发生在
 * /tools 子树内；读值区（书桌 / 资料库 / 正文）保持冷白。
 */
export default function ToolsLayout({ children }: { children: ReactNode }) {
  // flex-1：根布局的 body 已是 min-h-svh 纵向 flex，这里只负责占满剩余高度，
  // 让暗色画布一直铺到页脚。
  return <div className="zone-tools flex flex-1 flex-col">{children}</div>;
}
