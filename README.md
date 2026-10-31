# 电吉他练习站

个人使用的手机优先电吉他练习 PWA。站点只保留四个入口：

| 入口 | 路由 | 作用 |
| --- | --- | --- |
| 首页 | `/` | 当前训练周与快捷入口 |
| 练习 | `/practice` | 周练中心与每周 TAB |
| 资料库 | `/library` | 极简资料列表与指板音阶 |
| 节拍器 | `/metronome` | 手机单屏节拍器 |

## 技术结构

- Next.js App Router，纯静态导出。
- `content/manifest.ts` 是周练与资料目录的唯一事实来源。
- 周练正文位于 `content/lessons/*.html`，只写语义标签，不带样式或脚本。
- 交互组件通过 `<lesson-widget name="…">` 嵌入正文。
- 音位与节奏数据由 `lib/` 下的纯函数生成或校验。
- 样式入口是 `app/globals.css`（界面）和 `content/content.css`（正文）。

## 常用命令

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
```

开发流程、提交规范与交付检查见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 内容约定

- 正文以 `<article>` 为根元素。
- 禁止 `<script>`、`<style>`、`<link>`、行内 `style=` 与自带导航。
- 指法、把位和音阶位置属于高风险内容，必须按实琴核对。
- 新增周练时只更新 `content/manifest.ts` 和对应的正文文件。

## 微信小程序

`miniprogram/` 是独立的微信原生小程序，只包含节拍器与调音器。

```bash
npm run mini:core
npm run mini:check
```

用微信开发者工具打开 `miniprogram/`。本地测试可使用 `touristappid`，
发布前在开发者工具中填入正式 AppID。
