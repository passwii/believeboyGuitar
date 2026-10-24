/**
 * 「安装到主屏幕」的纯逻辑（BLF-1448）。
 *
 * 背景：BLF-1443 做了 PWA 清单、图标与 Service Worker，但页面里**没有任何代码
 * 调用过 `beforeinstallprompt` 拿到的 `prompt()`**。Chrome 在 2021 年就去掉了
 * 自动弹出的 mini-infobar——浏览器只会把事件派发给页面，是否显示入口、什么时候
 * 显示，全由页面自己决定。所以「装了 PWA 基建」和「用户看得到安装入口」是两件事：
 * 前者早就好了，后者一直缺着。
 *
 * 这个模块不碰 DOM：只回答「该显示哪种入口」和「点了以后该说什么」，
 * 浏览器交互在 `components/InstallPrompt.tsx` 里。
 */

/**
 * `beforeinstallprompt` 不是标准事件，TS 的 DOM lib 里没有。
 * 按 Chromium 的实现补形状：`prompt()` 调起系统安装框，`userChoice` 报告结果。
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** 当前该给用户看什么 */
export type InstallEntry =
  /** 什么都不显示：已经装过了，或者这不是一个能装的环境 */
  | "hidden"
  /** Android / 桌面 Chrome：有 deferred prompt，可以一键调起系统安装弹窗 */
  | "native"
  /** iOS Safari：没有 beforeinstallprompt，只能教用户走「分享 → 添加到主屏幕」 */
  | "ios-instructions";

export type InstallEnvironment = {
  /** 是否已经是 standalone（从主屏幕图标启动，而不是浏览器标签页） */
  standalone: boolean;
  /** 是否已经捕获到可用的 deferred prompt */
  hasDeferredPrompt: boolean;
  /** 是否 iOS / iPadOS */
  isIos: boolean;
  /** 是否 Safari（iOS 上只有 Safari 支持「添加到主屏幕」） */
  isSafari: boolean;
};

/**
 * iOS 上「分享 → 添加到主屏幕」这条路径只存在于 Safari。
 * Chrome / Firefox / Edge 在 iOS 上都是 WebKit 套壳，没有这个菜单项，
 * 所以只对 Safari 显示指引，免得教用户点一个不存在的东西。
 */
export function resolveInstallEntry(environment: InstallEnvironment): InstallEntry {
  // 已经装过：不再劝装。display-mode 在 iOS 上也可靠（standalone 全屏启动）
  if (environment.standalone) return "hidden";

  // 有 deferred prompt 就是能一键装，优先用它——比文字指引短得多
  if (environment.hasDeferredPrompt) return "native";

  if (environment.isIos && environment.isSafari) return "ios-instructions";

  return "hidden";
}

/** 从 userAgent 判断 iOS / iPadOS（iPadOS 13+ 的 UA 伪装成 macOS，用触点数兜底） */
export function isIosUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ 桌面模式：UA 是 Macintosh，但触点数 > 1
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/**
 * 从 userAgent 判断 Safari。
 *
 * 两个容易写错的地方：
 * - 桌面 Chrome / Edge 的 UA 里也带 `Safari/537.36`（WebKit 血统），只看
 *   `Safari/` 会把它们全判成 Safari；
 * - iOS 上的 Chrome / Firefox / Edge 是 `CriOS` / `FxiOS` / `EdgiOS` 套壳，
 *   同样带 `Safari/`，但**没有**「添加到主屏幕」。
 *
 * 这个判断只服务于 iOS 分支：iOS 上只有真 Safari 有那个菜单项。
 */
export function isSafariUserAgent(userAgent: string): boolean {
  if (!/Safari\//.test(userAgent)) return false;
  // 桌面 / Android 的 Chromium 系与 iOS 上的套壳浏览器都不是 Safari
  return !/CriOS|FxiOS|EdgiOS|OPiOS|mercury|GSA\/|Chrome\/|Chromium\/|Android/.test(userAgent);
}

/**
 * iOS 指引的文案。用 `navigator.share` 的实际图标名，不写「分享按钮」了事——
 * 用户要能在工具栏里认出那个方框加向上箭头。
 */
export const IOS_INSTALL_STEPS = [
  "点 Safari 工具栏的「分享」按钮",
  "在菜单里选「添加到主屏幕」",
  "点右上角「添加」",
] as const;

/**
 * 抢在 React 之前接住 `beforeinstallprompt` 的内联脚本（BLF-1448）。
 *
 * 实测事件在 ~78ms 触发，而 React 挂载后 `useEffect` 才注册监听——
 * 那时事件早就派发完了，组件永远读到「不能装」。所以这段脚本要放进 `<head>`，
 * 在首屏任何模块之前执行。
 *
 * 必须 `preventDefault()`：不拦的话 Chrome 会自行处理，部分版本里事件被吞掉，
 * 页面的 `prompt()` 就永远拿不到那个 deferred 对象。
 *
 * 脚本幂等：React 严格模式或静态导出重复插入时不会叠加监听。
 * 单独放成字符串常量，是为了让 node 环境的测试能直接断言这段源码。
 */
export const INSTALL_CAPTURE_SCRIPT = `
(function () {
  if (window.__installPromptCapture) return;
  window.__installPromptCapture = function () {};
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.__deferredInstallPrompt = event;
    window.dispatchEvent(new Event('deferredinstallprompt'));
  });
  window.addEventListener('appinstalled', function () {
    window.__deferredInstallPrompt = undefined;
    window.dispatchEvent(new Event('deferredinstallprompt'));
  });
})();
`.trim();
