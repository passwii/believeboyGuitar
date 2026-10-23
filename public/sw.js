/**
 * 节拍器 PWA 的 Service Worker（BLF-1443）。
 *
 * 目标只有一个：装到主屏幕之后，断网也能打开节拍器。所以策略刻意保守——
 *
 * - `_next/static/*` 是带内容哈希的不可变资源，缓存优先；
 * - 页面导航走网络优先，在线时永远拿最新构建，断网才落回缓存；
 * - 图标与清单走 stale-while-revalidate；
 * - 只处理同源 GET，不碰 POST、跨域和浏览器扩展请求。
 *
 * 没有构建步骤：`public/sw.js` 原样拷贝到 `out/sw.js`。改了本文件就改
 * `VERSION`，激活时会清掉旧版本的缓存。
 *
 * 安装阶段有两类预缓存，失败语义不同：
 *
 * - **必需壳**（`REQUIRED_SHELL`）：节拍器的 HTML 加它引用的 `_next/static/*`。
 *   任何一个拿不到就让 install 失败，旧 worker 与旧缓存继续服务——用户最多晚
 *   一次更新，不会出现「HTML 回来了、JS 却 404」的半截离线壳。
 * - **可选壳**（`OPTIONAL_SHELL`）：清单与图标，404 只影响安装外观，不该让整次
 *   安装失败（否则连离线节拍器都没有）。
 *
 * 构建产物必须在安装时自己抓一遍：首次访问时 SW 在 `load` 之后才注册，页面自己
 * 的 `/_next/static/*` 请求早已绕过 SW 发出，而 `cacheFirst` 只在页面受控之后才
 * 命中。只缓存 HTML 的话，装完直接断网启动会拿到一张没有 JS 的页面。
 */

const VERSION = "2026-10-23-2";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;

/** 拿不到就等于离线打不开节拍器，失败必须让 install 失败 */
const REQUIRED_SHELL = ["/metronome"];

/**
 * 可选壳：清单与安装图标。缺一张只是图标不好看，不值得让用户失去离线能力。
 */
const OPTIONAL_SHELL = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

/**
 * 从页面 HTML 里挑出同源构建产物：`<script src>` 与 `<link href>` 指向的
 * `/_next/static/*`。安装时照着清单逐个抓，不依赖浏览器 HTTP 缓存碰巧命中。
 */
function buildAssets(html) {
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
    assets.add(match[1]);
  }
  return [...assets];
}

/** 必需壳：HTML + 它引用的构建产物，任何一个失败都抛出去 */
async function precacheRequiredShell() {
  const shell = await caches.open(SHELL_CACHE);
  const statics = await caches.open(STATIC_CACHE);

  for (const url of REQUIRED_SHELL) {
    const response = await fetch(new Request(url, { cache: "reload" }));
    if (!response.ok) {
      throw new Error(`预缓存 ${url} 失败：HTTP ${response.status}`);
    }
    await shell.put(url, response.clone());

    const assets = buildAssets(await response.text());
    // 一条构建产物都没有，说明拿到的不是这次导出的页面，不能当壳用
    if (assets.length === 0) {
      throw new Error(`预缓存 ${url} 失败：HTML 里没有 _next/static 资源`);
    }

    for (const asset of assets) {
      if (await statics.match(asset)) continue;
      const assetResponse = await fetch(new Request(asset, { cache: "reload" }));
      if (!assetResponse.ok) {
        throw new Error(`预缓存 ${asset} 失败：HTTP ${assetResponse.status}`);
      }
      await statics.put(asset, assetResponse);
    }
  }
}

/** 可选壳：逐条 catch，任何一个 404 都不阻塞安装 */
async function precacheOptionalShell() {
  const shell = await caches.open(SHELL_CACHE);
  await Promise.all(
    OPTIONAL_SHELL.map(async (url) => {
      try {
        await shell.add(new Request(url, { cache: "reload" }));
      } catch {
        // 运行时的 staleWhileRevalidate 还会再试，这里失败不算错
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await precacheRequiredShell();
      } catch (error) {
        // 半截的壳已经写进新版本的缓存：清掉再抛。install 失败 → 旧 worker
        // 继续服务，activate 不会跑，旧缓存也就不会被删。
        await caches.delete(SHELL_CACHE);
        await caches.delete(STATIC_CACHE);
        throw error;
      }

      await precacheOptionalShell();

      // 只有壳完整时才接管。activate 敢删旧缓存，就靠这条保证。
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter(
        (key) => key !== SHELL_CACHE && key !== STATIC_CACHE,
      );
      await Promise.all(stale.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/** 缓存优先：用于带哈希、永不变化的构建产物 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** 先给缓存，同时在后台更新：图标、清单这类偶尔变的文件 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await network) ?? Response.error();
}

/** 网络优先：页面导航，在线时永远拿最新 HTML */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
