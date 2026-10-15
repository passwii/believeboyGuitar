# 电吉他学习资料库 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起一个纯前端的 Next.js 资料库骨架，把「原始资料 → 改写后的 HTML → 清单登记 → 网站浏览」这条流水线跑通，并留下第一条真实内容。

**Architecture:** Next.js App Router 静态导出（`output: "export"`）。`content/manifest.ts` 是唯一事实来源，驱动三个页面（主页 / 资料库 / 内容页）的目录与筛选；每篇正文是 `content/lessons/<slug>.html`，只写语义标签，样式由 `content/content.css` 统一提供。构建期用 `node:fs` 读取正文注入页面。资料库与正文的一致性由 vitest 守护。

**Tech Stack:** Next.js 16.4.1（App Router, Turbopack）、React 19.3、TypeScript 5（strict）、Tailwind CSS 4、Vitest 5。

## Global Constraints

- Node.js ≥ 24，npm ≥ 11（本机 Node v26.11.1 / npm 11.20.0 已验证）
- `next@16.4.1`、`react@19.3.0`、`react-dom@19.3.0`、`tailwindcss@^4`、`vitest@5`
- `@types/node` 必须是 `^24`：`vitest@5` 的 peer 要求 `^22.0.0 || >=24.0.0`，脚手架默认的 `^20` 会导致 npm install 失败
- `next.config.ts` 必须是 `output: "export"`，且**不得开启 `cacheComponents`**：开启后访问 `params` 的动态路由会在预渲染阶段报 `uncached or runtime data` 错误，静态导出直接失败
- 页面组件的 props **不得使用 Next.js 生成的全局类型** `LayoutProps<"...">` / `PageProps<"...">`，这些类型只在 `next build`/`next dev` 之后存在，`tsc --noEmit` 会报 `Cannot find name`。显式写 `{ children: ReactNode }` 与 `{ params: Promise<{ slug: string }> }`
- `content/lessons/*.html` 只允许语义标签（`article`/`h2`/`h3`/`p`/`ul`/`ol`/`li`/`strong`/`code`/`table`/`blockquote`）。**禁止** `<script>`、`<style>`、`<link>`、行内 `style=` 属性、以及任何自带导航
- `content/lessons/*.html` 必须以 `<article>` 为根元素并闭合
- slug 必须是小写 kebab-case：`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- `updatedAt` 必须是 `YYYY-MM-DD`
- `inbox/` 与 `archive/` 永不纳入版本库（`.gitignore` 已拦截）：原始资料体积大且涉及版权
- 每个任务结束时提交一次，commit message 用中文，结尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- 所有中文文案使用中文全角标点；中英文之间留一个空格

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `next.config.ts` | 静态导出配置 |
| `app/globals.css` | Tailwind 引入 + `@theme` 设计令牌 |
| `app/layout.tsx` | HTML 外壳、站点导航、引入内容区样式 |
| `app/page.tsx` | 主页：近期目标 + 最近整理 |
| `app/library/page.tsx` | 资料库页面（服务端，读取清单） |
| `app/library/[slug]/page.tsx` | 内容页（构建期读取正文 HTML） |
| `components/SiteNav.tsx` | 站点导航 |
| `components/LessonCard.tsx` | 资料卡片（主页与列表页共用） |
| `components/LibraryBrowser.tsx` | 客户端筛选与搜索 |
| `components/EmptyLibrary.tsx` | 空状态提示 |
| `content/manifest.ts` | **唯一事实来源**：类型、常量、清单、主页目标 |
| `content/content.css` | 内容区排版样式（纯 CSS，`.lesson` 作用域） |
| `content/lessons/<slug>.html` | 每篇正文 |
| `lib/lessons.ts` | 纯查询函数：排序、取最近、筛选 |
| `lib/content-check.ts` | 纯校验函数：元数据、清单与文件一致性、正文约定 |
| `tests/*.test.ts` | vitest 测试 |
| `README.md` / `CLAUDE.md` | 使用说明与项目约束 |

---

### Task 1: 项目骨架与静态导出

**Files:**
- Create: `package.json`、`tsconfig.json`、`next.config.ts`、`eslint.config.mjs`、`app/layout.tsx`、`app/page.tsx`、`app/globals.css`、`AGENTS.md`、`README.md`、`next-env.d.ts`（由脚手架生成）
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 Next.js 项目；`npm run build` 产出 `out/`；`@/*` 路径别名指向项目根

- [ ] **Step 1: 在临时目录生成脚手架**

项目目录已有 `.git`、`.gitignore`、`docs/`，`create-next-app` 在非空目录会冲突，因此先生成到临时目录再同步过来。

```bash
cd /tmp && rm -rf guitar-scaffold && npx --yes create-next-app@latest guitar-scaffold \
  --ts --tailwind --app --eslint --empty --disable-git --use-npm --yes
```

预期：输出 `Success! Created guitar-scaffold at /tmp/guitar-scaffold`，且临时目录内**没有** `.git`。

- [ ] **Step 2: 同步到项目目录**

```bash
rsync -a --exclude '.git' /tmp/guitar-scaffold/ /Users/damon/DamonProjects/believeboyGuitar/
```

预期：项目的 `.git/` 与 `docs/` 未被改动。

- [ ] **Step 3: 补回被覆盖的 .gitignore 条目**

脚手架的 `.gitignore` 已包含 `node_modules/`、`.next/`、`out/`、`.DS_Store`、`*.tsbuildinfo`、`.env*`，但缺少原始资料目录。追加：

```bash
cd /Users/damon/DamonProjects/believeboyGuitar
cat >> .gitignore <<'EOF'

# 原始资料：体积大且涉及版权，不纳入版本库
/inbox/
/archive/
EOF
mkdir -p inbox archive content/lessons components lib tests docs/superpowers/plans
```

- [ ] **Step 4: 配置静态导出**

`next.config.ts` 全文替换为：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

注意：刻意去掉了脚手架默认的 `cacheComponents: true` 与 `partialPrefetching: true`——已实测开启后 `/library/[slug]` 会在预渲染时报 `uncached or runtime data during prerendering` 并导致导出失败。

- [ ] **Step 5: 去掉会引用未生成类型的 layout**

脚手架生成的 `app/layout.tsx` 用了 `LayoutProps<"/">`，该全局类型只在 `next build`/`next dev` 之后存在，独立运行 `tsc --noEmit` 会报 `Cannot find name 'LayoutProps'`。先替换为不依赖生成类型的版本（Task 2 再补导航）：

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "电吉他学习资料库",
  description: "个人电吉他学习资料的整理与长期积累",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: 添加脚本**

`package.json` 的 `scripts` 改为：

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
```

- [ ] **Step 7: 安装依赖并验证构建**

```bash
cd /Users/damon/DamonProjects/believeboyGuitar
npm install
npm run typecheck
npm run build
ls out/index.html
```

预期：`typecheck` 无输出（无错误）；`build` 输出 `✓ Generating static pages` 并以 `Route (app)` 表格结尾；`ls` 打印 `out/index.html`。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "chore: 搭建 Next.js 骨架并配置静态导出

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 设计令牌与站点外壳

**Files:**
- Modify: `app/globals.css`、`app/layout.tsx`
- Create: `components/SiteNav.tsx`

**Interfaces:**
- Consumes: Task 1 的 `app/layout.tsx`
- Produces: Tailwind 主题令牌 `--color-ink-50/100/200/300/500/700/950`、`--color-accent-50/100/600/700`、`--font-sans`、`--font-mono`；全站导航组件

- [ ] **Step 1: 定义设计令牌**

`app/globals.css` 全文替换为：

```css
@import "tailwindcss";

@theme {
  --color-ink-950: oklch(0.22 0.015 265);
  --color-ink-700: oklch(0.38 0.015 265);
  --color-ink-500: oklch(0.55 0.012 265);
  --color-ink-300: oklch(0.78 0.008 265);
  --color-ink-200: oklch(0.9 0.006 265);
  --color-ink-100: oklch(0.94 0.005 265);
  --color-ink-50: oklch(0.98 0.003 265);

  --color-accent-700: oklch(0.48 0.14 45);
  --color-accent-600: oklch(0.58 0.16 45);
  --color-accent-100: oklch(0.93 0.04 55);
  --color-accent-50: oklch(0.97 0.02 60);

  --font-sans: ui-sans-serif, system-ui, -apple-system, "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

body {
  background-color: var(--color-ink-50);
  color: var(--color-ink-950);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

一个中性色系（`ink`）加一个强调色（`accent`，暖铜色），符合设计文档「先朴素、可读优先」。

- [ ] **Step 2: 写导航组件**

`components/SiteNav.tsx`：

```tsx
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "主页" },
  { href: "/library", label: "资料库" },
];

export function SiteNav() {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="font-semibold tracking-tight text-ink-950">
          电吉他学习资料库
        </Link>
        <nav className="flex gap-5 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-700 hover:text-accent-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: 接入 layout**

`app/layout.tsx` 全文替换为：

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "电吉他学习资料库",
  description: "个人电吉他学习资料的整理与长期积累",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <SiteNav />
        {children}
        <footer className="mx-auto max-w-3xl px-5 py-10 text-xs text-ink-500">
          个人学习资料库 · 内容为原始资料的整理改写
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 验证构建并截图**

```bash
npm run typecheck
```

预期：无输出（无错误）。

```bash
npm run build
```

预期：构建成功。

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`，确认：顶部导航可见，「电吉他学习资料库」与「主页 / 资料库」链接可点，正文区是浅灰底、深色字。截图确认后 `Ctrl-C` 停掉 dev server。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 加入设计令牌与站点导航

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 内容模型与清单

**Files:**
- Create: `content/manifest.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `STAGES: readonly ["入门","基础","进阶"]`、`type Stage`
  - `TOPICS: readonly ["乐理","技巧","音阶与指板","曲谱","设备与音色","资料库说明"]`、`type Topic`
  - `DIFFICULTIES: readonly [1,2,3,4,5]`、`type Difficulty`
  - `interface Lesson { slug: string; title: string; summary: string; stage: Stage; topics: Topic[]; tags: string[]; difficulty: Difficulty; source: string; updatedAt: string }`
  - `interface HomeGoal { title: string; detail: string }`
  - `home: { goals: HomeGoal[] }`
  - `lessons: Lesson[]`

- [ ] **Step 1: 写清单模块**

`content/manifest.ts`：

```ts
export const STAGES = ["入门", "基础", "进阶"] as const;
export type Stage = (typeof STAGES)[number];

export const TOPICS = [
  "乐理",
  "技巧",
  "音阶与指板",
  "曲谱",
  "设备与音色",
  "资料库说明",
] as const;
export type Topic = (typeof TOPICS)[number];

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Lesson {
  /** 唯一标识，对应 content/lessons/<slug>.html */
  slug: string;
  title: string;
  summary: string;
  stage: Stage;
  topics: Topic[];
  tags: string[];
  /** 1（最易）到 5（最难） */
  difficulty: Difficulty;
  /** 来源出处与版权说明 */
  source: string;
  /** 最近整理时间，YYYY-MM-DD */
  updatedAt: string;
}

