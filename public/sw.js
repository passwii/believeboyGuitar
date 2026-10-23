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
 */

const VERSION = "2026-10-23-1";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;

/** 安装时就要拿到的壳：节拍器本身、首页与安装图标 */
const PRECACHE = [
  "/metronome",
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // 逐个 add：任何一个 404 都不该让整次安装失败
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            // 预缓存失败不阻塞安装，运行时还会再缓存一次
          }
        }),
      );
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
