"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  IOS_INSTALL_STEPS,
  INSTALL_STATE_EVENT,
  type BeforeInstallPromptEvent,
  consumeDeferredInstallPrompt,
  isIosUserAgent,
  isSafariUserAgent,
  resolveInstallEntry,
  type InstallEntry,
} from "@/lib/install-prompt";

/**
 * 安装到主屏幕的入口（BLF-1448）。
 *
 * 为什么之前「PW 没触发」：BLF-1443 只做了清单、图标和 SW，页面里从来没有
 * 捕获过 `beforeinstallprompt`、更没有调用它的 `prompt()`。Chrome 早已移除
 * 自动弹出的 mini-infobar，事件只是派发给页面，入口得页面自己画。
 * 所以安装能力一直在，用户却看不到任何入口。
 *
 * 两个实现上的坑：
 *
 * 1. **事件比 React 早**。实测 `beforeinstallprompt` 在 ~78ms 触发，而首屏
 *    按钮在 ~27ms 就已经可点——React 的 `useEffect` 晚于两者。所以在 `useEffect`
 *    里注册监听会漏掉这一次事件，页面永远显示「不能装」。这里改成
 *    `InstallPromptCapture`（挂在 `<head>` 里的内联脚本）先把事件接住并压进
 *    `window.__deferredInstallPrompt`，组件挂载后再读。
 *
 * 2. **deferred prompt 是一次性的**。`prompt()` 只能调一次，用户取消后再调
 *    会抛错，所以拿到后立刻清空。清空的同时必须派发通知：快照来源就是那个全局
 *    变量，只清空不通知的话 `useSyncExternalStore` 不会重算，按钮留在原地、
 *    再点被挡回，就成了死键。`appinstalled` 与 `display-mode` 一起作为
 *    「已经装过」的判断依据。
 *
 * 不做自动弹出：入口是页面里的一行提示，用户点了才弹系统对话框。
 * 一进页面就弹窗是最招人烦的 PWA 反模式。
 */

/** 内联脚本把事件存在这个全局键上，组件从这里读 */
declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent;
    __installPromptCapture?: () => void;
  }
}

/**
 * 安装状态的全部来源：deferred prompt、display-mode、UA。
 *
 * 合成一个快照、返回字符串而不是对象——`useSyncExternalStore` 每次渲染都会
 * 比对快照，返回新对象会导致无限重渲染；字符串按值比较，天然稳定。
 *
 * UA 也放在这里读：静态预渲染时没有 `navigator`，所以服务端快照直接给
 * `"hidden"`，客户端挂载后由同一份逻辑纠正。这样就不需要「effect 里 setState」
 * 那种会触发级联渲染的写法（`react-hooks/set-state-in-effect` 会拦）。
 */
function subscribeInstallState(onChange: () => void): () => void {
  // 内联脚本捕获到事件、或安装完成时都会派发这个自定义事件
  window.addEventListener(INSTALL_STATE_EVENT, onChange);
  window.addEventListener("appinstalled", onChange);

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);

  return () => {
    window.removeEventListener(INSTALL_STATE_EVENT, onChange);
    window.removeEventListener("appinstalled", onChange);
    displayMode.removeEventListener("change", onChange);
  };
}

function getInstallEntrySnapshot(): InstallEntry {
  const userAgent = navigator.userAgent;
  return resolveInstallEntry({
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    hasDeferredPrompt: Boolean(window.__deferredInstallPrompt),
    isIos: isIosUserAgent(userAgent, navigator.maxTouchPoints ?? 0),
    isSafari: isSafariUserAgent(userAgent),
  });
}

/** 服务端预渲染：没有 window / navigator / matchMedia，一律不显示 */
function getInstallEntryServerSnapshot(): InstallEntry {
  return "hidden";
}

export function InstallPrompt() {
  const entry = useSyncExternalStore(
    subscribeInstallState,
    getInstallEntrySnapshot,
    getInstallEntryServerSnapshot,
  );
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const install = useCallback(async () => {
    // 一次性：消费时清空并通知订阅者，入口随快照一起消失，不会变成死键
    const deferred = consumeDeferredInstallPrompt(window);
    if (!deferred) return;

    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // 用户取消、或浏览器在两次调用之间收回了权限：都不该打断页面
    }
  }, []);

  if (dismissed || entry === "hidden") return null;

  if (entry === "ios-instructions") {
    return (
      <section className="rounded-card border border-rule bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-medium text-ink-950">装到主屏幕，练习时不用再找页面</p>
            <p className="mt-1 text-meta text-ink-500">
              装好后从图标直接进节拍器，全屏、不显示地址栏。
            </p>
          </div>
          <button
            type="button"
            aria-label="不再提示安装"
            onClick={() => setDismissed(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-500 hover:text-ink-950"
          >
            ✕
          </button>
        </div>
        {iosInstructionsOpen ? (
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-meta text-ink-700">
            {IOS_INSTALL_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : (
          <button
            type="button"
            onClick={() => setIosInstructionsOpen(true)}
            className="mt-3 min-h-11 rounded-control border border-control-edge px-4 text-label font-medium text-ink-950"
          >
            看怎么装
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-card border border-rule bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-medium text-ink-950">装到主屏幕</p>
          <p className="mt-1 text-meta text-ink-500">
            全屏打开、离线可用，练习时不用再找这个页面。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void install()}
            className="min-h-11 rounded-control bg-accent-700 px-4 text-label font-medium text-on-accent"
          >
            安装
          </button>
          <button
            type="button"
            aria-label="不再提示安装"
            onClick={() => setDismissed(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-500 hover:text-ink-950"
          >
            ✕
          </button>
        </div>
      </div>
    </section>
  );
}