export interface HomeGoal {
  title: string;
  detail: string;
}

/** 主页的近期学习目标，手写维护 */
export const home: { goals: HomeGoal[] } = {
  goals: [],
};

/** 全部资料。这是网站目录与筛选的唯一事实来源 */
export const lessons: Lesson[] = [];
```

`资料库说明` 这个主题是给「如何使用这个资料库」这类元信息内容用的，避免把它硬塞进乐器主题里。

- [ ] **Step 2: 验证类型**

```bash
npm run typecheck
```

预期：无输出（无错误）。

- [ ] **Step 3: 提交**

```bash
git add content/manifest.ts
git commit -m "feat: 定义内容模型与清单

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 查询与筛选纯函数

**Files:**
- Create: `lib/lessons.ts`、`tests/lessons.test.ts`、`vitest.config.mts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 3 的 `Lesson`、`Stage`、`Topic`
- Produces:
  - `interface LessonFilter { query?: string; topics?: Topic[]; stages?: Stage[]; difficulty?: number[] }`
  - `sortByUpdatedAt(lessons: Lesson[]): Lesson[]`
  - `recentLessons(lessons: Lesson[], count: number): Lesson[]`
  - `matchesFilter(lesson: Lesson, filter: LessonFilter): boolean`
  - `filterLessons(lessons: Lesson[], filter: LessonFilter): Lesson[]`

- [ ] **Step 1: 安装并配置 vitest**

`@types/node` 必须一起升到 `^24`，否则 npm 会因 peer 冲突拒绝安装 `vitest@5`：

```bash
cd /Users/damon/DamonProjects/believeboyGuitar
npm install -D @types/node@^24 vitest@5
```

`vitest.config.mts`（用 `.mts` 扩展名，否则 Vite 会警告「ESM syntax in a file loaded as CommonJS」）：

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd()) },
  },
});
```

`package.json` 的 `scripts` 增加一行：

```json
    "test": "vitest run"
```

- [ ] **Step 2: 写失败的测试**

