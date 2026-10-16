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

## 交互组件怎么进正文

正文里只写占位标记 `<lesson-widget name="…"></lesson-widget>`，组件名登记在
`content/widgets.ts`，实现在 `components/LessonWidget.tsx` 的注册表里。
名字写错会在 `npm test` 与构建时报错。

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
音位这类可以由乐理推导的东西，写成从调弦与音阶算出来的代码，而不是手抄常量。

## 刻意不做

练习打卡、进度统计、复习提醒、账号与云同步、PDF 阅读器、曲谱播放、暗色模式。
不要主动引入这些功能，除非使用者明确要求。

**也不做 CI（GitHub Actions 等）。** 这是个人自用仓库，验证全部在本地手工跑：
`npm run typecheck && npm test && npm run build`。不要主动添加 `.github/workflows/`
或任何其他 CI 配置，也不要因为「缺少自动化守护」而建议加上。
