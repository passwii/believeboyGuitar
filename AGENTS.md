> **重要：每次启动先把本地代码更新到最新。** 开工前先读 [DEVELOPMENT.md](./DEVELOPMENT.md) 的同步步骤和冲突处理规则。

## 项目约束

这是一个个人电吉他学习资料库（Astro 静态站 + 微信小程序）。完整约束见 [CLAUDE.md](./CLAUDE.md)，先读它再动手。
开发流程（每次启动先同步代码、Git 与提交规范、验证方式、交付自检）见 [DEVELOPMENT.md](./DEVELOPMENT.md)。
最要紧的四条：

- `content/manifest.ts` 是唯一事实来源：目录、筛选、主页数据都从这里读，不得在别处硬编码资料列表。
- `content/lessons/*.html` 只写语义标签，以 `<article>` 为根元素，禁止 `<script>`、`<style>`、`<link>`、行内 `style=`。需要指板图这类交互内容时，写 `<lesson-widget name="…"></lesson-widget>` 占位标记。
- 曲谱的记谱法只做简谱，不做五线谱。此前也没有做过五线谱：第 1 周曲谱的原书是「五线谱 + TAB」双行谱，页面只保留了 TAB（`content/lessons/week-1-finger-independence.html`）。曲谱相关的新功能都按这个前提设计。
- 改完跑 `npm run typecheck && npm test && npm run build`。