`tests/lessons.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/content/manifest";
import { filterLessons, matchesFilter, recentLessons, sortByUpdatedAt } from "@/lib/lessons";

function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, "slug">): Lesson {
  return {
    title: overrides.slug,
    summary: "",
    stage: "入门",
    topics: ["技巧"],
    tags: [],
    difficulty: 1,
    source: "测试",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("sortByUpdatedAt", () => {
  it("按整理时间倒序排列", () => {
    const result = sortByUpdatedAt([
      makeLesson({ slug: "old", updatedAt: "2026-01-01" }),
      makeLesson({ slug: "new", updatedAt: "2026-03-01" }),
      makeLesson({ slug: "mid", updatedAt: "2026-02-01" }),
    ]);
    expect(result.map((lesson) => lesson.slug)).toEqual(["new", "mid", "old"]);
  });

  it("不修改传入的数组", () => {
    const input = [
      makeLesson({ slug: "a", updatedAt: "2026-01-01" }),
      makeLesson({ slug: "b", updatedAt: "2026-02-01" }),
    ];
    sortByUpdatedAt(input);
    expect(input.map((lesson) => lesson.slug)).toEqual(["a", "b"]);
  });
});

describe("recentLessons", () => {
  it("返回最近的若干篇", () => {
    const result = recentLessons(
      [
        makeLesson({ slug: "old", updatedAt: "2026-01-01" }),
        makeLesson({ slug: "new", updatedAt: "2026-03-01" }),
      ],
      1,
    );
    expect(result.map((lesson) => lesson.slug)).toEqual(["new"]);
  });
});

describe("matchesFilter", () => {
  const lesson = makeLesson({
    slug: "pentatonic",
    title: "五声音阶",
    summary: "小调五声音阶的指型",
    stage: "基础",
    topics: ["音阶与指板"],
    tags: ["音阶", "即兴"],
    difficulty: 3,
  });

  it("空筛选条件匹配一切", () => {
    expect(matchesFilter(lesson, {})).toBe(true);
  });

  it("按标题匹配关键词", () => {
    expect(matchesFilter(lesson, { query: "五声" })).toBe(true);
    expect(matchesFilter(lesson, { query: "和弦" })).toBe(false);
  });

  it("按标签匹配关键词，且忽略大小写与首尾空格", () => {
    expect(matchesFilter(lesson, { query: "  即兴  " })).toBe(true);
    expect(matchesFilter(makeLesson({ slug: "x", tags: ["BPM"] }), { query: "bpm" })).toBe(true);
  });

  it("按主题筛选，命中任一即可", () => {
    expect(matchesFilter(lesson, { topics: ["音阶与指板", "乐理"] })).toBe(true);
    expect(matchesFilter(lesson, { topics: ["乐理"] })).toBe(false);
  });

  it("按阶段筛选", () => {
    expect(matchesFilter(lesson, { stages: ["基础"] })).toBe(true);
    expect(matchesFilter(lesson, { stages: ["进阶"] })).toBe(false);
  });

  it("按难度筛选", () => {
    expect(matchesFilter(lesson, { difficulty: [3, 4] })).toBe(true);
    expect(matchesFilter(lesson, { difficulty: [1] })).toBe(false);
  });

  it("多个维度之间是且的关系", () => {
    expect(matchesFilter(lesson, { query: "五声", stages: ["基础"] })).toBe(true);
    expect(matchesFilter(lesson, { query: "五声", stages: ["进阶"] })).toBe(false);
  });
});

describe("filterLessons", () => {
  it("筛选后仍按时间倒序", () => {
    const result = filterLessons(
      [
        makeLesson({ slug: "a", stage: "基础", updatedAt: "2026-01-01" }),
        makeLesson({ slug: "b", stage: "基础", updatedAt: "2026-03-01" }),
        makeLesson({ slug: "c", stage: "进阶", updatedAt: "2026-02-01" }),
      ],
      { stages: ["基础"] },
    );
    expect(result.map((lesson) => lesson.slug)).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npm test
```

预期：FAIL，报 `Failed to resolve import "@/lib/lessons"`。

- [ ] **Step 4: 实现纯函数**

`lib/lessons.ts`：

```ts
import type { Lesson, Stage, Topic } from "@/content/manifest";

export interface LessonFilter {
  query?: string;
  topics?: Topic[];
  stages?: Stage[];
  difficulty?: number[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function sortByUpdatedAt(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

export function recentLessons(lessons: Lesson[], count: number): Lesson[] {
  return sortByUpdatedAt(lessons).slice(0, count);
}

export function matchesFilter(lesson: Lesson, filter: LessonFilter): boolean {
  const query = normalize(filter.query ?? "");
  if (query !== "") {
    const haystack = [lesson.title, lesson.summary, ...lesson.topics, ...lesson.tags]
      .map(normalize)
      .join(" ");
    if (!haystack.includes(query)) return false;
  }

  const topics = filter.topics ?? [];
  if (topics.length > 0 && !topics.some((topic) => lesson.topics.includes(topic))) {
    return false;
  }

  const stages = filter.stages ?? [];
  if (stages.length > 0 && !stages.includes(lesson.stage)) {
    return false;
  }

  const difficulty = filter.difficulty ?? [];
  if (difficulty.length > 0 && !difficulty.includes(lesson.difficulty)) {
    return false;
  }

  return true;
}

export function filterLessons(lessons: Lesson[], filter: LessonFilter): Lesson[] {
  return sortByUpdatedAt(lessons.filter((lesson) => matchesFilter(lesson, filter)));
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test
```

预期：`Test Files 1 passed`、`Tests 11 passed`。

```bash
npm run typecheck
```

预期：无输出（无错误）。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 加入排序与筛选纯函数

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 内容一致性校验函数

**Files:**
- Create: `lib/content-check.ts`、`tests/content-check.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `Lesson`、`STAGES`、`TOPICS`、`DIFFICULTIES`
- Produces:
  - `validateLessonMetadata(lesson: Lesson): string[]`
  - `checkManifestAgainstFiles(lessons: Lesson[], files: string[]): string[]`
  - `validateContentHtml(html: string, slug: string): string[]`
  - `runContentCheck(input: { lessons: Lesson[]; files: string[]; readHtml: (slug: string) => string }): string[]`

约定：所有函数返回**问题描述数组**，空数组表示没有问题。

- [ ] **Step 1: 写失败的测试**

`tests/content-check.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import type { Lesson } from "@/content/manifest";
import {
  checkManifestAgainstFiles,
  runContentCheck,
  validateContentHtml,
  validateLessonMetadata,
} from "@/lib/content-check";

