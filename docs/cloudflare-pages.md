# Cloudflare Pages 上线前准备

状态：**上线前准备，不代表已经部署到 Cloudflare。**

当前生产仍是 VPS + Nginx；本文只记录 Cloudflare Pages + Git 集成方案所需的静态导出、
路由与缓存契约。Cloudflare 账户、Pages 项目、Git 集成、域名切换和生产发布不在本文范围。

## 构建配置

| 项目 | 值 |
| --- | --- |
| Production branch | `main` |
| Node.js | `24` |
| Build command | `npm run typecheck && npm test && npm run build -- --webpack && npm run verify:css && npm run verify:export` |
| Output directory | `out` |

项目已经是 Next.js 16.4.1 App Router 静态导出，不需要 SSR、vinext/OpenNext、Workers
Functions 或新的业务代码。

## 路由语义

Next.js 导出后，Cloudflare Pages 会把 extensionless URL 映射到对应 HTML：

| URL | 导出文件 | 预期 |
| --- | --- | --- |
| `/` | `out/index.html` | 200 |
| `/practice` | `out/practice.html` | 200 |
| `/practice/<slug>` | `out/practice/<slug>.html` | 200 |
| `/library` | `out/library.html` | 200 |
| `/library/fretboard-scale` | `out/library/fretboard-scale.html` | 200 |
| `/metronome` | `out/metronome.html` | 200 |
| `/tools/metronome` | `out/tools/metronome.html` | 200，页面内兼容跳转到 `/metronome` |
| 未知路由 | `out/404.html` | 404 |

`/tools/metronome` 是静态兼容页，不需要新增 `_redirects`。未知路由也不需要 SPA
回退；Pages 直接使用 `404.html`，与当前 Nginx `error_page 404 /404.html` 一致。

## 缓存契约

`public/_headers` 在构建时原样复制到 `out/_headers`，对 Pages 中匹配的资源生效：

```text
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
  Cache-Control: no-cache

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
```

- `/sw.js` 禁止缓存，确保浏览器能发现 Service Worker 更新。
- `/manifest.webmanifest` 每次重新验证。
- `/_next/static/*` 是带内容哈希的不可变资源，允许缓存一年。
- 其他 HTML 和静态文件沿用 Pages 默认重验证策略；不要为 `/*` 再写一条会覆盖上述
  精确规则的 `Cache-Control`。

## 构建后校验

```bash
npm run build -- --webpack
npm run verify:css
npm run verify:export
```

`npm run verify:export` 会检查：

- `out/_headers` 与 `public/_headers` 完全一致；
- 三条缓存头在 `_headers` 中存在且值正确；
- 首页、练习中心、全部练习详情、资料库、指板音阶、节拍器和旧节拍器地址都有
  对应 HTML；
- `out/404.html`、`out/sw.js`、`out/manifest.webmanifest` 和 `out/_next/static/`
  存在；
- `out/sw.js` 与 `public/sw.js` 一致，manifest 是有效 JSON 且从 `/` 启动。

本地 Pages 预检需要有网络时首次下载 Wrangler，不会修改 Cloudflare 账户：

```bash
npx wrangler pages dev out --port 8788
```

在另一个终端检查路由与响应头：

```bash
for route in / /practice /practice/week-1-finger-independence /library \
  /library/fretboard-scale /metronome /tools/metronome /not-a-real-route; do
  curl -sS -o /dev/null -w "%{http_code} %{url_effective}\n" "http://127.0.0.1:8788$route"
done

curl -fsSI http://127.0.0.1:8788/sw.js
curl -fsSI http://127.0.0.1:8788/manifest.webmanifest
asset="$(find out/_next/static -type f | head -n 1)"
curl -fsSI "http://127.0.0.1:8788/${asset#out/}"
```

预期前七条路由为 200，未知路由为 404；三个资源分别返回：

```text
Cache-Control: no-cache, no-store, must-revalidate
Cache-Control: no-cache
Cache-Control: public, max-age=31536000, immutable
```

这是本地 Pages 模拟，不是生产部署证据。只有完成 Cloudflare 账户配置、Git 集成、
域名切换并在 `*.pages.dev` 和正式域名复验后，才能标记 Cloudflare 上线完成。

## 参考

- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages routing](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Deploy a static Next.js site](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
