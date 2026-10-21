import type { ReactNode } from "react";

/**
 * 速查表的通用外壳。
 *
 * 表格必须自己承担横向滚动（display: block + 自身 overflow-x-auto）：
 * `display: table` 的表格宽度由内容决定，放进外层 overflow-x-auto 的容器里
 * 仍会撑破页面。这是 content.css 里 .lesson table 的同一套做法，
 * tests/wide-table-overflow.test.ts 守着。
 */

export type CheatsheetTableProps = {
  /** 无障碍描述，放进 caption */
  caption: string;
  children?: ReactNode;
};

export function CheatsheetTable({ caption, children }: CheatsheetTableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-rule bg-surface">
      <table className="block w-full max-w-full overflow-x-auto overscroll-x-contain border-collapse text-label">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

/** 表头行 */
export function CheatsheetHead({ children }: { children?: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-rule text-micro uppercase text-ink-500">{children}</tr>
    </thead>
  );
}

/** 表头单元格 */
export function CheatsheetColumn({
  children,
  align = "left",
}: {
  children?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 font-medium ${align === "center" ? "text-center" : "text-left"}`}
    >
      {children}
    </th>
  );
}
