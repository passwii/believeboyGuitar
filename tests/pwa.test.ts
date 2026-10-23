import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { Metronome } from "@/components/Metronome";
import {
  preferPlaybackAudioSession,
  type AudioSessionNavigatorLike,
} from "@/lib/background-audio";
import {
  supportsWakeLock,
  wakeLockHint,
  type WakeLockNavigatorLike,
  type WakeLockState,
} from "@/lib/wake-lock";

/**
 * PWA 与「锁屏不断声」的守护（BLF-1443）。
 *
 * 仓库 vitest 是 node 环境、没有 DOM：能用纯函数验的（wake lock 检测、
 * AudioSession 声明）直接调；只能靠源码结构表达的东西（事件监听、注册时机、
 * 清单与图标是否配套）读源码与文件。构建产物（out/）不在这里验，
 * `npm run build` 会另外证明静态导出能出来。
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const layout = read("app/layout.tsx");
const serviceWorker = read("public/sw.js");
const registration = read("components/ServiceWorkerRegistration.tsx");
const wakeLockHook = read("components/useScreenWakeLock.ts");
const metronome = read("components/Metronome.tsx");
const globals = read("app/globals.css");

/** 读 PNG 的 IHDR，顺便证明文件真的是 PNG（不是改了后缀的 SVG） */
function pngSize(relative: string): { width: number; height: number } {
  const buffer = readFileSync(path.join(root, relative));
  expect(buffer.subarray(1, 4).toString("ascii"), `${relative} 不是 PNG`).toBe("PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("Web App Manifest", () => {
  const data = manifest();

  it("安装后直接落在节拍器，scope 仍是整站", () => {
    expect(data.id).toBe("/metronome");
    expect(data.start_url).toBe("/metronome");
    expect(data.scope).toBe("/");
    expect(data.display).toBe("standalone");
    // 装成应用后在节拍器点去资料库，不能跳出到浏览器
    expect(data.start_url).not.toBe(data.scope);
  });

  it("名字是「节拍器」，不是整个站点名", () => {
    expect(data.short_name).toBe("节拍器");
    expect(data.name).toContain("节拍器");
    expect(data.lang).toBe("zh-CN");
  });

  it("主题色与画布色一致，不另起一套颜色", () => {
    const canvas = globals.match(/--color-canvas:\s*(#[0-9a-f]{6})/i)?.[1];
    expect(canvas).toBeTruthy();
    expect(data.theme_color?.toLowerCase()).toBe(canvas?.toLowerCase());
    expect(data.background_color?.toLowerCase()).toBe(canvas?.toLowerCase());
  });

  it("提供 192 / 512 与 maskable 图标，文件与声明尺寸一致", () => {
    const icons = data.icons ?? [];
    const byPurpose = (purpose: string) =>
      icons.filter((icon) => icon.purpose === purpose);

    expect(byPurpose("any").map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(byPurpose("maskable").map((icon) => icon.sizes)).toContain("512x512");

    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const size = pngSize(path.join("public", icon.src));
      expect(`${size.width}x${size.height}`, `${icon.src} 尺寸对不上`).toBe(icon.sizes);
    }
  });

  it("iOS 的 apple-touch-icon 是 180×180、不透明 PNG", () => {
    expect(pngSize("public/icons/apple-touch-icon.png")).toEqual({
      width: 180,
      height: 180,
    });
  });
});

describe("layout 的 PWA 元信息", () => {
  it("挂上 manifest 与 iOS 的独立窗口声明", () => {
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(layout).toMatch(/appleWebApp:\s*\{[\s\S]*?capable:\s*true/);
    expect(layout).toContain('title: "节拍器"');
  });

  it("apple-touch-icon 指向清单里那张 180px 图标", () => {
    expect(layout).toContain('url: "/icons/apple-touch-icon.png", sizes: "180x180"');
  });

  it("Service Worker 的注册组件挂在根布局里", () => {
    expect(layout).toContain("<ServiceWorkerRegistration />");
    expect(layout).toContain(
      'import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration"',
    );
  });
});

describe("Service Worker", () => {
  it("有版本号、安装、激活与 fetch 三段", () => {
    expect(serviceWorker).toMatch(/const VERSION = "/);
    expect(serviceWorker).toContain('addEventListener("install"');
    expect(serviceWorker).toContain('addEventListener("activate"');
    expect(serviceWorker).toContain('addEventListener("fetch"');
  });

  it("只处理同源 GET，不碰 POST 与跨域", () => {
    expect(serviceWorker).toContain('if (request.method !== "GET") return;');
    expect(serviceWorker).toContain("if (url.origin !== self.location.origin) return;");
  });

  it("页面走网络优先，带哈希的构建产物走缓存优先", () => {
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(serviceWorker).toContain("networkFirst(request, SHELL_CACHE)");
    expect(serviceWorker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(serviceWorker).toContain("cacheFirst(request, STATIC_CACHE)");
  });

  it("激活时清掉旧版本缓存，安装后立即接管", () => {
    expect(serviceWorker).toContain("caches.keys()");
    expect(serviceWorker).toContain("caches.delete(key)");
    expect(serviceWorker).toContain("self.skipWaiting()");
    expect(serviceWorker).toContain("self.clients.claim()");
  });

  it("预缓存节拍器页面本身，断网也能打开", () => {
    expect(serviceWorker).toContain('"/metronome"');
    expect(serviceWorker).toContain('"/manifest.webmanifest"');
  });
});

describe("Service Worker 首装就把构建产物装进缓存", () => {
  /**
   * 首装断网启动缺 JS/CSS（复核 1）：SW 在 load 之后才注册，页面自己的
   * `/_next/static/*` 请求早已绕过 SW，install 必须自己把 HTML 引用的资源抓一遍。
   *
   * `buildAssets` 是 SW 里的普通函数、没有模块导出，这里从源码截出来直接跑 ——
   * 断言解析结果，而不是断言源码里出现过某个字符串。
   */
  const buildAssetsSource = serviceWorker.slice(
    serviceWorker.indexOf("function buildAssets(html)"),
    serviceWorker.indexOf("/** 必需壳：HTML"),
  );
  const buildAssets = new Function(
    `${buildAssetsSource}; return buildAssets;`,
  )() as (html: string) => string[];

  it("从 script src / link href 里挑出 /_next/static 资源，去重且不越界", () => {
    const html = `<!doctype html><html><head>
      <link rel="stylesheet" href="/_next/static/css/app-1.css">
      <link rel="preload" href="/_next/static/media/font-2.woff2" as="font">
      </head><body>
      <script src="/_next/static/chunks/main-3.js" async></script>
      <script src="/_next/static/chunks/main-3.js" async></script>
      <script src="https://cdn.example.com/other.js"></script>
      <img src="/icons/icon-192.png">
      <script src='/_next/static/chunks/quote-4.js'></script>
      </body></html>`;

    // 单引号也认：压缩器换引号风格不该让整次安装失败
    expect(buildAssets(html)).toEqual([
      "/_next/static/css/app-1.css",
      "/_next/static/media/font-2.woff2",
      "/_next/static/chunks/main-3.js",
      "/_next/static/chunks/quote-4.js",
    ]);
  });

  it("安装阶段解析 /metronome 的 HTML 并把资源写进 static 缓存", () => {
    expect(serviceWorker).toContain("const assets = buildAssets(await response.text());");
    expect(serviceWorker).toContain("await statics.put(asset, assetResponse)");
    // 单个资源拿不到也算必需壳失败，不能留下「HTML 有、JS 没有」
    expect(serviceWorker).toContain("if (!assetResponse.ok)");
  });

  it("必需壳失败让 install 失败：抛错、清掉半截缓存、不 skipWaiting", () => {
    const from = serviceWorker.indexOf("async function precacheRequiredShell()");
    // 下一个顶层注释之前都是必需壳的代码，注释文字不参与断言
    const to = serviceWorker.indexOf("/**", from + 10);
    const required = serviceWorker.slice(from, to);

    expect(from).toBeGreaterThan(-1);
    expect(required).toContain("throw new Error");
    // 必需壳里不能有把失败吞掉的 catch
    expect(required).not.toContain("catch");
    expect(serviceWorker).toContain("await caches.delete(SHELL_CACHE)");
    expect(serviceWorker.indexOf("await self.skipWaiting()")).toBeGreaterThan(to);
  });

  it("可选壳仍是逐条 catch，404 不阻塞安装", () => {
    const from = serviceWorker.indexOf("async function precacheOptionalShell()");
    const to = serviceWorker.indexOf('self.addEventListener("install"');
    const optional = serviceWorker.slice(from, to);

    expect(optional).toContain("try {");
    expect(optional).toContain("catch {");
    // 图标与清单运行时从 STATIC_CACHE 读，预缓存也得写进同一个缓存
    expect(optional).toContain("caches.open(STATIC_CACHE)");
  });
});

describe("Service Worker 注册时机", () => {
  it("生产环境注册、开发环境反注册，避免预览构建的缓存盖住热更新", () => {
    expect(registration).toContain('process.env.NODE_ENV !== "production"');
    expect(registration).toContain("registration.unregister()");
    expect(registration).toContain('.register("/sw.js"');
    expect(registration).toContain('scope: "/"');
    expect(registration).toContain('updateViaCache: "none"');
  });

  it("等 load 再注册；晚于 load 时直接注册", () => {
    expect(registration).toContain('document.readyState === "complete"');
    expect(registration).toContain('window.addEventListener("load", register');
  });

  it("浏览器没有 serviceWorker 时安静退出", () => {
    expect(registration).toContain('if (!("serviceWorker" in navigator)) return;');
  });
});

describe("屏幕常亮：支持检测与文案", () => {
  it("按 wakeLock.request 是否存在判断，不靠 UA", () => {
    const fake: WakeLockNavigatorLike = {
      wakeLock: { request: async () => ({ released: false, release: async () => {}, addEventListener: () => {} }) },
    };
    expect(supportsWakeLock(fake)).toBe(true);
    expect(supportsWakeLock({})).toBe(false);
    expect(supportsWakeLock(undefined)).toBe(false);
  });

  it("active / unsupported / denied 各有一句人话，其余不占位", () => {
    const labels: Record<WakeLockState, string> = {
      idle: wakeLockHint("idle"),
      requesting: wakeLockHint("requesting"),
      active: wakeLockHint("active"),
      unsupported: wakeLockHint("unsupported"),
      denied: wakeLockHint("denied"),
    };

    expect(labels.active).toBe("屏幕保持常亮");
    expect(labels.unsupported).toContain("不支持");
    expect(labels.denied).toContain("拒绝");
    expect(labels.idle).toBe("");
    expect(labels.requesting).toBe("");
  });
});

describe("屏幕常亮：生命周期", () => {
  it("挂载时申请 screen，卸载时释放", () => {
    expect(wakeLockHook).toContain('.request("screen")');
    expect(wakeLockHook).toMatch(/release\(\)/);
    expect(wakeLockHook).toContain("mountedRef.current = false");
  });

  it("回到前台要重新申请（页面隐藏时浏览器会自动收回）", () => {
    expect(wakeLockHook).toContain('document.addEventListener("visibilitychange"');
    expect(wakeLockHook).toContain('document.visibilityState === "visible"');
    expect(wakeLockHook).toContain('document.visibilityState !== "visible"');
  });

  it("不把后台页签的必然失败记成「被拒绝」", () => {
    const from = wakeLockHook.indexOf('if (document.visibilityState !== "visible") return;');
    const requestAt = wakeLockHook.indexOf('.request("screen")');
    expect(from).toBeGreaterThan(-1);
    expect(from).toBeLessThan(requestAt);
  });
});

describe("锁屏继续出声：AudioSession", () => {
  it("Safari 有 audioSession 时声明为 playback", () => {
    const nav: AudioSessionNavigatorLike = { audioSession: { type: "auto" } };
    expect(preferPlaybackAudioSession(nav)).toBe(true);
    expect(nav.audioSession?.type).toBe("playback");
  });

  it("没有 audioSession 或写入失败时安静返回 false", () => {
    expect(preferPlaybackAudioSession(undefined)).toBe(false);
    expect(preferPlaybackAudioSession({})).toBe(false);
    const readonly: AudioSessionNavigatorLike = {
      audioSession: Object.defineProperty({}, "type", {
        get: () => "auto",
        set: () => {
          throw new Error("readonly");
        },
      }) as { type: string },
    };
    expect(preferPlaybackAudioSession(readonly)).toBe(false);
  });
});

describe("锁屏继续出声：Metronome 的可见性处理", () => {
  const from = metronome.indexOf("const onVisibilityChange = () => {");
  const to = metronome.indexOf('document.addEventListener("visibilitychange"', from);
  const handler = from > -1 && to > from ? metronome.slice(from, to) : "";

  it("隐藏时先按后台窗口排满，而不是暂停", () => {
    expect(handler).toContain('document.visibilityState === "hidden"');
    expect(handler).toContain("tick();");
    expect(handler).not.toContain("void pause()");
    expect(handler).not.toContain("audio.suspend()");
  });

  it("回到前台先恢复音频时钟，再把长队列收回", () => {
    expect(handler).toContain("void resumeFromBackground();");
    expect(metronome).toContain("await audio.resume()");
    expect(metronome).toContain("retainScheduleWindow(pendingRef.current");
    expect(metronome).toContain("audio.cancelFrom(plan.cutoff)");
  });

  it("后台窗口远大于前台窗口（定时器被节流时仍有拍子）", () => {
    const background = Number(
      metronome.match(/const BACKGROUND_SCHEDULE_AHEAD_S = (\d+);/)?.[1],
    );
    const foreground = Number(metronome.match(/const SCHEDULE_AHEAD_S = ([\d.]+);/)?.[1]);
    expect(background).toBeGreaterThanOrEqual(60);
    expect(background).toBeGreaterThan(foreground * 10);
  });

  it("调度器按可见性切换向前看的窗口", () => {
    expect(metronome).toContain('document.visibilityState === "hidden"');
    expect(metronome).toMatch(/BACKGROUND_SCHEDULE_AHEAD_S[\s\S]{0,80}: SCHEDULE_AHEAD_S/);
  });

  it("声明 playback 音频会话，并接上锁屏播放控制", () => {
    expect(metronome).toContain("preferPlaybackAudioSession(");
    expect(metronome).toContain('["play", () => void start()]');
    expect(metronome).toContain('["pause", () => void pause()]');
    expect(metronome).toContain('["stop", () => void stop()]');
    expect(metronome).toContain("setActionHandler(action, handler)");
    expect(metronome).toContain("playbackState");
  });
});

describe("页面首屏", () => {
  it("服务端渲染不碰 navigator / document（静态导出预渲染）", () => {
    const html = renderToStaticMarkup(createElement(Metronome));
    // 状态条在没有浏览器 API 时是空的，但位置与样式已经渲染出来
    expect(html).toContain('class="min-h-5 text-center text-meta text-ink-500"');
  });
});
