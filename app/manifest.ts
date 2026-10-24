import type { MetadataRoute } from "next";
import { SITE } from "@/content/site";

/**
 * 静态导出要求 metadata 路由显式声明 force-static，否则 `next build` 会在
 * 收集页面数据时报 “export const dynamic = "force-static" not configured”。
 */
export const dynamic = "force-static";

/**
 * PWA 清单（BLF-1443 建立，BLF-1451 随工具间迁移更新）。
 *
 * 静态导出时 Next 会把它渲染成 `/manifest.webmanifest`，与 `layout.tsx` 的
 * `metadata.manifest` 对应。安装后仍落在节拍器：这是全站唯一「打开就要用、
 * 还不能黑屏」的页面；旧地址 /metronome 有静态跳转壳接着（静态导出用不了
 * redirects()），已安装的实例不会 404。
 *
 * 名字在 BLF-1451 从「节拍器」改回站名，BLF-1452 随站点改名走 `content/site.ts`：
 * 装到桌面的是整个学习空间，不只是一个工具；快捷方式覆盖练习、知识与工具。
 *
 * 颜色与 `app/globals.css` 的 `--color-canvas`（冷白工作台）一致；
 * `tests/pwa.test.ts` 会核对两者没有走散。工具区的舞台黑是子树换皮，
 * 不进清单。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/tools/metronome",
    name: SITE.name,
    short_name: SITE.shortName,
    description: `${SITE.description}，断网也能打开节拍器。`,
    lang: "zh-CN",
    dir: "ltr",
    start_url: "/tools/metronome",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f2",
    theme_color: "#f4f4f2",
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
        name: "节拍器",
        short_name: "节拍器",
        url: "/tools/metronome",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "练习",
        short_name: "练习",
        url: "/practice",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "知识",
        short_name: "知识",
        url: "/library",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "和弦库",
        short_name: "和弦库",
        url: "/tools/chords",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "速查表",
        short_name: "速查表",
        url: "/tools/cheatsheet",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "节奏型",
        short_name: "节奏型",
        url: "/tools/rhythms",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
