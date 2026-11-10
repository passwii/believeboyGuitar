# Astro 全局迁移设计

- 状态：已由用户确认（2026-11-10）
- 工作分支：agent/lead/astro-migration
- 目标宿主：Cloudflare Pages，Git integration

## 目标

将电吉他练习站从 Next.js App Router 静态导出迁移到 Astro 静态架构，并为 Cloudflare Pages Git integration 准备仓库构建与预览支持。继续支持当前 VPS 静态发布，直到 Cloudflare 构建和页面行为验证完成；DNS 与自定义域名切换属于独立发布阶段。

## 当前结构与动因

站点没有请求期服务端功能：Next.js 只负责静态导出；目录、页面数据、HTML 练习正文、音频逻辑和微信小程序构建都在仓库本地完成。Astro 的价值在于把公共页面壳与正文生成为静态 HTML，只为需要交互的组件加载 React。

Cloudflare Pages Git integration 会为 PR 创建预览部署，并从生产分支构建 Pages production deployment。该自动流程是本次选定的目标发布模式；它取代“Cloudflare 生产也必须由本地手动上传”的假设。现有 VPS 发布继续作为域名切换前的运行路径与回退能力。

## 架构决策

### 1. 静态 Astro，不启用服务端渲染

- 使用 Astro 6，output 为 static。
- 使用 build.format 为 file、trailingSlash 为 never，让构建文件保持 practice.html、practice/<slug>.html 这种扁平映射；Cloudflare Pages 以干净 URL 提供页面，并在预览中验证 URL 与重定向行为。
- Cloudflare Pages 构建命令为 npm run build，输出目录为 dist/。
- 不加入 @astrojs/cloudflare SSR adapter，不新增 Worker、Pages Functions、D1、KV 或 API 路由。只有产品未来出现请求期逻辑时才重新评估运行时。

### 2. 路由与页面映射

| URL | Astro 页面 | 行为 |
| --- | --- | --- |
| / | src/pages/index.astro | 当前周练习首页 |
| /practice | src/pages/practice/index.astro | 练习目录 |
| /practice/<slug> | src/pages/practice/[slug].astro | 从目录生成静态练习详情 |
| /library | src/pages/library/index.astro | 资料目录 |
| /library/fretboard-scale | src/pages/library/fretboard-scale.astro | 指板音阶交互页 |
| /metronome | src/pages/metronome.astro | 主节拍器页 |
| /tools/metronome | src/pages/tools/metronome.astro | 保留静态兼容页与离线回退语义 |
| 未匹配 URL | src/pages/404.astro | 中文 404 页面，生成 404.html |
| /manifest.webmanifest | src/pages/manifest.webmanifest.ts | 生成 PWA JSON manifest |

路径、导航、metadata 与 404 输出必须在 Cloudflare Pages 预览中检查。兼容路径不能只依赖在线 HTTP redirect，因为已安装 PWA 的 Service Worker 还要离线映射 /tools/metronome。

### 3. 目录、正文和 widget 契约

