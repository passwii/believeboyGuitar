import type { MetadataRoute } from "next";

/**
 * 静态导出要求 metadata 路由显式声明 force-static，否则 `next build` 会在
 * 收集页面数据时报 “export const dynamic = "force-static" not configured”。
 */
export const dynamic = "force-static";

/**
 * PWA 清单（2026-10-31 四入口收敛）。
 *
 * 静态导出时 Next 会把它渲染成 `/manifest.webmanifest`，与 `layout.tsx` 的
 * `metadata.manifest` 对应。安装后从首页启动；快捷入口只有练习、资料库、
 * 节拍器。旧安装实例的 /tools/metronome 仍有兼容跳转。
 *
 * 颜色与 `app/globals.css` 的 `--color-canvas`（冷灰绿信号台）一致；
 * `tests/pwa.test.ts` 会核对两者没有走散。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "电吉他练习站",
    short_name: "练习站",
    description: "个人电吉他练习站：周练、指板音阶与节拍器。",
    lang: "zh-CN",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f1f2ec",
    theme_color: "#f1f2ec",
    categories: ["music", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "练习",
        short_name: "练习",
        url: "/practice",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "资料库",
        short_name: "资料库",
        url: "/library",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "节拍器",
        short_name: "节拍器",
        url: "/metronome",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
