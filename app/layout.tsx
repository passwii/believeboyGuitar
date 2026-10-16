import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";
import "@/content/content.css";

export const metadata: Metadata = {
  title: "电吉他学习资料库",
  description: "个人电吉他学习资料的整理与长期积累",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <SiteNav />
        {children}
        <footer className="mx-auto max-w-3xl px-5 py-10 text-xs text-ink-500">
          个人学习资料库 · 内容为原始资料的整理改写
        </footer>
      </body>
    </html>
  );
}
