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
| --- | --- |
| `content/manifest.ts` | 唯一事实来源：全部资料的元数据与主页目标 |
| `content/lessons/*.html` | 每篇正文，只写语义标签，不带样式 |
| `content/content.css` | 内容区排版样式 |
| `content/widgets.ts` | 正文可嵌入的交互组件名清单 |
| `app/` | 页面外壳：主页、资料库、内容页、工具页 |
| `components/` | 导航、卡片、筛选、空状态、指板图等组件 |
| `lib/` | 纯函数：音位推导、查询筛选、一致性校验 |
| `inbox/` | 原始资料投放处（不纳入版本库） |
| `archive/` | 整理完成后的原始资料归档（不纳入版本库） |
| `research/` | 调研资料：抓取的来源正文与报告（不纳入版本库） |

## 新增一篇资料
1. 把原始资料放进 `inbox/`
2. 先确认内容结构：怎么分节、哪些不确定、哪些结论需要核对
3. 生成 `content/lessons/<slug>.html`，并在 `content/manifest.ts` 登记一条记录
4. 浏览器打开实际页面，确认排版正常、内容没走样
5. 原始资料移到 `archive/`
6. 运行 `npm test` 与 `npm run build`

## 资料与工具页的区别

| | 资料 | 工具页 |
| --- | --- | --- |
| 位置 | `content/lessons/*.html` + `content/manifest.ts` | `app/<route>/page.tsx` |
| 登记 | 登记进 manifest | 不登记 |
| 导航 | 从资料库进 | 从首页的「工具」区块进 |
| 例子 | 《C 大调一弦三音系统》 | /chords、/rhythms、/cheatsheet |

工具页是拿来用的（查指法、排练习、划节奏），不是读的资料。
它们的音位与参数全部由 `lib/` 下的纯函数推导，页面里不写死常量。

## 内容约定

正文文件只写语义标签（`article`、`h2`、`h3`、`p`、`ul`、`ol`、`li`、`strong`、
`code`、`table`、`blockquote`），以 `<article>` 为根元素：

- 不写 `<script>`、`<style>`、`<link>`
- 不写行内 `style=` 属性
- 不写自带导航

样式全部由 `content/content.css` 统一提供。这些约定由 `npm test` 强制检查——
清单与文件脱节、正文违反约定都会让测试失败；渲染前 `lib/sanitize-content.ts`
还会再清一遍，不把安全性只押在「作者会守规矩」上。

## 指板图这类交互内容

音阶图、和弦图这类光靠文字说不清的内容，正文里只写一个占位标记：

```html
<lesson-widget name="c-major-three-notes-per-string"></lesson-widget>
```

标记放在哪，组件就渲染在哪。加一个新组件的步骤：

1. 在 `content/widgets.ts` 的 `WIDGET_NAMES` 里登记名字
2. 在 `components/LessonWidget.tsx` 的 `WIDGETS` 表里接上实现
3. 在正文里写上标记

名字写错会在 `npm test` 和构建时报错。正文依然只有语义标签，不带样式也不带脚本。

### 可复用的六线谱组件

`components/TabStaff.tsx` 只负责画 TAB：六线、品位、指法、符杠、三连音、
重音、拨片方向、空拨、延音、击弦与把位移位标记都由 `TabMeasure` / `TabNote`
数据驱动。谱面数据与类型在 `lib/tab.ts`，音符较密时会按密度自动加宽小节，
不做字号缩到看不清的处理。

新的曲谱页面可以直接传入 `TabMeasure` 数据复用它；`components/WeekOneTabDrill.tsx`
与 `components/WeekTwoTabDrill.tsx` 只是各周计划的内容外壳，负责标题、速度、
练习提示和每日分组。

## 人工核对

改写是结构重组与语言重写，不是逐字翻译。涉及**指法、音阶图、和弦图**这类
错一个音就会练错的内容，必须逐条核对原始资料后再采用。

## 第一版不做什么

练习打卡、进度统计、复习提醒、账号与云同步、PDF 在线阅读器、曲谱播放、
暗色模式。等实际用一段时间、确认真实需要了再加。
