# Astro 全局迁移实施计划

> **For agentic workers:** 实施前使用 superpowers:subagent-driven-development 或 superpowers:executing-plans；按任务逐项执行并更新 checkbox。每个任务都要有 RED、GREEN 与独立验证。

**Goal:** 将 Next.js 静态 PWA 迁移到 Astro 静态构建，准备 Cloudflare Pages Git integration，同时保留内容约束、PWA、小程序共享代码和 VPS 过渡回退。

**Architecture:** Astro 6 生成 dist/ 静态站，build.format=file、trailingSlash=never；React integration 只水合真正交互的组件。content/manifest.ts 继续生成内容路由。Cloudflare Pages 为 PR 与 main 构建；当前生产域名在单独 DNS 切换前仍使用 VPS。

**Tech Stack:** Astro 6、@astrojs/react、React 19、Tailwind CSS 4、TypeScript、Vitest、Cloudflare Pages。

## Global Constraints

- content/manifest.ts 是练习与资料条目的唯一事实来源。
- content/lessons/*.html 以 <article> 为根，只含语义标签；禁止 script、style、link、行内 style 属性和自带导航。
- slug 使用小写 kebab-case，且与正文文件名严格对应。
- 保持四个顶层入口、/practice/<slug>、旧 /tools/metronome 兼容路径和自定义 404。
- 不改练习内容、TAB/简谱数据、设计令牌、小程序接口和产品刻意不做项。
- 保持静态输出，不加 SSR、Worker API、数据库、账号或云同步。
- Cloudflare Pages 使用 Git integration；PR preview 和 main 构建由 Pages 提供。GitHub Actions 不扩展为 PR CI；手动 VPS workflow 仅作过渡回退。
- 本次不切换生产 DNS/自定义域名。
- 每项生产代码变更遵循 RED → GREEN → REFACTOR；最终运行 npm run typecheck && npm test && npm run build。
- 提交 author 使用 DamonRock <jr.way123@gmail.com>，分支为 agent/lead/astro-migration。

---

## 文件职责

- astro.config.mjs：Astro 静态模式、srcDir=./astro（避开 Next 的 src/pages 路由发现）、React integration、file routes、根目录别名。
- astro/pages/：Astro 路由、manifest endpoint 和 404。
- astro/layouts/BaseLayout.astro：metadata、PWA head、共享壳、CSS 与早期安装捕获脚本。
- astro/components/SiteNav.astro、SiteFooter.astro：基于当前路径静态渲染的导航和页脚。
- astro/styles/global.css：Tailwind v4 入口和现有令牌；content/content.css 保留正文排版。
- components/*.tsx、lib/*.ts：React islands 与共享纯逻辑；不重写音频/乐理/指板实现。
- public/sw.js、public/_headers：离线策略与 Cloudflare 静态缓存头。
- tests/、scripts/verify-static-css.mjs、scripts/verify-astro-output.mjs：框架、PWA、CSS 和构建产物守护。
- Dockerfile、deploy/nginx.conf、scripts/deploy-local.sh、scripts/deploy-remote.sh、.github/workflows/deploy.yml：Astro dist/ 的 VPS 过渡发布。
- README.md、AGENTS.md、CLAUDE.md、DEVELOPMENT.md、部署文档：Astro 与 Pages Git 工作流说明。

## Task 1：安装依赖并确认迁移基线

**Files:** 无源码改动；安装只写入当前隔离 worktree 的 node_modules/。

- [x] Step 1：安装锁文件依赖。Run: npm ci --cache ./.npm-cache --maxsockets=1；仓库 npm cache 权限异常时用该本地缓存，安装完成后删除 .npm-cache/。Expected: exit 0，package-lock.json 无改动。
- [x] Step 2：记录原始基线。Run: npm run typecheck && npm test && npm run build。Expected: 三项成功；若仓库已加入预期 RED 的新迁移测试，应确认其余 40 个测试文件/445 项通过，并单独运行完整 Next build 记录静态路由。

## Task 2：先测试 Astro 配置，再接入工具链

**Files:** Create tests/astro-config.test.ts、astro.config.mjs、astro/env.d.ts；Modify .gitignore、package.json、package-lock.json、tsconfig.json、packages/guitar-core/tsconfig.build.json、miniprogram/tsconfig.json。

- [x] Step 1：在 tests/astro-config.test.ts 先写配置合同。

~~~ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const configPath = root + "/astro.config.mjs";
const pkg = JSON.parse(readFileSync(root + "/package.json", "utf8"));

describe("Astro static configuration", () => {
  it("uses static file routes and React integration", () => {
    expect(existsSync(configPath)).toBe(true);
    if (!existsSync(configPath)) return;
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain('output: "static"');
    expect(config).toContain('srcDir: "./astro"');
    expect(config).toContain('format: "file"');
    expect(config).toContain('trailingSlash: "never"');
    expect(config).toContain("@astrojs/react");
  });

  it("provides Astro dev/build/check scripts", () => {
    expect(pkg.scripts["astro:dev"]).toBe("astro dev");
    expect(pkg.scripts["astro:build"]).toBe("astro build");
    expect(pkg.scripts["astro:check"]).toBe("astro check");
  });
});
~~~

- [x] Step 2：RED。Run: npm test -- tests/astro-config.test.ts。Expected: 缺少 astro.config.mjs、srcDir 与 scripts 的断言失败。
- [x] Step 3：安装兼容当前 React 19 的工具。Run: npm install --save-dev astro@^6.4.8 @astrojs/react@^5.0.7 @astrojs/check --cache ./.npm-cache --maxsockets=1。Astro 与 integration 是 build-time 工具；保留 Next 包直至所有旧 imports/路由已迁完。
- [x] Step 4：写 astro.config.mjs，内容如下。

~~~js
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  srcDir: "./astro",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
  },
});
~~~

- [x] Step 5：新增 astro/env.d.ts，引用 astro/client；tsconfig.json 继承 astro/tsconfigs/strict，保留 strict、@/* 根别名、Node 与小程序类型，删掉 Next plugin/next-env/.next 类型路径。为 CommonJS 输出 target 保持兼容，在 packages/guitar-core/tsconfig.build.json 与 miniprogram/tsconfig.json 覆盖 verbatimModuleSyntax=false；只在会 emit JS 的 guitar-core 配置中设 allowImportingTsExtensions=false。添加 astro:dev、astro:build、astro:check scripts；暂时保留现有 dev/build。
- [x] Step 6：GREEN。Run: npm test -- tests/astro-config.test.ts && npm run astro:check。Expected: Astro 配置测试通过，Next 页面仍能由旧 build 构建。
- [x] Step 7：Commit：feat(astro): add static Astro toolchain。

## Task 3：迁移静态布局、样式和目录页面

**Files:** Create astro/layouts/BaseLayout.astro、astro/components/SiteNav.astro、astro/components/SiteFooter.astro、astro/styles/global.css、astro/pages/index.astro、astro/pages/practice/index.astro、astro/pages/library/index.astro、astro/pages/404.astro、tests/astro-routes.test.ts；Modify tests/design-system.test.ts、tests/install-prompt.test.ts。

- [x] Step 1：先在 tests/astro-routes.test.ts 写失败断言：目标 Astro 路由/布局存在；BaseLayout 包含 lang=zh-CN、manifest href、theme-color、viewport-fit=cover；首页和目录页引用 content/manifest.ts。
- [x] Step 2：RED。Run: npm test -- tests/astro-routes.test.ts。Expected: 页面/布局文件不存在，测试失败。
- [x] Step 3：将 app/globals.css 内容原样移到 astro/styles/global.css；不改 @theme token。BaseLayout 导入全局 CSS 与 content/content.css，输出站点 metadata、PWA metadata、共享外壳和 slot。
- [x] Step 4：将 SiteNav/SiteFooter 转成 Astro 组件；以 Astro.url.pathname 决定当前入口与专注模式，保持移动端 dock、安全区与 aria-current。迁移期间保留原 React 版本供当前 Next fallback 使用，Task 7 移除 Next 时再删除。
- [x] Step 5：移植首页、练习目录、资料目录和 404 的结构；使用 content/manifest.ts、lib/practice.ts、lib/practice-sections.ts；站内导航改为标准 href。
- [x] Step 6：更新设计系统与安装测试的文件路径及扫描目录；设计系统测试在过渡期同时扫描 app 与 astro 的页面类，纳入 .astro 与 astro/styles，直到 Task 7 清除 app/。GREEN。Run: npm test -- tests/astro-routes.test.ts tests/design-system.test.ts tests/install-prompt.test.ts。Expected: 路由、令牌、对比度、安全区、安装捕获脚本合同通过。
- [x] Step 7：Commit：feat(astro): add static site shell and directories。

## Task 4：迁移练习详情与 HTML widget

**Files:** Create astro/pages/practice/[slug].astro；Modify tests/astro-routes.test.ts；Reuse content/manifest.ts、content/lessons/*.html、content/widgets.ts、lib/content-sections.ts、lib/content-headings.ts、lib/sanitize-content.ts、components/LessonWidget.tsx。

- [ ] Step 1：测试首先要求每个 practiceEntries slug 都有匹配 HTML，页面通过 getStaticPaths 枚举 entries，使用 sanitizer/heading ids/section splitter 与 LessonWidget。
- [ ] Step 2：RED。Run: npm test -- tests/astro-routes.test.ts tests/content.test.ts tests/content-sections.test.ts。Expected: Astro detail route 不存在，路由断言失败；原内容一致性测试继续通过。
- [ ] Step 3：在 astro/pages/practice/[slug].astro 以 import.meta.glob("../../../content/lessons/*.html", { eager: true, query: "?raw", import: "default" }) 载入原始 HTML。getStaticPaths 返回每个 entry 的 params.slug 与 props.entry。
- [ ] Step 4：构建期按 slug 读取 HTML，顺序调用 sanitizeContentHtml、addLessonHeadingIds、splitContentSections；prose 使用 set:html 注入清理后的 HTML，widget 使用 LessonWidget 的 React integration，并按页面位置使用 client:visible。
- [ ] Step 5：GREEN。Run: npm test -- tests/astro-routes.test.ts tests/content.test.ts tests/content-sections.test.ts tests/sanitize-content.test.ts && npm run astro:build。Expected: 每个 manifest slug 生成扁平 .html 文件；正文和 widget 顺序正确，未登记 widget/违规 HTML 仍失败。
- [ ] Step 6：Commit：feat(astro): render manifest-driven practice pages。

## Task 5：迁移交互页面与 React islands

**Files:** Create astro/pages/metronome.astro、astro/pages/library/fretboard-scale.astro、astro/pages/tools/metronome.astro；Modify components/Metronome.tsx、components/FretboardScale.tsx、components/PracticeEntryPicker.tsx、tests/pwa.test.ts、tests/install-prompt.test.ts、tests/practice-week-picker.test.ts。

- [ ] Step 1：测试先断言四入口从 Astro SiteNav 输出；metronome/fretboard 路由存在；旧 /tools/metronome 页保留链接和 meta refresh。
- [ ] Step 2：RED。Run: npm test -- tests/pwa.test.ts tests/astro-routes.test.ts。Expected: 新路线和导航文件缺失时失败。
- [ ] Step 3：主节拍器页静态渲染标题、MetronomeGuide；Metronome 使用 client:load，InstallPrompt 使用 client:load。指板页使用 FretboardScale client:load。旧路由保留无需 JS 的兼容页。
- [ ] Step 4：把 Metronome.tsx、FretboardScale.tsx、PracticeEntryPicker.tsx 的 next/link 替换成 a href；保留所有 use client 指令与旧 React SiteNav/SiteFooter，确保共享 Next fallback 在 Task 7 前仍可构建。Astro 的水合由 client:* directive 控制；PracticeEntryPicker 保持 React island，音频和算法 lib 不改。
- [ ] Step 5：GREEN。Run: npm test -- tests/pwa.test.ts tests/astro-routes.test.ts tests/install-prompt.test.ts tests/practice-week-picker.test.ts tests/metronome-a11y.test.ts tests/metronome-keyboard.test.ts tests/fretboard-scale.test.ts。Expected: 组件纯逻辑与键盘/可访问性合同通过。
- [ ] Step 6：Commit：feat(astro): hydrate only interactive practice tools。

## Task 6：迁移 PWA manifest 和 Service Worker

**Files:** Create lib/pwa-manifest.ts、astro/pages/manifest.webmanifest.ts、astro/components/ServiceWorkerRegistration.astro、public/_headers、tests/service-worker.test.ts；Modify public/sw.js、tests/pwa.test.ts、BaseLayout.astro、app/manifest.ts；保留 components/ServiceWorkerRegistration.tsx 至 Task 7。

- [ ] Step 1：先写 PWA 测试：使用 existsSync 断言 lib/pwa-manifest.ts 与 manifest endpoint 将存在，检查 Worker 必需壳仍为 / 与 /metronome、旧路由仍映射，并通过 VM harness 验证含 /_astro/app.js 与 /_astro/site.css 的 shell HTML 会发现两个资源。不要在新模块创建前静态 import 它，避免把 module-not-found 当作预期 RED。
- [ ] Step 2：RED。Run: npm test -- tests/pwa.test.ts tests/service-worker.test.ts。Expected: manifest 路径仍指向 Next，Worker 仍只处理 /_next/static，新增 Astro 资源测试失败。
- [ ] Step 3：将 manifest object 移到 lib/pwa-manifest.ts；静态 endpoint 输出 application/manifest+json；BaseLayout 链接根路径 manifest 与 icons，保留主题色和 Apple metadata。让 app/manifest.ts 继续从 lib/pwa-manifest.ts 返回 Next-compatible metadata route 数据；更新 tests/pwa.test.ts 从共享模块导入数据。
- [ ] Step 4：Worker 的 buildAssets 解析 shell HTML 的 script src 与 stylesheet href，只缓存同源 CSS/JS；fetch cache branch 覆盖 Astro 哈希目录；更新 VERSION。必需壳抓取失败时删除新缓存并抛错，使旧 worker 保持服务。
- [ ] Step 5：将 Astro 的 Service Worker 注册迁到 astro/components/ServiceWorkerRegistration.astro；仅在生产构建注册 /sw.js，监听 window load，保留 scope=/ 与 updateViaCache=none。保留原 components/ServiceWorkerRegistration.tsx 给旧 Next app/layout.tsx，等 Task 7 删除 Next app 后再移除。
- [ ] Step 6：在 public/_headers 为 /sw.js 设置 no-cache/no-store/must-revalidate，为 manifest 设置 no-cache，为 /_astro/* 设置一年 immutable。
- [ ] Step 7：GREEN。Run: npm test -- tests/pwa.test.ts tests/service-worker.test.ts tests/install-prompt.test.ts。Expected: manifest、资源发现、旧路径、注册条件和捕获时序通过。
- [ ] Step 8：Commit：fix(pwa): preserve offline shell on Astro assets。

## Task 7：切换默认 build、移除 Next 并保留 VPS fallback

**Files:** Modify package.json、package-lock.json、tsconfig.json、eslint.config.mjs、scripts/verify-static-css.mjs、Dockerfile、deploy/nginx.conf、scripts/deploy-local.sh、.github/workflows/deploy.yml、components/Metronome.tsx、components/FretboardScale.tsx、components/PracticeEntryPicker.tsx、tests/miniprogram-shell.test.ts、tests/deployment.test.ts；Create scripts/verify-astro-output.mjs；Delete next.config.ts、next-env.d.ts、app/、components/SiteNav.tsx、components/SiteFooter.tsx、components/ServiceWorkerRegistration.tsx。scripts/deploy-remote.sh 保持不变。

- [ ] Step 1：测试先要求 build 为 npm run mini:core && astro build && node scripts/verify-astro-output.mjs，Docker copy dist/，Nginx 处理 /_astro/、sw.js、manifest、file routes 与 404，VPS workflow 仍为手动且不传 --webpack。
- [ ] Step 2：RED。Run: npm test -- tests/miniprogram-shell.test.ts tests/deployment.test.ts。Expected: 当前 package/Docker/Nginx/Workflow 的 Next 字符串使新断言失败。
- [ ] Step 3：添加 scripts/verify-astro-output.mjs：检查 dist/index.html、practice.html、library.html、metronome.html、library/fretboard-scale.html、tools/metronome.html、404.html、manifest.webmanifest、sw.js、icons；检查 dist/practice/*.html 数量等于 content/lessons/*.html 文件数。
- [ ] Step 4：将 build 改为 npm run mini:core && astro build && node scripts/verify-astro-output.mjs；typecheck 加入 astro check、tsc --noEmit、小程序 tsc；dev 改为 astro dev；test 保持 mini:core + vitest。
- [ ] Step 5：CSS verifier 递归读取 dist/_astro/*.css；Dockerfile 拷贝 dist/；Nginx 给 /_astro/ immutable、sw.js no-store、manifest no-cache，并保留 $uri.html 与 404 回退。
- [ ] Step 6：本地与 Actions 的 VPS fallback 移除 next build --webpack，只运行 Astro 的 typecheck/test/build/verify:css；保留 GHCR、SSH、health check、回滚、workflow_dispatch 行为。
- [ ] Step 7：检查 Astro 路由完成后运行 npm uninstall next eslint-config-next，并安装 typescript-eslint、eslint-plugin-react-hooks、eslint-plugin-jsx-a11y；删除 Next 配置、生成类型、旧 app/ 与 Next-only SiteNav/SiteFooter/ServiceWorkerRegistration；从保留的交互组件移除 use client 标记。用 TypeScript、React hooks 与 JSX accessibility 推荐规则重写 eslint.config.mjs。运行 npm install --package-lock-only 与 npm ci 验证锁文件。
- [ ] Step 8：GREEN。Run: npm test -- tests/miniprogram-shell.test.ts tests/deployment.test.ts && npm run typecheck && npm test && npm run build && npm run verify:css && npm run mini:check。Expected: 全部 exit 0，dist 路由检查通过，小程序目录行为不变。
- [ ] Step 9：Commit：build(astro): switch static build and VPS fallback to dist。

## Task 8：Cloudflare Pages Git 文档与仓库规则

**Files:** Create docs/cloudflare-pages.md；Modify README.md、AGENTS.md、CLAUDE.md、DEVELOPMENT.md、docs/deployment.md、docs/deployment-runbook.md、tests/development-docs.test.ts、tests/deployment.test.ts。

- [ ] Step 1：先测试 Pages 文档合同：生产分支 main、PR preview、build command、dist 输出、静态无 adapter、headless/domain 切换边界均有明确记录。更新开发文档测试，保留无 Actions PR CI 和手动 VPS fallback 事实。
- [ ] Step 2：RED。Run: npm test -- tests/deployment.test.ts tests/development-docs.test.ts。Expected: 新 Cloudflare 文档缺失而失败。
- [ ] Step 3：写 docs/cloudflare-pages.md，给出 Pages 创建/连 GitHub、main 生产分支、PR preview、npm run build、dist 输出、部署后静态路由/PWA 检查和 DNS 保持 VPS 的步骤。
- [ ] Step 4：同步 README、AGENTS、CLAUDE、DEVELOPMENT 和部署手册；删除 Next-only rules/命令，明确 Cloudflare Pages Git preview/main build 与手动 VPS 回退关系。
- [ ] Step 5：GREEN。Run: npm test -- tests/deployment.test.ts tests/development-docs.test.ts。Expected: 文档合同通过。
- [ ] Step 6：Commit：docs(cloudflare): document Pages Git deployment path。

## Task 9：端到端构建、浏览器与 PWA 验收

**Files:** 仅修复上面任务发现的迁移问题与测试，不扩展产品范围。

- [ ] Step 1：运行 npm run typecheck && npm test && npm run build && npm run verify:css && npm run mini:check。Expected: 全部 exit 0，Vitest 无 skip/only，dist 包含所有公开路径和 PWA 资源。
- [ ] Step 2：检查构建产物：主入口、manifest 驱动的详情文件、library/fretboard-scale、tools/metronome、404、manifest、sw、icons、Astro CSS/JS 全部存在。
- [ ] Step 3：运行本地静态预览，检查首页、四入口、全部练习、资料库、指板、节拍器、旧路径和 404；确认手机布局、样式、链接与浏览器 console 无错误。
- [ ] Step 4：通过 HTTPS 浏览器验证安装提示、manifest、SW 安装与 Astro 资源缓存；离线启动首页/节拍器/旧路由；实际播放验证节拍器音频、TAB 播放头、指板选择与返回链接。
- [ ] Step 5：当 Cloudflare Pages Git project 已连接时检查 PR preview 的 clean URLs、404、资源 MIME 与缓存头；若项目尚未连接，只交付控制台配置步骤，并明确标记未实测，不声称部署通过。
- [ ] Step 6：确认当前 VPS 域名路径仍可手动发布/回退；列出后续 Cloudflare custom domain/DNS cutover 检查项，不修改 DNS。
- [ ] Step 7：最终复查 git diff、git status、提交 author 和分支；回复列出变更、验证命令与任何等待外部 Pages 连接的检查。
