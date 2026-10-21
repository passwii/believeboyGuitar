# Studio Field Notes 视觉实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有静态资料库架构内实现 `DESIGN.md` 已确认的「琴房边桌 / Studio Field Notes」视觉与交互契约。

**Architecture:** 保留 App Router、`content/manifest.ts` 单一事实来源、HTML 语义正文和 widget 注册表。主题令牌集中在 `app/globals.css`，页面外壳与列表组件按层次调整，长文目录从经过现有清理流程的 H2 派生，不新增 manifest 字段或第三方依赖。

**Tech Stack:** Next.js 16.4.1、React 19.3、Tailwind CSS 4、TypeScript、Vitest；不增加依赖。

## Global Constraints

- `content/manifest.ts` 是首页、目录和筛选的唯一资料来源；本计划不改资料 schema。
- `content/lessons/*.html` 以 `<article>` 为根，只写语义标签；禁止脚本、样式、链接标签、自带导航和行内 `style=`。
- 交互正文继续通过 `content/widgets.ts` 登记和 `<lesson-widget>` 占位符接入。
- 不增加账号、云同步、全文搜索、打卡、进度、提醒、暗色模式、PDF 阅读器、曲谱播放或 CI。
- 开始改代码前先读 `node_modules/next/dist/docs/` 中与当前任务相关的 Next 16 CSS、布局和静态路由指南；遵守仓库 `AGENTS.md` 与 `CLAUDE.md`。
- 保留当前工作区中已存在的用户修改；不回滚或覆盖 `content/manifest.ts`、手册 HTML、截图和 `.playwright-mcp/`。`content/content.css` 属于本计划目标文件，修改时必须在现有窄屏表格横向滚动规则之上增量调整。
- 最终运行 `npm run typecheck && npm test && npm run build`。若默认 Turbopack 仍因本机 `Operation not permitted` 绑定本地端口而失败，保留该事实并用 `npm run build -- --webpack` 做补充构建验证；不为绕过环境问题擅改 Next 配置。

---

## 文件职责图

| 文件 | 负责内容 |
|---|---|
| `app/globals.css` | 全站色彩、字体、页面底色和通用焦点样式 |
| `app/layout.tsx`、`components/SiteNav.tsx` | 全站导航、版心和安静的页脚 |
| `app/page.tsx` | 清单驱动的首页目标与近期资料 |
| `app/library/page.tsx`、`components/LibraryBrowser.tsx` | 目录说明、搜索、筛选、结果数量和空结果状态 |
| `components/LessonCard.tsx`、`components/EmptyLibrary.tsx` | 纵向资料条目与空库状态 |
| `app/library/[slug]/page.tsx`、`components/LessonTableOfContents.tsx` | 资料详情、响应式 H2 目录和来源信息 |
| `lib/content-toc.ts`、`tests/content-toc.test.ts` | H2 标题文本、稳定锚点及显示阈值的纯函数与单测 |
| `content/content.css` | 正文行长、标题层级、表格、引用与链接排版 |
| `components/ThreeNotesPerString.tsx`、`components/Fretboard.tsx` | 指板 widget 的局部工具视觉、颜色对比和原生控件可访问性 |

## 任务 1：主题令牌与全站外壳

**文件：** `app/globals.css`、`app/layout.tsx`、`components/SiteNav.tsx`

- [ ] 先阅读 Next 16 文档中 CSS 导入、Root Layout 和字体配置章节；只使用当前项目可用写法，不引入网络字体。
- [ ] 在 `@theme` 中建立批准的暖白、墨色、锈橙、控件边界及字体令牌；旧 utility 被组件使用时保留其语义映射，避免本任务顺手进行全站无关重命名。核心值如下：

```css
--color-canvas: #F4F1E9;
--color-surface: #FBFAF6;
--color-surface-muted: #EFECE4;
--color-ink-950: #262820;
--color-ink-700: #68675F;
--color-ink-500: #68675F;
--color-ink-400: #6C6A62;
--color-ink-300: #B5B1A7;
--color-ink-200: #D8D3C8;
--color-ink-100: #EFECE4;
--color-ink-50: #F4F1E9;
--color-control-edge: #6C6A62;
--color-accent-700: #AD462E;
--color-accent-600: #AD462E;
--color-accent-100: #F1E1D9;
--color-accent-50: #F7EEE9;
--color-board-800: oklch(0.32 0.018 58);
--color-board-900: oklch(0.24 0.016 58);
--color-board-label: #D4CFC5;
--font-display: Georgia, "Songti SC", "STSong", "Noto Serif CJK SC", serif;
--font-sans: "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif;
--font-mono: "SFMono-Regular", "Cascadia Code", Consolas, monospace;
```

