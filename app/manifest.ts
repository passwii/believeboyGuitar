import type { MetadataRoute } from "next";

/**
 * 静态导出要求 metadata 路由显式声明 force-static，否则 `next build` 会在
 * 收集页面数据时报 “export const dynamic = "force-static" not configured”。
 */
export const dynamic = "force-static";

/**
 * PWA 清单（BLF-1443）。
 *
 * 静态导出时 Next 会把它渲染成 `/manifest.webmanifest`，与 `layout.tsx` 的
 * `metadata.manifest` 对应。安装后的应用直接落在节拍器：这是这个站唯一
 * 「打开就要用、还不能黑屏」的页面。scope 仍是整站，装成应用后从节拍器
 * 点去资料库不会跳到浏览器。
 *
 * 颜色与 `app/globals.css` 的 `--color-canvas` 一致；`tests/pwa.test.ts`
 * 会核对两者没有走散。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/metronome",
    name: "节拍器 · 电吉他学习资料库",
    short_name: "节拍器",
    description: "不带广告、不联网也能用的节拍器，打开页面就保持屏幕常亮。",
    lang: "zh-CN",
    dir: "ltr",
    start_url: "/metronome",
    scope: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#f3f0e8",
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
        name: "资料库",
        short_name: "资料库",
        url: "/library",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
