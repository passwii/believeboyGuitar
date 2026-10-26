import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { TOOL_PAGES } from "@/components/ToolPages";

export const metadata: Metadata = {
  title: "工具间",
};

/**
 * 工具间（/tools）。
 *
 * 工具页清单的唯一事实来源仍是 components/ToolPages.tsx 的 TOOL_PAGES；
 * 这里与首页的「工具」区块、桌面导航、移动端 dock 都只读它。
 *
 * 版式是一块面板里的行，不是卡片墙：节拍器单独占一整行（最常用），
 * 其余四个两列排，全部只用发丝线分隔。
 */
export default function ToolsIndexPage() {
  const featured = TOOL_PAGES.find((tool) => tool.href === "/tools/metronome");
  const others = TOOL_PAGES.filter((tool) => tool.href !== "/tools/metronome");

  return (
    <main className="shell flex-1 pb-16 pt-8 sm:pt-12">
      <header>
        <h1 className="text-display font-display text-balance text-ink-950">工具间</h1>
        <p className="mt-2 max-w-[38ch] text-body text-pretty text-ink-700">
          打开就能用。不需要账号，不挑设备。
        </p>
      </header>

      <div className="mt-8 overflow-hidden rounded-card border border-rule bg-surface">
        {featured ? (
          <Link
            href={featured.href}
            className="flex items-center gap-5 border-b border-rule p-5 transition-colors duration-150 hover:bg-surface-muted/50 sm:p-6"
          >
            <span className="grid size-12 flex-none place-items-center rounded-control bg-accent-700 text-on-accent">
              <Icon name={featured.icon} className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="text-title text-ink-950">{featured.name}</span>
                <span className="text-meta text-ink-500">最常用</span>
              </span>
              <span className="mt-1 block text-body text-pretty text-ink-700">{featured.detail}</span>
            </span>
            <Icon name="chevron-right" className="size-4 flex-none text-ink-300" />
          </Link>
        ) : null}

        <ul className="grid sm:grid-cols-2">
          {others.map((tool) => (
            <li
              key={tool.href}
              className="border-b border-rule last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 sm:[&:nth-child(odd)]:border-r"
            >
              <Link
                href={tool.href}
                className="flex h-full items-start gap-4 p-5 transition-colors duration-150 hover:bg-surface-muted/50"
              >
                <span className="grid size-10 flex-none place-items-center rounded-control bg-surface-muted text-ink-700">
                  <Icon name={tool.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-semibold text-ink-950">{tool.name}</span>
                  <span className="mt-1 block text-meta text-pretty text-ink-500">{tool.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
