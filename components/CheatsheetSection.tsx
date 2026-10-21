import type { ReactNode } from "react";

/**
 * 速查页的折叠区块。
 *
 * 用原生 details/summary：可访问性由浏览器保证（无需 JS 也能展开），
 * 展开状态存在 open 属性里，不依赖 React state。
 * 动效只有箭头转 180 度（200ms，用项目唯一的 --ease-standard 曲线），
 * 且尊重 prefers-reduced-motion（globals.css 里统一把 transition 压到 0.01ms）。
 */

export type CheatsheetSectionProps = {
  /** 区块 id，用于锚点 */
  id: string;
  /** 区块标题，出现在 summary 里 */
  title: string;
  /** 一句话说明这个区块回答什么问题 */
  hint?: string;
  /** 展开状态关键词，出现在 summary 的副标题位置 */
  summary?: string;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CheatsheetSection({
  id,
  title,
  hint,
  summary,
  defaultOpen = false,
  children,
}: CheatsheetSectionProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group scroll-mt-[calc(var(--nav-h)+1.5rem)] border-t border-rule"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-4 pr-2">
        <span className="min-w-0 flex-1">
          <span className="block text-title text-ink-950 text-balance">{title}</span>
          {summary ? (
            <span className="mt-1 block text-meta text-ink-500">{summary}</span>
          ) : null}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          fill="none"
          className="size-3 shrink-0 text-ink-700 transition-transform duration-200 ease-[var(--ease-standard)] group-open:rotate-180"
        >
          <path
            d="M1 1.5L6 6.5l5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="pb-8">
        {hint ? (
          <p className="measure text-body text-ink-700 text-pretty">{hint}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </details>
  );
}