- [ ] 增加 `--font-display`（Georgia / Songti SC 衬线回退）和本机中文无衬线、等宽字体栈；`body` 使用暖白画布和墨色，正文基准 16px。
- [ ] 为 `:focus-visible` 增加高对比焦点轮廓；设置 120–180ms 的常规状态切换约定，并在 `prefers-reduced-motion: reduce` 下关闭非必要动效。
- [ ] 把导航版心扩至约 1120px，使用暖白背景和细分隔线；导航文案统一为「首页」「资料库」，保留现有两条路由。
- [ ] 页脚沿用现有说明，和页面共用版心，不增加统计或次级目录。
- [ ] 检查颜色令牌：普通文字对比度至少 4.5:1；装饰分隔线不用于控件边界；控件边界用 `--color-control-edge`，焦点轮廓用强调色。
- [ ] 运行 `npm run typecheck` 和 `npm run build -- --webpack`；在浏览器检查导航、页脚的桌面与窄屏横向溢出。

## 任务 2：首页、目录与资料条目

**文件：** `app/page.tsx`、`app/library/page.tsx`、`components/LibraryBrowser.tsx`、`components/LessonCard.tsx`、`components/EmptyLibrary.tsx`

- [ ] 保持首页的目标数据来自 `home.goals`、近期资料由 `recentLessons(lessons, 4)` 生成；不新增最近浏览或继续学习状态。
- [ ] 把首页目标改为轻量编辑式区块，近期资料改成有分隔线的纵向条目；首页仍提供明确的完整资料库入口。
- [ ] 页面级 `h1` 使用 `font-display`，中文正文仍使用无衬线字体栈。
- [ ] 把 `LessonCard` 的外观从等尺寸卡片改为纵向资料条目；保留标题、简介、阶段、难度和主题，不改变链接 slug。
- [ ] 目录继续使用 `LibraryBrowser` 的现有筛选逻辑：搜索标题、简介、主题、标签；筛选主题、阶段、难度；保留结果数量与清除筛选。
- [ ] 搜索框提示明确显示「搜索标题、简介、主题、标签」；筛选按钮保持 `aria-pressed`，用形状／边框与状态语义共同区分选中态，触控区域目标约 44px。
- [ ] 空库和无匹配结果统一为简短、可执行的文字状态，不使用虚线框或虚构推荐；保留空库已有的内容归档提示。
- [ ] 不改 `lib/lessons.ts` 的搜索范围、排序或筛选关系；运行 `npm test` 确认现有 45 项内容与筛选测试不回归。
- [ ] 浏览器检查首页和目录桌面／手机布局，重点确认筛选换行、结果密度、长标题换行和清除筛选入口。

## 任务 3：详情页、正文排版与 H2 目录

**文件：** 新建 `lib/content-toc.ts`、新建 `tests/content-toc.test.ts`、新建 `components/LessonTableOfContents.tsx`；修改 `app/library/[slug]/page.tsx`、`content/content.css`

- [ ] 先为纯函数写失败测试，再运行 `npx vitest run tests/content-toc.test.ts` 确认失败。目标接口固定为：

```ts
export type LessonHeading = { id: string; title: string };

export function addLessonHeadingIds(html: string): {
  html: string;
  headings: LessonHeading[];
};

export function shouldShowLessonToc(headings: LessonHeading[]): boolean;
```

- [ ] 新建测试文件并先放入这些边界测试；预期首次运行因 helper 尚未实现而失败：

```ts
import { describe, expect, it } from "vitest";
import { addLessonHeadingIds, shouldShowLessonToc } from "@/lib/content-toc";

describe("addLessonHeadingIds", () => {
  it("为 H2 添加稳定锚点并提取纯文本标题", () => {
    const result = addLessonHeadingIds(
      "<article><h2>1. 基础 <code>FX</code></h2><p>正文</p></article>",
    );
    expect(result.headings).toEqual([
      { id: "lesson-heading-1", title: "1. 基础 FX" },
    ]);
    expect(result.html).toContain('<h2 id="lesson-heading-1">');
    expect(result.html).toContain("<p>正文</p>");
  });

  it("没有 H2 时返回空目录", () => {
    expect(addLessonHeadingIds("<article><p>正文</p></article>").headings).toEqual([]);
  });

  it("重复标题仍获得不同锚点，并保留 widget 标记", () => {
    const result = addLessonHeadingIds(
      '<article><h2>重复</h2><lesson-widget name="c-major-three-notes-per-string"></lesson-widget><h2>重复</h2></article>',
    );
    expect(result.headings.map(({ id }) => id)).toEqual([
      "lesson-heading-1",
      "lesson-heading-2",
    ]);
    expect(result.html).toContain(
      '<lesson-widget name="c-major-three-notes-per-string"></lesson-widget>',
    );
  });
});

describe("shouldShowLessonToc", () => {
  it("仅当 H2 数量达到 6 个时显示", () => {
    const headings = Array.from({ length: 6 }, (_, index) => ({
      id: `lesson-heading-${index + 1}`,
      title: `章节 ${index + 1}`,
    }));
    expect(shouldShowLessonToc(headings.slice(0, 5))).toBe(false);
    expect(shouldShowLessonToc(headings)).toBe(true);
  });
});
```

