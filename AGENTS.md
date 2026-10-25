<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> **重要：每次启动先把本地代码更新到最新。** 开工前先读 [DEVELOPMENT.md](./DEVELOPMENT.md) 的同步步骤和冲突处理规则。

## 项目约束

这是一个个人电吉他学习资料库。完整约束见 [CLAUDE.md](./CLAUDE.md)，先读它再动手。
开发流程（每次启动先同步代码、Git 与提交规范、验证方式、交付自检）见 [DEVELOPMENT.md](./DEVELOPMENT.md)。
最要紧的三条：

- `content/manifest.ts` 是唯一事实来源：目录、筛选、主页数据都从这里读，不得在别处硬编码资料列表。
- `content/lessons/*.html` 只写语义标签，以 `<article>` 为根元素，禁止 `<script>`、`<style>`、`<link>`、行内 `style=`。需要指板图这类交互内容时，写 `<lesson-widget name="…"></lesson-widget>` 占位标记。
- 改完跑 `npm run typecheck && npm test && npm run build`。
