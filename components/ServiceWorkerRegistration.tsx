"use client";

import { useEffect } from "react";

/**
 * 注册 PWA 的 Service Worker（BLF-1443）。
 *
 * 只在生产构建里注册：`next dev` 的页面与资源名不稳定，旧缓存会盖住热更新。
 * 开发环境反而会主动清掉之前用 `next build` 预览时留下的注册。
 *
 * 失败不影响页面本身——节拍器的声音、屏幕常亮都不依赖 SW，离线能力才依赖。
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => {});
      return;
    }

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // 注册失败（隐私模式、旧浏览器）不打断页面
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
