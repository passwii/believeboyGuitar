import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";
import "@/content/content.css";

export const metadata: Metadata = {
  title: {
    default: "电吉他学习资料库",
    template: "%s · 电吉他学习资料库",
  },
  description: "个人电吉他学习资料的整理与长期积累",
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
      </body>
    </html>
  );
}
