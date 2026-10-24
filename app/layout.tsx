import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/install-prompt";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";
import "@/content/content.css";

export const metadata: Metadata = {
  title: {
    default: "电吉他学习资料库",
    template: "%s · 电吉他学习资料库",
  },
  description: "个人电吉他学习资料的整理与长期积累",
  applicationName: "电吉他学习资料库",
  // PWA（BLF-1443）：清单在 app/manifest.ts，安装后从节拍器进入
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "节拍器",
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
  themeColor: "#f3f0e8",
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
        <footer className="mt-auto pt-16 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          <div className="shell">
            <div className="border-t border-rule pt-6 text-meta text-ink-500">
              个人学习资料库 · 内容为原始资料的整理改写
            </div>
          </div>
        </footer>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
