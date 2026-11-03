/**
 * 站点目录的唯一事实来源。
 *
 * 新结构只有两类内容：
 * · 练习：正文在 content/lessons/<slug>.html；
 * · 资料：目前只有指板音阶，路由由资料条目直接给出。
 */

export type PracticeEntry = {
  kind: "week" | "standalone";
  slug: string;
  label?: string;
  title: string;
  focus: string;
};

export const practiceEntries: readonly PracticeEntry[] = [
  {
    kind: "week",
    slug: "week-1-finger-independence",
    label: "第 1 周",
    title: "手指独立",
    focus: "左手运指",
  },
  {
    kind: "week",
    slug: "week-2-alternate-picking",
    label: "第 2 周",
    title: "右手强化",
    focus: "交替拨弦与空拨",
  },
  {
    kind: "standalone",
    slug: "rock-rhythm-pattern",
    title: "摇滚节奏型",
    focus: "F 调 · 4/4 · 强力和弦与掌根制音",
  },
];

export type LibraryEntry = {
  href: string;
  title: string;
  meta: string;
};

export const libraryEntries: readonly LibraryEntry[] = [
  {
    href: "/library/fretboard-scale",
    title: "指板音阶",
    meta: "15 品 · 6 色路径",
  },
];
