import type { Metadata } from "next";
import Link from "next/link";
import { TOOL_PAGES } from "@/components/ToolPages";

export const metadata: Metadata = {
  title: "工具间",
};

/**
 * 工具间（/tools，BLF-1451）：五个工具一律平等的入口页。
 *
 * 工具页清单的唯一事实来源仍是 components/ToolPages.tsx 的 TOOL_PAGES；
 * 这里与首页的「工具」区块、桌面导航、移动端 dock 都只读它，不另立清单。
 */
export default function ToolsIndexPage() {
  return (
    <main className="shell flex-1 py-10 sm:py-14">
      <header className="measure">
        <p className="font-mono text-micro font-medium uppercase text-ink-500">
          Tool room
        </p>
        <h1 className="mt-3 text-display font-display text-balance text-ink-950">
          工具间
        </h1>
        <p className="mt-4 text-body text-pretty text-ink-700">
          拿来就用的工具，一律平等：打开页面就能用，不需要账号，不挑设备。
        </p>
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
