/**
 * 屏幕常亮（Screen Wake Lock API）的纯逻辑部分，便于单测。
 *
 * 浏览器实现见 `components/useScreenWakeLock.ts`：这里只回答两件事——
 * 当前环境支持不支持、界面上该显示哪句话。不碰 DOM，也不在模块顶层读
 * `navigator`（静态导出预渲染时没有它）。
 */

export type WakeLockState = "idle" | "requesting" | "active" | "unsupported" | "denied";

/**
 * 只需要 sentinel 的三个成员。用结构类型而不是直接吃 `WakeLockSentinel`，
 * 测试里就能拿普通对象替身，不必伪造 EventTarget。
 */
export type WakeLockSentinelLike = {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};

export type WakeLockNavigatorLike = {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinelLike>;
  };
};

/** 支持检测：Safari 16.4 之前、Firefox 126 之前都没有 wakeLock */
export function supportsWakeLock(navigatorLike: WakeLockNavigatorLike | undefined): boolean {
  return typeof navigatorLike?.wakeLock?.request === "function";
}

/**
 * 界面提示文案。
 *
 * `idle` / `requesting` 返回空串：首屏到第一次 request 落定之间不闪字，
 * 状态条高度由调用方预留，避免布局跳动。`active` 不喊「已开启」而写
 * 「屏幕保持常亮」——它描述的是用户能观察到的结果，不是 API 状态。
 */
export function wakeLockHint(state: WakeLockState): string {
  switch (state) {
    case "active":
      return "屏幕保持常亮";
    case "unsupported":
      return "此浏览器不支持屏幕常亮";
    case "denied":
      return "屏幕常亮被系统拒绝";
    default:
      return "";
  }
}