- content/manifest.ts 继续作为练习与资料条目的唯一事实来源；页面不复制目录数组。
- content/lessons/*.html 保持现状：以 article 为根，只写语义标签，不改成 MDX，不在本次迁移中改写练习内容。
- 练习详情通过 getStaticPaths() 从 practiceEntries 生成 slug 路由；HTML 在构建阶段作为原始文本加载。
- 继续复用 sanitizeContentHtml、addLessonHeadingIds、splitContentSections 和 content/widgets.ts。未登记的 lesson-widget 名称仍须让内容测试或构建失败。
- 正文中的 widget marker 由 React LessonWidget 注册表渲染；每个交互根组件成为显式 React island。

### 4. Astro 静态壳与 React islands

- Astro 布局负责 html lang、metadata、PWA link/meta、导航、页脚和 CSS 入口。
- SiteNav 与 SiteFooter 只依赖当前路径，应改为 Astro 静态组件，由布局路径决定高亮和专注模式，不发送 React 水合脚本。
- 保留成熟的 React 组件与纯逻辑模块。迁移 next/link 为普通站内链接，并移除组件对 next/navigation 的引用。
- 节拍器和指板是首屏主交互，按页面使用 client:load。练习正文 widget 根据首屏位置选择 client:visible；条目选择器与安装提示在用户可立即操作的页面使用及时水合。
- hydration directive 只加在真正需要浏览器事件/状态的 React 根组件上；只做静态渲染的图标可继续通过 React SSR 输出或改为 Astro markup，不建立全站 React root。

### 5. PWA 与缓存

- /manifest.webmanifest 保持 id、start_url、scope、图标、快捷入口和当前主题色；图标仍放在 public/icons/。
- 保留 head 中最先运行的 beforeinstallprompt 捕获脚本，确保它在其他延迟脚本与 React 水合前执行。
- /sw.js 的必需壳仍是 / 与 /metronome；manifest 和图标仍作为可选壳。
- 移除 Service Worker 对 /_next/static/ 的假设。构建壳页面时从 script/link URL 收集 Astro build 实际生成的同源 CSS/JS 资源；运行期按 Astro 哈希资源路径缓存。壳资源缺失仍让新 Worker 安装失败，保留旧 Worker 的缓存回退保障。
- 更新 Service Worker cache version；保留在线导航 network-first、静态构建资源 cache-first、图标与 manifest stale-while-revalidate，以及旧节拍器地址离线映射。
- Pages 的 _headers 保留 /sw.js 与 manifest 的重新验证策略，并让不可变构建资源长期缓存。发布后确认 Cloudflare 输出的 Content-Type 与缓存头。

### 6. Tailwind 与共享小程序构建

- 保留 Tailwind v4、@theme 设计令牌、content/content.css 和现有组件样式；不做视觉重设计。
- 将 CSS 入口接到 Astro/Vite，并确保 Tailwind 扫描 src/**/*.astro、React .tsx 以及 content/lessons/*.html 中使用的 utility class。
- 将静态 CSS 验证脚本改为检查 dist/ 的实际输出，继续拒绝未处理的 Tailwind 指令和缺失的核心 selector。
- packages/guitar-core、miniprogram/ 与 mini:core 构建保持独立可用。web 框架迁移不得改变小程序生成文件和运行行为。

### 7. Cloudflare Git 部署与过渡发布

- Cloudflare Pages 项目使用 GitHub 仓库集成，生产分支为 main，PR 部署为 preview；生产构建运行 npm run build，输出 dist/。
- Pages 的 Git integration 配置在 Cloudflare 项目设置中完成；仓库交付包括构建脚本、必要的 _headers、分支/预览说明和检查步骤。
- 更新 README.md、AGENTS.md、CLAUDE.md、DEVELOPMENT.md 与部署文档，准确说明 Astro、Pages Git 部署和过渡期间的 VPS 回退；删除 AGENTS.md 中由 next dev 注入的 Next.js 专属规则。GitHub Actions 不扩展为 PR CI；现有 workflow_dispatch VPS 备用流程保持手动，直到域名切换完成。
- Astro 产物作为 VPS 过渡部署的输入：Docker/Nginx 路径从 Next out/ 与 /_next/ 调整为 Astro dist/ 与对应资源路径。当前域名继续指向 VPS，直到用户另行安排 Cloudflare 自定义域名/DNS 切换。
- 本次不创建或修改 Cloudflare 账户、Pages 项目、DNS 记录或 GitHub 仓库外部授权；先交付可构建、可预览的仓库配置和操作文档。

## 测试与验收

1. npm run typecheck、npm test 与 npm run build 全部通过；mini:core 与小程序类型检查保持通过。
2. Astro build 输出首页、目录页、每个 manifest 详情页、指板页、节拍器页、兼容路由、404.html、manifest、Service Worker、图标与 CSS/JS 资源。
3. 内容检查确认 manifest 与 content/lessons/*.html 一一对应，widget 名称登记和语义 HTML 限制仍生效。
4. 更新/新增测试覆盖 PWA manifest、服务 Worker 必需/可选壳、Astro 资源发现、兼容路由、CSS 产物和部署目标。
5. Cloudflare Pages PR preview 验证全部公开 URL、干净 URL、404、metadata、样式、图标、manifest 与资源 MIME/cache headers。
6. 桌面与手机浏览器验证节拍器声音、后台/唤醒行为、指板交互、TAB 播放头、安装提示；安装后断网验证首页、节拍器和 /tools/metronome 回退。
7. DNS 未切换前，当前 VPS 域名继续通过人工发布路径可回退；Cloudflare 自定义域名切换需要单独验收。

## 主要风险与处理

- **Service Worker 资源路径：**更新资源发现和测试，先在 Pages preview 验证新 Worker 完整安装，再允许其删除旧缓存。
- **静态路由映射：**build.format 为 file 对齐现有无斜杠 URL 与 Nginx try_files，仍需用 Pages preview 覆盖主路由和尾斜杠变体。
- **head 脚本时序：**保持安装事件捕获内联且早于水合，并在手机 Safari/Chromium 上验证。
- **Cloudflare 项目外部设置：**GitHub 连接、Pages 生产分支、预览设置与域名都不是仓库文件；配置步骤写入部署手册，外部账户变更另行执行。
- **Tailwind 扫描：**迁移后检查 .astro 与 HTML 文件 class 是否仍进入输出 CSS，并保留自动 CSS 守护。

## 明确不做

- 不加入 Astro SSR、Worker/API、数据库、账号、同步、进度统计或暗色模式。
- 不改变练习正文、TAB/简谱数据和既有界面设计。
- 不在这次迁移中切换生产 DNS 或移除 VPS 回退路径。