function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, "slug">): Lesson {
  return {
    title: "标题",
    summary: "简介",
    stage: "入门",
    topics: ["技巧"],
    tags: [],
    difficulty: 1,
    source: "某本书",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("validateLessonMetadata", () => {
  it("接受一条合法记录", () => {
    expect(validateLessonMetadata(makeLesson({ slug: "pentatonic" }))).toEqual([]);
  });

  it("拒绝非 kebab-case 的 slug", () => {
    const issues = validateLessonMetadata(makeLesson({ slug: "Penta_Tonic" }));
    expect(issues.some((issue) => issue.includes("slug"))).toBe(true);
  });

  it("拒绝空的 title、summary、source", () => {
    const issues = validateLessonMetadata(
      makeLesson({ slug: "a", title: "  ", summary: "", source: "" }),
    );
    expect(issues.filter((issue) => issue.includes("不能为空"))).toHaveLength(3);
  });

  it("拒绝非法日期格式", () => {
    const issues = validateLessonMetadata(makeLesson({ slug: "a", updatedAt: "2026/1/1" }));
    expect(issues.some((issue) => issue.includes("YYYY-MM-DD"))).toBe(true);
  });

  it("拒绝越界难度", () => {
    const issues = validateLessonMetadata(
      makeLesson({ slug: "a", difficulty: 9 as unknown as Lesson["difficulty"] }),
    );
    expect(issues.some((issue) => issue.includes("difficulty"))).toBe(true);
  });

  it("要求至少一个主题，且主题在允许值内", () => {
    expect(
      validateLessonMetadata(makeLesson({ slug: "a", topics: [] })).some((issue) =>
        issue.includes("至少需要一个 topic"),
      ),
    ).toBe(true);
    expect(
      validateLessonMetadata(
        makeLesson({ slug: "a", topics: ["不存在"] as unknown as Lesson["topics"] }),
      ).some((issue) => issue.includes("不在允许值内")),
    ).toBe(true);
  });
});

describe("checkManifestAgainstFiles", () => {
  it("清单与文件一一对应时无问题", () => {
    expect(
      checkManifestAgainstFiles(
        [makeLesson({ slug: "a" }), makeLesson({ slug: "b" })],
        ["a.html", "b.html"],
      ),
    ).toEqual([]);
  });

  it("报告重复 slug", () => {
    const issues = checkManifestAgainstFiles(
      [makeLesson({ slug: "a" }), makeLesson({ slug: "a" })],
      ["a.html"],
    );
    expect(issues).toEqual(["slug 重复：a"]);
  });

  it("报告缺失的内容文件", () => {
    const issues = checkManifestAgainstFiles([makeLesson({ slug: "a" })], []);
    expect(issues.some((issue) => issue.includes("缺少 content/lessons/a.html"))).toBe(true);
  });

  it("报告游离的内容文件", () => {
    const issues = checkManifestAgainstFiles([], ["orphan.html"]);
    expect(issues.some((issue) => issue.includes("游离内容文件"))).toBe(true);
  });
});

describe("validateContentHtml", () => {
  const valid = "<article>\n<h2>标题</h2>\n<p>正文</p>\n</article>";

  it("接受只含语义标签的正文", () => {
    expect(validateContentHtml(valid, "a")).toEqual([]);
  });

  it("拒绝 script、style、link 与行内 style 属性", () => {
    expect(validateContentHtml(valid + "<script>x</script>", "a")).toHaveLength(1);
    expect(validateContentHtml('<p style="color:red">x</p><article></article>', "a")).toHaveLength(1);
    expect(validateContentHtml('<link rel="x"><article></article>', "a")).toHaveLength(1);
    expect(validateContentHtml("<style>p{}</style><article></article>", "a")).toHaveLength(1);
  });

  it("要求 article 根元素且闭合", () => {
    expect(validateContentHtml("<p>没有根元素</p>", "a").some((i) => i.includes("缺少 <article>"))).toBe(true);
    expect(validateContentHtml("<article><p>未闭合", "a").some((i) => i.includes("未闭合"))).toBe(true);
  });
});

describe("runContentCheck", () => {
  it("汇总额外校验，合法输入返回空数组", () => {
    expect(
      runContentCheck({
        lessons: [makeLesson({ slug: "a" })],
        files: ["a.html"],
        readHtml: () => "<article><p>正文</p></article>",
      }),
    ).toEqual([]);
  });

  it("汇总元数据、文件与正文三类问题", () => {
    const issues = runContentCheck({
      lessons: [makeLesson({ slug: "a", source: "" }), makeLesson({ slug: "b" })],
      files: ["a.html", "orphan.html"],
      readHtml: () => "<p>缺少根元素</p>",
    });
    expect(issues.some((issue) => issue.includes("source 不能为空"))).toBe(true);
    expect(issues.some((issue) => issue.includes("缺少 content/lessons/b.html"))).toBe(true);
    expect(issues.some((issue) => issue.includes("游离内容文件"))).toBe(true);
    expect(issues.some((issue) => issue.includes("缺少 <article>"))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

预期：FAIL，报 `Failed to resolve import "@/lib/content-check"`。

- [ ] **Step 3: 实现校验函数**

`lib/content-check.ts`：

```ts
import { DIFFICULTIES, STAGES, TOPICS, type Lesson } from "@/content/manifest";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FORBIDDEN_IN_CONTENT: { pattern: RegExp; message: string }[] = [
  { pattern: /<script\b/i, message: "不得包含 <script>" },
  { pattern: /<style\b/i, message: "不得包含 <style>" },
  { pattern: /<link\b/i, message: "不得包含 <link>" },
  { pattern: /\sstyle\s*=/i, message: "不得包含行内 style 属性" },
];

export function validateLessonMetadata(lesson: Lesson): string[] {
  const issues: string[] = [];

  if (!SLUG_PATTERN.test(lesson.slug)) {
    issues.push(`slug 应为小写 kebab-case：${lesson.slug}`);
  }
  if (lesson.title.trim() === "") {
    issues.push(`${lesson.slug}：title 不能为空`);
  }
  if (lesson.summary.trim() === "") {
    issues.push(`${lesson.slug}：summary 不能为空`);
  }
  if (lesson.source.trim() === "") {
    issues.push(`${lesson.slug}：source 不能为空`);
  }
  if (!STAGES.includes(lesson.stage)) {
    issues.push(`${lesson.slug}：stage 不在允许值内：${lesson.stage}`);
  }
  if (!DATE_PATTERN.test(lesson.updatedAt)) {
    issues.push(`${lesson.slug}：updatedAt 应为 YYYY-MM-DD：${lesson.updatedAt}`);
  }
  if (!DIFFICULTIES.includes(lesson.difficulty)) {
    issues.push(`${lesson.slug}：difficulty 应为 1-5：${lesson.difficulty}`);
  }
  if (lesson.topics.length === 0) {
    issues.push(`${lesson.slug}：至少需要一个 topic`);
  }
  for (const topic of lesson.topics) {
    if (!TOPICS.includes(topic)) {
      issues.push(`${lesson.slug}：topic 不在允许值内：${topic}`);
    }
  }

  return issues;
}

export function checkManifestAgainstFiles(lessons: Lesson[], files: string[]): string[] {
  const issues: string[] = [];

  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (seen.has(lesson.slug)) {
      issues.push(`slug 重复：${lesson.slug}`);
    }
    seen.add(lesson.slug);
  }

  const expected = new Set([...seen].map((slug) => `${slug}.html`));

  for (const file of expected) {
    if (!files.includes(file)) {
      issues.push(`清单中有 ${file.replace(/\.html$/, "")}，但缺少 content/lessons/${file}`);
    }
  }
  for (const file of files) {
    if (!expected.has(file)) {
      issues.push(`存在游离内容文件（清单中无对应条目）：content/lessons/${file}`);
    }
  }

  return issues;
}

export function validateContentHtml(html: string, slug: string): string[] {
  const issues: string[] = [];

  for (const rule of FORBIDDEN_IN_CONTENT) {
    if (rule.pattern.test(html)) {
      issues.push(`${slug}：内容文件${rule.message}`);
    }
  }
  if (!/<article\b/i.test(html)) {
    issues.push(`${slug}：内容文件缺少 <article> 根元素`);
  }
  if (!/<\/article>/i.test(html)) {
    issues.push(`${slug}：内容文件 <article> 未闭合`);
  }

  return issues;
}

export function runContentCheck(input: {
  lessons: Lesson[];
  files: string[];
  readHtml: (slug: string) => string;
}): string[] {
  const issues: string[] = [];

  for (const lesson of input.lessons) {
    issues.push(...validateLessonMetadata(lesson));
  }

  issues.push(...checkManifestAgainstFiles(input.lessons, input.files));

  for (const lesson of input.lessons) {
    if (input.files.includes(`${lesson.slug}.html`)) {
      issues.push(...validateContentHtml(input.readHtml(lesson.slug), lesson.slug));
    }
  }

  return issues;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

预期：`Test Files 2 passed`，全部测试通过。

```bash
npm run typecheck
```

预期：无输出（无错误）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 加入清单与正文的一致性校验

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: 第一篇内容与清单条目

这一篇是原创的元信息内容（讲资料库自己怎么用），不涉及任何第三方版权，因此可以作为第一篇内容来验证整条流水线。真正的电吉他知识内容等你提供原始资料后再整理。

**Files:**
- Create: `content/lessons/how-to-use-this-library.html`
- Modify: `content/manifest.ts`

**Interfaces:**
- Consumes: Task 3 的 `Lesson`、`lessons`
- Produces: slug 为 `how-to-use-this-library` 的清单条目与对应正文文件

- [ ] **Step 1: 写正文**

`content/lessons/how-to-use-this-library.html`：

```html
<article>
  <h2>这个资料库解决什么问题</h2>
  <p>
    收集来的资料本身不是学习成果。PDF、截图、零散的笔记往往结构混乱、重点不明，
    每次想复习都要重新翻一遍。这个资料库承担的是一次性的整理工作：把原始资料
    提炼、重组、改写成结构清晰、可以直接阅读的内容，之后只需要读整理后的页面。
  </p>
  <p><strong>原始资料是输入，改写后的页面才是资产。</strong></p>

  <h2>内容是怎么组织的</h2>
  <p>
    每篇内容由两部分构成：一个只放正文的 HTML 文件，以及清单里的一条记录。
    正文文件不写样式、不写导航，样式全部由网站统一提供，这样视觉上不会走样。
  </p>
  <p>清单里每条记录的字段含义：</p>
  <table>
    <thead>
      <tr>
        <th>字段</th>
        <th>含义</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>slug</td>
        <td>唯一标识，决定正文文件名与访问地址</td>
      </tr>
      <tr>
        <td>title / summary</td>
        <td>标题与一句话简介</td>
      </tr>
      <tr>
        <td>stage</td>
        <td>学习阶段：入门、基础、进阶</td>
      </tr>
      <tr>
        <td>topics</td>
        <td>所属主题，用于资料库筛选</td>
      </tr>
      <tr>
        <td>tags</td>
        <td>自由标签，参与搜索</td>
      </tr>
      <tr>
        <td>difficulty</td>
        <td>难度，1 到 5</td>
      </tr>
      <tr>
        <td>source</td>
        <td>来源出处与版权说明</td>
      </tr>
      <tr>
        <td>updatedAt</td>
        <td>最近整理时间</td>
      </tr>
    </tbody>
  </table>

  <h2>新增一篇资料的流程</h2>
  <ol>
    <li>把原始资料放进 <code>inbox/</code>。这个目录不纳入版本库。</li>
    <li>先对内容结构达成一致：打算怎么分节、哪些地方不确定、哪些结论需要核对。</li>
    <li>确认后生成 <code>content/lessons/&lt;slug&gt;.html</code>，并在清单里登记一条记录。</li>
    <li>浏览器打开实际页面，确认排版正常、内容没有走样。</li>
    <li>原始资料移到 <code>archive/</code>。</li>
  </ol>

  <h2>哪些内容必须人工核对</h2>
  <p>
    改写是结构重组与语言重写，不是逐字翻译。涉及<strong>指法、音阶图、和弦图</strong>
    这类错一个音就会练错的内容，必须逐条核对原始资料后再采用。
  </p>

  <h2>为什么第一版刻意做得很小</h2>
  <p>
    个人资料库真正的失败模式不是功能少，而是整理了几篇之后就不再更新。
    所以第一版不做打卡、进度统计、复习提醒，也不做账号与云同步。
    等实际用一段时间、确认真实需要了再加。
  </p>
</article>
```

- [ ] **Step 2: 在清单里登记**

把 `content/manifest.ts` 末尾那份空的清单替换掉（`export const lessons: Lesson[] = [];` 整段删除，换成下面这段）：

```ts
/** 全部资料。这是网站目录与筛选的唯一事实来源 */
export const lessons: Lesson[] = [
  {
    slug: "how-to-use-this-library",
    title: "如何使用这个资料库",
    summary: "资料库的组织方式、内容约定，以及新增一篇资料的完整流程。",
    stage: "入门",
    topics: ["资料库说明"],
    tags: ["说明", "工作流"],
    difficulty: 1,
    source: "本资料库原创内容",
    updatedAt: "2026-10-15",
  },
];
```

`home` 与 `lessons` 的声明顺序不影响使用（两者都是模块级常量），保持文件里 `home` 在前、`lessons` 在后的原顺序即可。

- [ ] **Step 3: 验证类型与正文约定**

```bash
npm run typecheck
```

预期：无输出（无错误）。

```bash
npm test
```

预期：全部测试通过。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "content: 添加第一篇内容「如何使用这个资料库」

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: 内容页与内容区样式

**Files:**
- Create: `content/content.css`、`app/library/[slug]/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 3 的 `lessons`、Task 6 的正文文件
- Produces: 路由 `/library/<slug>`；`.lesson` 作用域的内容排版样式

- [ ] **Step 1: 写内容区样式**

`content/content.css`：

```css
/* 内容区排版：只作用于 .lesson 内部，正文 HTML 不携带任何样式 */
.lesson {
  --lesson-measure: 68ch;
  max-width: var(--lesson-measure);
  line-height: 1.8;
}

.lesson h2 {
  margin-top: 2.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.lesson h3 {
  margin-top: 1.75rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.lesson p,
.lesson ul,
.lesson ol,
.lesson table,
.lesson blockquote {
  margin-top: 1rem;
}

.lesson ul,
.lesson ol {
  padding-left: 1.5rem;
}

.lesson ul {
  list-style: disc;
}

.lesson ol {
  list-style: decimal;
}

.lesson li + li {
  margin-top: 0.375rem;
}

.lesson strong {
  font-weight: 600;
}

.lesson code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background-color: var(--color-ink-100);
  padding: 0.1em 0.35em;
  border-radius: 0.25rem;
}

.lesson table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.lesson th,
.lesson td {
  border: 1px solid var(--color-ink-200);
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
}

.lesson th {
  background-color: var(--color-ink-100);
  font-weight: 600;
}

.lesson blockquote {
  border-left: 3px solid var(--color-accent-600);
  padding-left: 1rem;
  color: var(--color-ink-700);
}
```

- [ ] **Step 2: 在 layout 里引入内容区样式**

`app/layout.tsx` 的 import 区加上一行（放在 `./globals.css` 之后）：

```tsx
import "@/content/content.css";
```

- [ ] **Step 3: 写内容页**

`app/library/[slug]/page.tsx`：

```tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lessons } from "@/content/manifest";

export const dynamicParams = false;

export function generateStaticParams() {
  return lessons.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessons.find((item) => item.slug === slug);
  return { title: lesson ? `${lesson.title} · 电吉他学习资料库` : "电吉他学习资料库" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = lessons.find((item) => item.slug === slug);
  if (!lesson) notFound();

  const html = await readFile(
    path.join(process.cwd(), "content", "lessons", `${slug}.html`),
    "utf8",
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/library" className="text-sm text-ink-500 hover:text-accent-700">
        ← 资料库
      </Link>

      <header className="mt-4 border-b border-ink-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 text-sm text-ink-700">{lesson.summary}</p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <div className="flex gap-1">
            <dt className="text-ink-500">阶段</dt>
            <dd className="text-ink-700">{lesson.stage}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-500">难度</dt>
            <dd className="text-ink-700">
              {"★".repeat(lesson.difficulty)}
              {"☆".repeat(5 - lesson.difficulty)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-500">主题</dt>
            <dd className="text-ink-700">{lesson.topics.join(" / ")}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-500">整理于</dt>
            <dd className="text-ink-700">{lesson.updatedAt}</dd>
          </div>
        </dl>
      </header>

      <div className="lesson mt-8" dangerouslySetInnerHTML={{ __html: html }} />

      <footer className="mt-12 border-t border-ink-200 pt-6 text-xs text-ink-500">
        <p>来源：{lesson.source}</p>
        {lesson.tags.length > 0 && <p className="mt-1">标签：{lesson.tags.join(" · ")}</p>}
      </footer>
    </main>
  );
}
```

注意：props 显式写 `{ params: Promise<{ slug: string }> }`，不要用 `PageProps<"/library/[slug]">`——那是构建后才生成的全局类型。

- [ ] **Step 4: 验证构建并截图**

```bash
npm run typecheck
```

预期：无输出（无错误）。

```bash
npm run build
```

预期：构建成功。

```bash
ls out/library/how-to-use-this-library.html
```

预期：打印该路径。

```bash
npm run dev
```

浏览器打开 `http://localhost:3000/library/how-to-use-this-library`，确认：

- 顶部导航与「← 资料库」链接可见
- 标题下的元信息栏显示阶段 / 难度星标 / 主题 / 整理日期
- 正文标题有层级、段落行距舒适、有序列表有编号、表格有边框且表头有底色、`inbox/` 与 `archive/` 的代码样式有浅灰底
- 页脚显示来源与标签

截图确认后 `Ctrl-C`。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 加入内容页与内容区排版样式

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 资料库列表页

**Files:**
- Create: `components/LessonCard.tsx`、`components/EmptyLibrary.tsx`、`components/LibraryBrowser.tsx`、`app/library/page.tsx`

**Interfaces:**
- Consumes: Task 3 的 `lessons`、`TOPICS`、`STAGES`、`DIFFICULTIES`、`Lesson`；Task 4 的 `filterLessons`、`LessonFilter`
- Produces: 路由 `/library`；`LessonCard({ lesson }: { lesson: Lesson })`；`EmptyLibrary()`

- [ ] **Step 1: 写资料卡片**

`components/LessonCard.tsx`：

```tsx
import Link from "next/link";
import type { Lesson } from "@/content/manifest";

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link
      href={`/library/${lesson.slug}`}
      className="block h-full rounded-md border border-ink-200 bg-white p-4 transition-colors hover:border-accent-600"
    >
      <h3 className="font-medium leading-snug text-ink-950">{lesson.title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-700">{lesson.summary}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        <span>{lesson.stage}</span>
        <span aria-label={`难度 ${lesson.difficulty}`}>{"★".repeat(lesson.difficulty)}</span>
        <span>{lesson.topics.join(" / ")}</span>
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: 写空状态**

`components/EmptyLibrary.tsx`：

```tsx
export function EmptyLibrary() {
  return (
    <div className="mt-6 rounded-md border border-dashed border-ink-200 bg-white p-6 text-sm">
      <p className="font-medium text-ink-950">资料库还是空的</p>
      <p className="mt-2 text-ink-700">
        把原始资料放进 inbox/，整理改写后生成 content/lessons/&lt;slug&gt;.html，
        同时在 content/manifest.ts 里登记一条记录。
      </p>
    </div>
  );
}
```

- [ ] **Step 3: 写筛选与搜索**

`components/LibraryBrowser.tsx`：

```tsx
"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DIFFICULTIES,
  STAGES,
  TOPICS,
  type Lesson,
  type Stage,
  type Topic,
} from "@/content/manifest";
import { filterLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full border border-accent-600 bg-accent-600 px-3 py-1 text-xs text-white"
          : "rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700 hover:border-accent-600"
      }
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-9 shrink-0 text-xs text-ink-500">{label}</span>
      {children}
    </div>
  );
}

export function LibraryBrowser({ lessons }: { lessons: Lesson[] }) {
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [difficulty, setDifficulty] = useState<number[]>([]);

  const visible = useMemo(
    () => filterLessons(lessons, { query, topics, stages, difficulty }),
    [lessons, query, topics, stages, difficulty],
  );

  const hasFilter =
    query.trim() !== "" || topics.length > 0 || stages.length > 0 || difficulty.length > 0;

  function reset() {
    setQuery("");
    setTopics([]);
    setStages([]);
    setDifficulty([]);
  }

  return (
    <section className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索标题、简介、主题、标签"
        aria-label="搜索资料"
        className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-600"
      />

      <div className="mt-4 space-y-3">
        <FilterRow label="主题">
          {TOPICS.map((topic) => (
            <FilterChip
              key={topic}
              active={topics.includes(topic)}
              onClick={() => setTopics(toggle(topics, topic))}
            >
              {topic}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="阶段">
          {STAGES.map((stage) => (
            <FilterChip
              key={stage}
              active={stages.includes(stage)}
              onClick={() => setStages(toggle(stages, stage))}
            >
              {stage}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="难度">
          {DIFFICULTIES.map((level) => (
            <FilterChip
              key={level}
              active={difficulty.includes(level)}
              onClick={() => setDifficulty(toggle(difficulty, level))}
            >
              {level}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      <p className="mt-6 text-xs text-ink-500">
        {hasFilter ? `筛选出 ${visible.length} / ${lessons.length} 篇` : `共 ${lessons.length} 篇`}
        {hasFilter && (
          <button type="button" onClick={reset} className="ml-2 underline hover:text-accent-700">
            清除筛选
          </button>
        )}
      </p>

      {lessons.length === 0 ? (
        <EmptyLibrary />
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ink-200 bg-white p-6 text-sm text-ink-500">
          没有符合当前筛选条件的资料。
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((lesson) => (
            <li key={lesson.slug}>
              <LessonCard lesson={lesson} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 写列表页**

`app/library/page.tsx`：

```tsx
import type { Metadata } from "next";
import { lessons } from "@/content/manifest";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const metadata: Metadata = {
  title: "资料库 · 电吉他学习资料库",
};

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">资料库</h1>
      <p className="mt-2 text-sm text-ink-700">
        全部整理后的资料，可按主题、阶段、难度筛选。
      </p>
      <LibraryBrowser lessons={lessons} />
    </main>
  );
}
```

- [ ] **Step 5: 验证构建并截图**

```bash
npm run typecheck
```

预期：无输出（无错误）。

```bash
npm run build
```

预期：构建成功。

```bash
ls out/library.html
```

预期：打印该路径。

```bash
npm run dev
```

浏览器打开 `http://localhost:3000/library`，确认：关键词「资料库说明」，确认只筛出「如何使用这个资料库」一篇，计数显示「筛选出 1 / 1 篇」；点击「主题 → 技巧」确认变成「没有符合当前筛选条件的资料。」；点「清除筛选」确认恢复。再点卡片进入内容页确认跳转正常。

截图确认后 `Ctrl-C`。

- [ ] **Step 6: 验证空状态**

临时把 `content/manifest.ts` 里 `lessons` 数组清空，运行 `npm run dev`，打开 `/library` 确认显示「资料库还是空的」提示与引导文案。确认后**把清单改回来**（不要把清空状态提交）。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: 加入资料库列表页与筛选

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: 主页

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: Task 3 的 `lessons`、`home`；Task 4 的 `recentLessons`；Task 8 的 `LessonCard`、`EmptyLibrary`
- Produces: 路由 `/`

- [ ] **Step 1: 写主页**

`app/page.tsx` 全文替换为：

```tsx
import Link from "next/link";
import { home, lessons } from "@/content/manifest";
import { recentLessons } from "@/lib/lessons";
import { LessonCard } from "@/components/LessonCard";
import { EmptyLibrary } from "@/components/EmptyLibrary";

export default function HomePage() {
  const recent = recentLessons(lessons, 4);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">电吉他学习资料库</h1>
      <p className="mt-2 text-sm text-ink-700">
        把收集到的资料整理改写成可以直接阅读、能长期积累的学习内容。
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-ink-500">近期学习目标</h2>
        {home.goals.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-ink-200 bg-white p-4 text-sm text-ink-500">
            还没有设定目标。在 content/manifest.ts 的 home.goals 里补充。
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {home.goals.map((goal) => (
              <li key={goal.title} className="rounded-md border border-ink-200 bg-white p-4">
                <p className="font-medium text-ink-950">{goal.title}</p>
                {goal.detail !== "" && (
                  <p className="mt-1 text-sm text-ink-700">{goal.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-500">最近整理</h2>
          <Link href="/library" className="text-sm text-accent-700 hover:underline">
            全部资料 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {recent.map((lesson) => (
              <li key={lesson.slug}>
                <LessonCard lesson={lesson} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: 验证构建并截图**

```bash
npm run typecheck
```

预期：无输出（无错误）。

```bash
npm run build
```

预期：构建成功。

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`，确认：标题与说明可见；「近期学习目标」区显示「还没有设定目标」的引导；「最近整理」区出现「如何使用这个资料库」卡片，「全部资料 →」可跳到 `/library`。

- [ ] **Step 3: 验证目标区渲染**

临时在 `content/manifest.ts` 的 `home.goals` 里加一条：

```ts
export const home: { goals: HomeGoal[] } = {
  goals: [{ title: "把五声音阶的五个指型练熟", detail: "每天 15 分钟，先求准确再提速。" }],
};
```

刷新确认目标卡片显示标题与说明，然后**改回空数组**（这一条只是验证渲染，真实目标由你之后自己填）。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 加入主页

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: 仓库级一致性守护测试

前面的校验函数只测了合成输入。这一步把真实的 `content/` 目录接上去，让清单与正文的脱节在 `npm test` 时立刻暴露。

**Files:**
- Create: `tests/content.test.ts`

**Interfaces:**
- Consumes: Task 5 的 `runContentCheck`；Task 3 的 `lessons`；Task 6 的正文文件
- Produces: 守护测试，清单与文件不一致时 `npm test` 失败

- [ ] **Step 1: 写守护测试**

`tests/content.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { lessons } from "@/content/manifest";
import { runContentCheck } from "@/lib/content-check";

const lessonsDir = path.join(process.cwd(), "content", "lessons");

describe("内容库一致性", () => {
  it("清单、正文文件与内容约定三者一致", () => {
    const files = readdirSync(lessonsDir).filter((name) => name.endsWith(".html"));

    const issues = runContentCheck({
      lessons,
      files,
      readHtml: (slug) => readFileSync(path.join(lessonsDir, `${slug}.html`), "utf8"),
    });

    expect(issues).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npm test
```

预期：`Test Files 3 passed`，全部通过。

- [ ] **Step 3: 验证守卫生效**

临时在 `content/lessons/` 下建一个 `orphan-probe.html`，内容为 `<article><p>x</p></article>`，运行：

```bash
npm test
```

预期：FAIL，错误信息包含 `存在游离内容文件`。确认后删除 `orphan-probe.html`，再运行 `npm test` 确认恢复通过。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "test: 加入清单与正文一致性的守护测试

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: 使用说明与项目约束文档

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 前十个任务的全部约定
- Produces: 面向人和面向 agent 的两份文档

- [ ] **Step 1: 写 README**

`README.md` 全文替换为：

```markdown
# 电吉他学习资料库

把收集到的电吉他学习资料整理、改写成可以直接阅读的 HTML 内容，并长期积累。

## 为什么是「改写」

收集来的资料本身不是学习成果。PDF、截图、零散笔记往往结构混乱、重点不明，
每次复习都要重新翻一遍。这个项目承担的是一次性整理工作：把原始资料提炼、
重组、改写成结构清晰的内容，之后只读整理后的页面。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # 校验清单与正文一致性，以及查询逻辑
npm run build    # 静态导出到 out/
```

## 目录结构

| 路径 | 说明 |
|---|---|
| `content/manifest.ts` | 唯一事实来源：全部资料的元数据与主页目标 |
| `content/lessons/*.html` | 每篇正文，只写语义标签，不带样式 |
| `content/content.css` | 内容区排版样式 |
| `app/` | 页面外壳：主页、资料库、内容页 |
| `components/` | 导航、卡片、筛选、空状态 |
| `lib/` | 纯函数：查询筛选、一致性校验 |
| `inbox/` | 原始资料投放处（不纳入版本库） |
| `archive/` | 整理完成后的原始资料归档（不纳入版本库） |

## 新增一篇资料

1. 把原始资料放进 `inbox/`
2. 先确认内容结构：怎么分节、哪些不确定、哪些结论需要核对
3. 生成 `content/lessons/<slug>.html`，并在 `content/manifest.ts` 登记一条记录
4. 浏览器打开实际页面，确认排版正常、内容没走样
5. 原始资料移到 `archive/`
6. 运行 `npm test` 与 `npm run build`

## 内容约定

正文文件只写语义标签（`article`、`h2`、`h3`、`p`、`ul`、`ol`、`li`、`strong`、
`code`、`table`、`blockquote`），以 `<article>` 为根元素：

- 不写 `<script>`、`<style>`、`<link>`
- 不写行内 `style=` 属性
- 不写自带导航

样式全部由 `content/content.css` 统一提供。这些约定由 `npm test` 强制检查——
清单与文件脱节、正文违反约定都会让测试失败。

## 人工核对

改写是结构重组与语言重写，不是逐字翻译。涉及**指法、音阶图、和弦图**这类
错一个音就会练错的内容，必须逐条核对原始资料后再采用。

## 第一版不做什么

练习打卡、进度统计、复习提醒、账号与云同步、PDF 在线阅读器、曲谱播放、
暗色模式。等实际用一段时间、确认真实需要了再加。
```

- [ ] **Step 2: 写 CLAUDE.md**

`CLAUDE.md`：

```markdown
# 项目约束

个人电吉他学习资料库。纯前端 Next.js 静态导出，无后端、无数据库、无账号。
更完整的背景见 `README.md`，设计与实现文档见 `docs/superpowers/`。
Next.js 版本相关的写法参考脚手架生成的 `AGENTS.md`。

## 硬性约束

- `content/manifest.ts` 是唯一事实来源。目录、筛选、主页数据都从这里读，不得在别处硬编码资料列表
- `content/lessons/*.html` 只写语义标签，以 `<article>` 为根元素。禁止 `<script>`、`<style>`、`<link>`、行内 `style=`、自带导航。样式只写在 `content/content.css` 里
- slug 是小写 kebab-case，且与文件名严格对应
- `inbox/` 与 `archive/` 永不纳入版本库：原始资料体积大且涉及版权
- 页面组件不要用 `LayoutProps<"...">` / `PageProps<"...">` 这类构建后生成的全局类型，`tsc --noEmit` 会失败。显式写 `{ params: Promise<{ slug: string }> }`
- `next.config.ts` 不得开启 `cacheComponents`：会让访问 `params` 的动态路由在预渲染时报错，静态导出失败
- `@types/node` 必须保持 `^24` 以上，`vitest@5` 的 peer 要求

## 改动后的验证

```bash
npm run typecheck && npm test && npm run build
```

`npm test` 会检查清单与正文文件是否一一对应、正文是否符合上述约定。
改了 `content/` 下任何文件后必须跑一遍。

## 内容工作流

1. 原始资料放 `inbox/`
2. 先与使用者确认内容结构（怎么分节、哪里不确定、哪些需要核对），再动笔
3. 生成正文 + 登记清单
4. 浏览器打开实际页面截图确认
5. 原始资料移到 `archive/`

## 需要人工核对的内容

指法、音阶图、和弦图这类「错一个音就练错」的内容必须由使用者核对，不要代为拍板。

## 刻意不做

练习打卡、进度统计、复习提醒、账号与云同步、PDF 阅读器、曲谱播放、暗色模式。
不要主动引入这些功能，除非使用者明确要求。
```

- [ ] **Step 3: 最终验证**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

预期：lint 无错误、typecheck 无输出、测试全部通过、build 成功产出 `out/`。

- [ ] **Step 4: 提交并推送**

```bash
git add -A
git commit -m "docs: 补充使用说明与项目约束

Co-Authored-By: Claude Code <noreply@anthropic.com>"
git push
```
