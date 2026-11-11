# Cloudflare Pages 发布

本仓库的网站是 Astro 静态站（`output: "static"`），产物在 `dist/`，没有 Worker、Pages Functions、
数据库或账号。Cloudflare Pages 只是静态托管，不需要 `@astrojs/cloudflare` 适配器。

**生产域名 `guitar.believeboy.com` 已由 Cloudflare Pages 托管**（自定义域状态「活动 / SSL 已启用」，
DNS 记录为代理的 `CNAME → believeboyguitar.pages.dev`）。VPS 保留为回滚路径，见 [deployment.md](./deployment.md)。
项目名 `believeboyguitar`，生产分支 `main`，构建命令 `npm run build`，输出目录 `dist`，
环境变量 `NODE_VERSION=22.12.0`。

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

- Pages 是生产入口：`main` push 自动构建发布。
- VPS 是回滚路径：`npm run deploy:local` 构建并推送 SHA 镜像，再让 VPS 拉取；DNS 切回 A 记录即可回退。
- Pages 构建不依赖 VPS，也不需要 GHCR；两套产物内容一致（同一个 `dist/`）。
- 回滚步骤：(1) DNS 把 `guitar` 的 CNAME 改回指向 VPS 的 A 记录；(2) `IMAGE_TAG=sha-<旧版本> npm run deploy:local`。

## 5. 实际切换记录（2026-11-11）

1. 合并 PR #35 到 `main`，Pages 自动构建成功，先验收 `believeboyguitar.pages.dev`：
   全部路由 200、未知路径 404、`/sw.js` 为 `no-cache, no-store`、`/_astro/*` 为一年 `immutable`、
   manifest 为 `application/manifest+json`。
2. 在 Pages 项目 **自定义域** 里输入 `guitar.believeboy.com`。
3. 确认 DNS 变更预览：`A guitar → 145.79.143.98` 替换为 `CNAME guitar → believeboyguitar.pages.dev`，
   点击「激活域」。
4. 状态变为「活动 / SSL 已启用」，用 `curl --resolve` 指向 Cloudflare 边缘复核：
   页面是 Astro 产物（`/_astro/*`、无 `/_next/*`），缓存头与 pages.dev 一致。

> 本地排查注意：如果本机开了 fake-IP 代理，`dig guitar.believeboy.com` 会返回 `198.18.x.x`，
> 直接 `curl` 可能命中本地代理并回旧 VPS 内容。验证生产请用 `curl --resolve guitar.believeboy.com:443:<边缘IP>`
> 或 DNS over HTTPS（`cloudflare-dns.com/dns-query`）。

VPS 的 Caddy 站点块与 Compose 配置继续保留，它是回滚路径。
