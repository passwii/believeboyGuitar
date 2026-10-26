import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

/**
 * 工具页清单。
 *
 * 这些页面是「拿来用的」，不是资料，所以不登记进 content/manifest.ts
 * （与节拍器同理）。五个工具全部住在 /tools 下，
 * 旧地址各有静态跳转壳；工具间、桌面导航、移动端 dock 都从这份清单读，
 * 不另立第二份。
 */
export type ToolPage = {
  href: string;
  name: string;
  detail: string;
  icon: IconName;
};

export const TOOL_PAGES: ToolPage[] = [
  {
    href: "/tools/cheatsheet",
    name: "速查表",
    detail: "调弦、音级指位、推弦目标音、CAGED 五形状、和弦指法、速度术语、拍号重音，一页查完。",
    icon: "cheatsheet",
  },
  {
    href: "/tools/chords",
    name: "和弦库",
    detail: "12 个根音 × 9 种性质，每个按法都从标准调弦与音程组合推出来，含六线谱式按法图。",
    icon: "chords",
  },
  {
    href: "/tools/practice",
    name: "练习计划",
    detail: "选总时长与技术目标，得到一份结构化的练习安排，含三条必须守的纪律。",
    icon: "plan",
  },
  {
    href: "/tools/rhythms",
    name: "节奏型",
    detail: "八种节奏型的可视化网格与击弦统计，按拍号重音切分练习组。",
    icon: "rhythm",
  },
  {
    href: "/tools/metronome",
    name: "节拍器",
    detail: "六种拍号、30–240 BPM、三种音色，带配套的使用指引。",
    icon: "metronome",
  },
];

/**
 * 首页的工具区。
 *
 * 节拍器单独占一行——它是这站打开频率最高的工具；其余四个两列排。
 * 这样刚好填满网格，也顺带把「先动手」的层级说清楚。
 */
export function ToolPages() {
  const featured = TOOL_PAGES.find((tool) => tool.href === "/tools/metronome");
  const others = TOOL_PAGES.filter((tool) => tool.href !== "/tools/metronome");

  return (
    <section className="mt-12" aria-labelledby="tools-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="tools-heading" className="text-title text-ink-950">
          工具
        </h2>
        <Link
          href="/tools"
          className="flex min-h-11 items-center gap-1 text-label text-ink-500 transition-colors duration-150 hover:text-ink-950"
        >
          工具间
          <Icon name="chevron-right" className="size-3.5" />
        </Link>
      </div>

      {featured ? (
        <Link
          href={featured.href}
          className="mt-3 flex items-center gap-4 border-y border-rule py-4 transition-colors duration-150 hover:bg-surface-muted/50"
        >
          <span className="grid size-10 flex-none place-items-center rounded-control bg-accent-700 text-on-accent">
            <Icon name={featured.icon} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-label font-semibold text-ink-950">{featured.name}</span>
            <span className="mt-0.5 block text-meta text-pretty text-ink-500">
              {featured.detail}
            </span>
          </span>
          <Icon name="chevron-right" className="size-3.5 flex-none text-ink-300" />
        </Link>
      ) : null}

      <ul className="grid border-b border-rule sm:grid-cols-2 sm:gap-x-10">
        {others.map((tool) => (
          <li key={tool.href} className="border-b border-rule last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
            <Link href={tool.href} className="row items-center">
              <span className="grid size-9 flex-none place-items-center rounded-control bg-surface-muted text-ink-700">
                <Icon name={tool.icon} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label font-semibold text-ink-950">{tool.name}</span>
                <span className="mt-0.5 block text-meta text-pretty text-ink-500">
                  {tool.detail}
                </span>
              </span>
              <Icon name="chevron-right" className="size-3.5 flex-none text-ink-200" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
