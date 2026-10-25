/**
 * 站点身份（BLF-1452 Stage 1）。
 *
 * 这个项目不再只是「资料库」：它是练习、知识、工具三件事共用的学习管理空间。
 * 名字从「电吉他学习资料库」改为「琴房」——一间自己的房间，里面有练习、
 * 有参考资料、有仪器。名字只在这里写一次：布局元信息、PWA 清单、导航、
 * 页脚、节拍器的 Media Session 都从这里读，再改名只改这一处。
 */
export const SITE = {
  name: "琴房",
  shortName: "琴房",
  description: "电吉他练习、知识与工具",
} as const;

/**
 * 全站分类（BLF-1452 视觉重设计）。
 *
 * 顺序就是首页卡片与导航的顺序：练习 → 知识 → 工具 → 节拍器。练习是第一分类，
 * 首页第一屏就是它。桌面导航、移动端 dock、首页分类卡片都只读这一份，
 * 不各写一套入口——加一个分类只改这里加 `components/SiteIcons.tsx` 里的图标。
 *
 * 这里放的是「入口」（路由、名称、图标），不是资料清单：知识条目仍只来自
 * `content/manifest.ts`，工具页仍只来自 `components/ToolPages.tsx`。
 */
export type SectionId = "practice" | "knowledge" | "tools" | "metronome";

export interface Section {
  id: SectionId;
  href: string;
  label: string;
  /** 只有工具间是这一层级的终点，子路由不该点亮它 */
  exact: boolean;
}

export const SECTIONS: readonly Section[] = [
  { id: "practice", href: "/practice", label: "练习", exact: false },
  { id: "knowledge", href: "/library", label: "知识", exact: false },
  { id: "tools", href: "/tools", label: "工具", exact: true },
  { id: "metronome", href: "/tools/metronome", label: "节拍器", exact: false },
];

export const HOME = { href: "/", label: "首页" } as const;
