"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  supportsWakeLock,
  wakeLockHint,
  type WakeLockNavigatorLike,
  type WakeLockSentinelLike,
  type WakeLockState,
} from "@/lib/wake-lock";

type ScreenWakeLock = {
  state: WakeLockState;
  /** 状态条文案，`idle` / `requesting` 时为空串 */
  hint: string;
  /** 再要一次；已有 sentinel 时是 no-op。传给「开始」按钮借用户手势重试 */
  keepAwake: () => void;
};

/**
 * 页面打开期间让屏幕保持常亮（BLF-1443）。
 *
 * 几个容易踩的点：
 *
 * - **页面一隐藏，浏览器就会自动释放 wake lock**，所以每次回到 visible 都要重要。
 * - Chrome / Safari 的 `request()` 在某些版本里要求用户手势；挂载时先试一次，
 *   被拒也不报错，等用户点「开始」时借那个手势再试一次（`keepAwake`）。
 * - 组件卸载必须主动 `release()`：sentinel 不释放会一直把屏幕点亮。
 * - sentinel 的 `release` 事件在系统收回（切后台、电量低）时也会触发，
 *   此时状态回 `idle`，界面不显示任何警告——用户回来后会重新拿到。
 */
export function useScreenWakeLock(): ScreenWakeLock {
  const [state, setState] = useState<WakeLockState>("idle");
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const requestingRef = useRef(false);
  const mountedRef = useRef(false);

  const request = useCallback(async () => {
    const wakeLock = (navigator as unknown as WakeLockNavigatorLike).wakeLock;
    if (!supportsWakeLock({ wakeLock })) {
      setState("unsupported");
      return;
    }

    const current = sentinelRef.current;
    if (current && !current.released) return;
    if (requestingRef.current) return;
    // 页签在后台时 request() 必然失败，不要把这个失败记成「被拒绝」
    if (document.visibilityState !== "visible") return;

    requestingRef.current = true;
    setState((previous) => (previous === "active" ? previous : "requesting"));

    try {
      const sentinel = await wakeLock!.request("screen");

      if (!mountedRef.current) {
        void sentinel.release().catch(() => {});
        return;
      }

      sentinelRef.current = sentinel;
      setState("active");

      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        if (mountedRef.current) {
          setState((previous) => (previous === "active" ? "idle" : previous));
        }
      });
    } catch {
      if (mountedRef.current) setState("denied");
    } finally {
      requestingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // 放到微任务里再申请：`request()` 会同步落一个 setState（requesting /
    // unsupported），在 effect 主体里同步 setState 会触发级联渲染
    queueMicrotask(() => {
      if (mountedRef.current) void request();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [request]);

  const keepAwake = useCallback(() => {
    void request();
  }, [request]);

  return { state, hint: wakeLockHint(state), keepAwake };
}
