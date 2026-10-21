import Link from "next/link";

/**
 * 工具页清单。
 *
 * 这些页面是「拿来用的」，不是资料，所以不登记进 content/manifest.ts
 * （与节拍器同理）。它们也不进主导航——DESIGN.md §5 明确导航只保留
 * 站点名与三个主要入口，工具放在首页的「工具」区块里。
 */
export const TOOL_PAGES = [
  {
    href: "/cheatsheet",
    name: "速查表",
    detail: "调弦、音级指位、推弦目标音、CAGED 五形状、和弦指法、速度术语、拍号重音，一页查完。",
  },
  {
    href: "/chords",
    name: "和弦库",
    detail: "12 个根音 × 9 种性质，每个按法都从标准调弦与音程组合推出来，含六线谱式按法图。",
  },
  {
    href: "/practice",
    name: "练习计划",
    detail: "选总时长与技术目标，得到一份结构化的练习安排，含三条必须守的纪律。",
  },
  {
    href: "/rhythms",
    name: "节奏型",
    detail: "八种节奏型的可视化网格与击弦统计，按拍号重音切分练习组。",
  },
  {
    href: "/metronome",
    name: "节拍器",
    detail: "六种拍号、30–240 BPM、三种音色，带配套的使用指引。",
  },
] as const;

export function ToolPages() {
  return (
    <section className="mt-12" aria-labelledby="tools-heading">
      <h2 id="tools-heading" className="text-micro font-medium uppercase text-ink-500">
        工具
      </h2>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {TOOL_PAGES.map((tool) => (
          <li key={tool.href}>
            <Link href={tool.href} className="row">
              <span className="min-w-0 flex-1">
                <span className="block text-title text-balance text-ink-950">
                  {tool.name}
                </span>
                <span className="mt-1.5 block text-body text-ink-700 text-pretty">
                  {tool.detail}
                </span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 7 12"
                fill="none"
                className="mt-2 size-3 shrink-0 self-start text-ink-100"
              >
                <path
                  d="M1 1l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