- [ ] 运行 `npx vitest run tests/content-toc.test.ts`，确认新增用例通过。
- [ ] 实现时只处理已由 `sanitizeContentHtml` 清理过的仓库内容；用 `lesson-heading-1`、`lesson-heading-2` 形式生成锚点，不依赖中文 slug，不把此 helper 描述为通用 HTML parser 或 sanitizer。
- [ ] 在详情页按以下顺序处理：读取文件 → `sanitizeContentHtml` → `addLessonHeadingIds` → `splitContentSections`；只在 `shouldShowLessonToc(headings)` 为真时渲染目录。
- [ ] 新建目录组件：桌面端作为阅读列旁的 `<nav aria-label="本文目录">`；窄屏放在正文前的 `<details><summary>本文目录</summary>…</details>` 中；所有目录链接指向生成的 H2 id。
- [ ] 详情页桌面端采用侧栏目录与正文列并排，正文列宽约 `42em`；手机端单列。标题、摘要、已有元数据、正文、来源与标签的顺序保持不变。
- [ ] `content/content.css` 将正文行高保持在至少 `1.8`，建立清晰的 h2/h3 阶梯，补齐正文链接、图片说明与引用样式；窄屏表格保留横向滚动，页面本身不得溢出。
- [ ] 不做 CSS 自动标题编号；Pocket AMP 手册的标题编号继续由内容本身负责。
- [ ] 运行新增单测、`npm run typecheck` 和 `npm test`；浏览器检查 4 个 H2 的指板资料与 15 个 H2 的 Pocket AMP 手册，以及移动端目录折叠和表格滚动。

## 任务 4：指板 widget 与交互可读性

**文件：** `components/ThreeNotesPerString.tsx`、`components/Fretboard.tsx`

- [ ] 将 widget 外壳从大圆角阴影卡改为轻边界的工具区；在整个 widget 内保留深色指板画布，使音位、品丝与弦号仍清楚可辨。
- [ ] 将根音和关键操作映射到锈橙；浅强调底使用墨色文字；表格、标签和规格沿用全站间距及边界，不另造主题色。
- [ ] 将浅底上的 `text-ink-300` 改为达到对比度目标的文字令牌；深色指板中的弦号／品号改用专用 `board-label` 令牌，避免同一灰色在浅底和深底间复用。
- [ ] 保留原有音位推导、筛选、音名／级数切换和同名音指针高亮逻辑；不改 `lib/guitar.ts` 的音位数据或公式。
- [ ] 确保音名／级数切换、把位按钮和速查表按钮可通过键盘操作，选中状态继续暴露 `aria-pressed`，焦点可见；指板 SVG 保留清楚的 `role="img"` 和 `aria-label`。
- [ ] 在浏览器检查 C 大调指板根音、其他音级、变暗音位、把位切换以及表格窄屏横向滚动；人工逐项核对音位未变化。

## 任务 5：端到端视觉验收与最终验证

**文件：** 如发现问题，仅修改上述已列出的目标文件；截图保存到 `/private/tmp/studio-field-notes/`，不覆盖仓库现有截图。

- [ ] 在 1440×900 桌面和 390×844 手机视口检查 `/`、`/library`、`/library/c-major-three-notes-per-string`、`/library/pocket-amp-sk17-guide`。
- [ ] 键盘走查：导航链接、搜索框、所有筛选、清除筛选、页内目录、widget 模式按钮和把位按钮均有可见焦点且可操作。
- [ ] 视觉走查：无卡片墙、无图纸网格／假图号／纸纹、无暗色主题；标题和正文层级清楚；搜索提示与实际字段一致；长文目录只在 H2 至少 6 个时显示。
- [ ] 检查工作区差异，确保本轮没有修改 `content/manifest.ts` 或 `content/lessons/*.html`，也没有把用户现有截图和 `.playwright-mcp/` 文件加入提交。
- [ ] 运行 `npm run typecheck && npm test && npm run build`。当前默认构建已观察到 Turbopack 在沙箱中因绑定本地端口失败；如复现，按权限流程重试，并用 `npm run build -- --webpack` 记录补充结果，不改 `next.config.ts` 绕过。
- [ ] 仅在验证通过后，按中文提交标题分批提交本轮实际修改的文件；不提交本计划以外的工作区基线文件。
