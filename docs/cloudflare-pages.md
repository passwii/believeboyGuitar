# Cloudflare Pages 发布

本仓库的网站是 Astro 静态站（`output: "static"`），产物在 `dist/`，没有 Worker、Pages Functions、
数据库或账号。Cloudflare Pages 只是静态托管，不需要 `@astrojs/cloudflare` 适配器。

生产域名当前仍指向 VPS（见 [deployment.md](./deployment.md)）。Pages 是目标宿主，域名切换是独立
发布步骤，见本文末「切换顺序」。

## 1. 项目设置

在 Cloudflare 控制台 **Workers & Pages → Create → Pages → Connect to Git**：

| 项 | 值 |
| --- | --- |
| 仓库 | `passwii/believeboyGuitar` |
| 生产分支 | `main` |
| 框架预设 | Astro |
| 构建命令 | `npm run build` |
| 构建输出目录 | `dist` |
| 根目录 | 仓库根（不要填子目录） |
| Node 版本 | 22 或更高（`NODE_VERSION=22`，Astro 6 要求 `>=22.12.0`） |

`npm run build` 会先编译 `packages/guitar-core`，再 `astro build`，最后用
`scripts/verify-astro-output.mjs` 校验产物；任何一步失败都会让 Pages 构建失败，不会发布半成品。

预览部署：Git 集成默认给每个分支/PR 生成预览地址。预览用的是同一份构建命令，可用于验收页面、
PWA 与缓存头。

> 已选 Git 集成后不能再把项目改成 Direct Upload，反之亦然。这里刻意选择 Git 集成，让 `main` 推送
> 即触发生产构建。

## 2. 静态路由与缓存

`astro.config.mjs` 使用：

- `build.format: "file"` → `practice.html`、`practice/<slug>.html`
- `trailingSlash: "never"` → 无斜杠 URL

Cloudflare Pages 会把 `foo.html` 作为 `/foo` 提供，与现有 VPS Nginx 的 `$uri → $uri.html → $uri/`
顺序一致。发布后必须逐个确认：

- `/`、`/practice`、`/library`、`/metronome`
- 每个 `/practice/<slug>`（由 `content/manifest.ts` 生成）
- `/library/fretboard-scale`
- `/tools/metronome`（旧地址兼容页，含 meta refresh，必须能离线使用）
- 不存在的地址返回 `404.html`，不要被当成 SPA 回落到首页

缓存头来自构建产物根目录的 `public/_headers`（会复制到 `dist/_headers`）：

```text
/sw.js                 Cache-Control: no-cache, no-store, must-revalidate
/manifest.webmanifest  Cache-Control: no-cache
/_astro/*              Cache-Control: public, max-age=31536000, immutable
```

发布后确认 `/sw.js` 与 `/manifest.webmanifest` 未被长缓存，`/_astro/*` 带 `immutable`。

## 3. PWA 验收

Service Worker 的必需壳是 `/` 与 `/metronome`。安装时会解析 shell HTML 里的
`script src`、`link href` 以及 `astro-island` 的 `component-url` / `renderer-url`，把同源
`/_astro/*.js|css` 一并预缓存。因此 Pages 预览必须验完：

1. 清除旧 Service Worker 注册后重新访问。
2. 安装为 PWA（桌面 Chrome 或 Android Chrome）。
3. 断网重启：首页与 `/metronome` 必须能打开并可用。
4. `/tools/metronome` 断网访问应落到已缓存的 `/metronome`。
5. 节拍器能出声、指板能切换、TAB 播放头能走。

## 4. 与 VPS 发布的关系

- VPS 仍是当前生产入口，回退路径是 `npm run deploy:local`（GitHub Actions 仅手动备用）。
- Pages 构建不依赖 VPS，也不需要 GHCR；两套产物内容一致（同一个 `dist/`）。
- 不要同时改两套发布流程：先让 Pages 预览验收通过，再切域名。

## 5. 切换顺序（独立发布步骤）

1. 推送分支，确认 Pages 预览构建成功且上面三段全部验收通过。
2. 在 Pages 项目里添加自定义域名 `guitar.believeboy.com`。
3. 在 Cloudflare DNS 把该域名的 A/AAAA 或 CNAME 从 VPS 切到 Pages 提供的目标。
4. 等待证书生效，用浏览器与 `curl -I` 复核首页、`/sw.js`、`/manifest.webmanifest`、`/_astro/*`。
5. 观察一个发布周期后再决定是否停掉 VPS 容器；保留至少一个可回滚的 SHA 镜像。

切换前不要删除 VPS 的 Caddy 站点块与 Compose 配置，它仍是回滚路径。
