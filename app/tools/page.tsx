import type { Metadata } from "next";
import Link from "next/link";
import { TOOL_PAGES } from "@/components/ToolPages";

export const metadata: Metadata = {
  title: "工具间",
};

/**
 * 工具间（/tools，BLF-1451）：工具一律平等的入口页。BLF-1452 起剩四个
 * （练习计划搬进 /practice），页面只留标题与条目，不再写导语。
 *
 * 工具页清单的唯一事实来源仍是 components/ToolPages.tsx 的 TOOL_PAGES；
 * 这里与首页的「工具」区块、桌面导航、移动端 dock 都只读它，不另立清单。
 */
export default function ToolsIndexPage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <h1 className="text-display font-display text-balance text-ink-950">工具间</h1>
      </header>

      <ol className="mt-10 border-t border-rule">
        {TOOL_PAGES.map((tool, index) => (
          <li key={tool.href}>
            <Link href={tool.href} className="row">
              <span
                aria-hidden="true"
                className="w-7 flex-none pt-1.5 text-right font-mono text-meta leading-6 text-ink-500"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-balance text-title text-ink-950">
                  {tool.name}
                </span>
                <span className="mt-1.5 block text-body text-pretty text-ink-700">
                  {tool.detail}
                </span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 7 12"
                fill="none"
                className="mt-2 size-3 shrink-0 self-start text-ink-200"
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
      </ol>
    </main>
  );
}
