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
      <body className="flex min-h-screen flex-col">
        <SiteNav />
        {children}
        <footer className="mx-auto mt-auto w-full max-w-[1120px] px-5 pb-10 pt-8 text-sm text-ink-500">
          <div className="border-t border-ink-200 pt-6">
            个人学习资料库 · 内容为原始资料的整理改写
          </div>
        </footer>
      </body>
    </html>
  );
}
