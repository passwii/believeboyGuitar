import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE } from "@/content/site";
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/install-prompt";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";
import "@/content/content.css";

export const metadata: Metadata = {
  title: {
    default: SITE.name,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  // PWA（BLF-1443 / BLF-1451 / BLF-1452）：清单在 app/manifest.ts。
  // 名字只写在 content/site.ts，站点改名时这里跟着走。
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE.shortName,
  },
  // Next 只自动输出 android 侧的 mobile-web-app-capable；iOS 16.4 之前
  // 靠这行才从主屏幕全屏启动
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // 与 globals.css 的 --color-canvas（冷白工作台）一致，
  // tests/pwa.test.ts 会核对两者没有走散；工具区的舞台黑不进清单。
  themeColor: "#f4f4f2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 安装提示的「抢跑」脚本（BLF-1448）：beforeinstallprompt 早于 React
            挂载就触发，等到 useEffect 再监听会漏掉。必须放在 head 里最先执行。 */}
        <script
          // 静态字符串、无插值，不需要转义
          dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }}
        />
      </head>
      <body className="flex min-h-svh flex-col">
        <SiteNav />
        {children}
        <SiteFooter />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
