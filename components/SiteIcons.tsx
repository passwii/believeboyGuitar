import type { ReactNode, SVGProps } from "react";

import type { SectionId } from "@/content/site";

/**
 * 站点图标（BLF-1452 视觉重设计）。
 *
 * 分类靠图标 + 名称一起辨认，不再靠一行行文字说明。全部图标手绘在这一个
 * 文件里：同一套 24 网格、同一笔宽、圆头圆角，只用 `currentColor`，
 * 所以它们跟着所在区域（亮区 / 工具区）自动换色，不引入新的颜色令牌。
 *
 * 不用 emoji、不用图标字体、不引外部依赖：一个形状对不上时可以只改这里，
 * 而不是等某个包更新。
 */
export type ToolIconName = "cheatsheet" | "chords" | "rhythms" | "metronome";

export type IconName = SectionId | ToolIconName | "home" | "arrow" | "chevron";

const STROKE = 1.6;

const GLYPHS: Record<IconName, ReactNode> = {
  home: (
    <path d="M4 10.6 12 4l8 6.6V19a1 1 0 0 1-1 1h-4.2v-5.4H9.2V20H5a1 1 0 0 1-1-1z" />
  ),
  practice: (
    // 拨片：平顶、直边收拢到底部的尖，底部一个小圆角。不要画成水滴，
    // 那个形状在 24 网格里读起来像地图定位。
    <path d="M6.2 4.6h11.6c1.1 0 1.8.9 1.5 1.9L14.6 18a2.8 2.8 0 0 1-5.2 0L4.7 6.5c-.3-1 .4-1.9 1.5-1.9Z" />
  ),
  knowledge: (
    <>
      <path d="M12 7.6C10.9 6.6 9.4 6 7.6 6H4v11.4h3.6c1.8 0 3.3.6 4.4 1.6 1.1-1 2.6-1.6 4.4-1.6H20V6h-3.6c-1.8 0-3.3.6-4.4 1.6Z" />
      <path d="M12 7.6V19" />
    </>
  ),
  tools: (
    <>
      <path d="M4 7.5h3.4M11 7.5h9M4 16.5h8.4M16 16.5h4" />
      <circle cx="9.2" cy="7.5" r="1.8" />
      <circle cx="14.2" cy="16.5" r="1.8" />
    </>
  ),
  metronome: (
    <>
      <path d="M9.5 3.8h5l3 15.1a1 1 0 0 1-1 1.1H7.5a1 1 0 0 1-1-1.1z" />
      <path d="M13.1 16.6 16.4 6.6" />
      <circle cx="16.4" cy="5.9" r="1.3" />
    </>
  ),
  cheatsheet: (
    <>
      <rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2" />
      <path d="M3.6 9.6h16.8M3.6 14.6h16.8M9.6 9.6v9.8" />
    </>
  ),
  chords: (
    <>
      <path d="M5.5 4.5v15M10.2 4.5v15M14.9 4.5v15M19.6 4.5v15" />
      <path d="M4 7.2h17" />
      <circle cx="7.8" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="13.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="17.2" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  rhythms: (
    <path d="M4.5 14.5v-3M8.4 17.5v-8M12.3 15.5v-4M16.2 19v-11M20.1 13.5v-2" />
  ),
  arrow: <path d="M5 12h13m-5.2-5.4L18.2 12l-5.4 5.4" />,
  chevron: <path d="M8.5 5.5 15 12l-6.5 6.5" />,
};

export type SiteIconProps = {
  name: IconName;
  /** 线宽：选中态可以更实一点，形状与网格不变 */
  weight?: number;
} & Omit<SVGProps<SVGSVGElement>, "name">;

export function SiteIcon({ name, weight = STROKE, className, ...rest }: SiteIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {GLYPHS[name]}
    </svg>
  );
}

/** 分类图标：按 `content/site.ts` 的分类 id 取，导航与卡片共用同一套 */
export function SectionIcon({
  id,
  ...rest
}: { id: SectionId } & Omit<SiteIconProps, "name">) {
  return <SiteIcon name={id} {...rest} />;
}
