import Link from "next/link";

/**
 * 工具页清单。
 *
 * 这些页面是「拿来用的」，不是资料，所以不登记进 content/manifest.ts
 * （与节拍器同理）。BLF-1451 起五个工具全部住在 /tools 下的工具间里，
 * 旧地址各有静态跳转壳；工具间、桌面导航、移动端 dock 都从这份清单读，
 * 不另立第二份。
 */
export const TOOL_PAGES = [
  {
    href: "/tools/cheatsheet",
    name: "速查表",
    detail: "调弦、音级指位、推弦目标音、CAGED 五形状、和弦指法、速度术语、拍号重音，一页查完。",
  },
  {
    href: "/tools/chords",
    name: "和弦库",
    detail: "12 个根音 × 9 种性质，每个按法都从标准调弦与音程组合推出来，含六线谱式按法图。",
  },
  {
    href: "/tools/practice",
    name: "练习计划",
    detail: "选总时长与技术目标，得到一份结构化的练习安排，含三条必须守的纪律。",
  },
  {
    href: "/tools/rhythms",
    name: "节奏型",
    detail: "八种节奏型的可视化网格与击弦统计，按拍号重音切分练习组。",
  },
  {
    href: "/tools/metronome",
    name: "节拍器",
    detail: "六种拍号、30–240 BPM、三种音色，带配套的使用指引。",
  },
] as const;

export function ToolPages() {
  return (
    <section className="mt-12" aria-labelledby="tools-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="tools-heading"
          className="font-mono text-micro font-medium uppercase text-ink-500"
        >
          工具
        </h2>
        <Link
          href="/tools"
          className="flex min-h-11 items-center text-label text-accent-700 underline underline-offset-4"
        >
          工具间
        </Link>
      </div>
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
