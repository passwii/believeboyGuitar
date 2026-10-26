import type { ReactNode } from "react";

/**
 * 站点图标集（2026-10-25，信号台方向）。
 *
 * 手写内联 SVG：24 网格、1.5px 线宽、圆头圆角。不引图标库，
 * 因为全站只需要十来个，依赖成本高于收益。
 * 图标只做结构提示，不承担语义——可访问名称永远来自旁边的文字。
 */
export type IconName =
  | "home"
  | "library"
  | "tools"
  | "metronome"
  | "play"
  | "pause"
  | "plus"
  | "minus"
  | "search"
  | "filter"
  | "back"
  | "repeat"
  | "chevron-right"
  | "cheatsheet"
  | "chords"
  | "plan"
  | "rhythm";

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  library: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20" />
    </>
  ),
  tools: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  metronome: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  back: <path d="m14 6-6 6 6 6" />,
  repeat: (
    <>
      <path d="M4 9a8 8 0 0 1 13.6-3.6L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 15a8 8 0 0 1-13.6 3.6L4 16" />
      <path d="M4 20v-4h4" />
    </>
  ),
  "chevron-right": <path d="m10 6 6 6-6 6" />,
  cheatsheet: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M3.5 9h17M9 9v11M15 9v11" />
    </>
  ),
  chords: (
    <>
      <path d="M5 5v14M12 5v14M19 5v14" />
      <circle cx="5" cy="9" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="8" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  plan: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  rhythm: <path d="M3 12h3l2.5-7 3.5 14 2.5-9 2 4h4.5" />,
};

export function Icon({
  name,
  className = "size-4",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
