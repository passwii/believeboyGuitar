import Link from "next/link";

import { SiteIcon, type IconName } from "@/components/SiteIcons";

/**
 * 工具页清单。
 *
 * 这些页面是「拿来用的」，不是知识条目，所以不登记进 content/manifest.ts。
 * 工具间、首页的分类卡片都从这份清单读，不另立第二份。
 *
 * BLF-1452 Stage 1：练习计划搬进「练习」空间（/practice），不再是工具——
 * 练习的曲谱、要求与时间分配应该在同一页，而不是分两处。
 * 视觉重设计时每个工具配一个图标：工具间不再靠一行行文字辨认。
 */
export const TOOL_PAGES: readonly {
  href: string;
  name: string;
  detail: string;
  icon: IconName;
}[] = [
  {
    href: "/tools/cheatsheet",
    name: "速查表",
    detail: "调弦、音级指位、推弦目标、CAGED 与和弦指法，一页查完。",
    icon: "cheatsheet",
  },
  {
    href: "/tools/chords",
    name: "和弦库",
    detail: "12 个根音 × 9 种性质，按法全部由调弦与音程推导。",
    icon: "chords",
  },
  {
    href: "/tools/rhythms",
    name: "节奏型",
    detail: "八种节奏型的网格与击弦统计，按拍号重音切组。",
    icon: "rhythms",
  },
  {
    href: "/tools/metronome",
    name: "节拍器",
    detail: "六种拍号、30–240 BPM、三种音色。",
    icon: "metronome",
  },
];

/** 工具间（/tools）的卡片墙：图标 + 名称 + 一句用途 */
export function ToolTiles() {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
      {TOOL_PAGES.map((tool) => (
        <li key={tool.href}>
          <Link href={tool.href} className="tile group min-h-0 gap-3">
            <span className="flex items-center gap-3">
              <span className="flex size-10 flex-none items-center justify-center rounded-control bg-canvas text-ink-700 transition-colors duration-150 group-hover:text-accent-700">
                <SiteIcon name={tool.icon} className="size-5" />
              </span>
              <span className="flex-1 text-body font-semibold text-ink-950">
                {tool.name}
              </span>
              <SiteIcon
                name="arrow"
                className="size-4 flex-none text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </span>
            <span className="text-meta text-pretty text-ink-500">{tool.detail}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
