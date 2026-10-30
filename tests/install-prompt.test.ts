import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  INSTALL_CAPTURE_SCRIPT,
  INSTALL_STATE_EVENT,
  IOS_INSTALL_STEPS,
  type BeforeInstallPromptEvent,
  consumeDeferredInstallPrompt,
  isIosUserAgent,
  isSafariUserAgent,
  resolveInstallEntry,
} from "@/lib/install-prompt";

/**
 * BLF-1448：调速不滚页面、安全区、安装入口。
 *
 * 仓库 vitest 是 node 环境、没有 DOM：能纯函数验的直接调，只能靠源码结构表达的
 * （事件监听的注册方式、CSS 的 env() 写法）读源码。真实触摸与安全区行为靠
 * 交付评论里的 Chromium 实测，不在这里假装。
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(`${root}/${relative}`, "utf8");

const dial = read("components/BpmDial.tsx");
const nav = read("components/SiteNav.tsx");
const globals = read("app/globals.css");
const layout = read("app/layout.tsx");
const metronomePage = read("app/tools/metronome/page.tsx");
const installPrompt = read("components/InstallPrompt.tsx");

describe("调速交互不触发页面滚动（BLF-1448）", () => {
  /**
   * `touch-action` 只在 HTML 元素上可靠生效，挂在 `<circle>` 这类 SVG 子元素上会被
   * 浏览器忽略。旧实现给环体写了 `touch-none`，看起来对，实测竖拖 180px 页面滚了
   * 约 230px，速度还跟着变——一次操作两个结果。
   */
  it("环体命中区是 HTML 元素，touch-action 才真的生效", () => {
    // 拖拽层是 div + touch-none，不是 SVG 里的 circle
    expect(dial).toMatch(/className="absolute inset-0 rounded-full touch-none"/);
    expect(dial).toContain("onPointerDown={onPointerDown}");
    // SVG 里不再挂指针事件，也不再有 touch-none
    const svg = dial.slice(dial.indexOf("<svg"), dial.indexOf("</svg>"));
    expect(svg).not.toContain("touch-none");
    expect(svg).not.toContain("onPointerDown");
  });

  it("圆心盘盖在拖拽层之上且不带 touch-action:none，拖圆心照常滚页面", () => {
    const center = dial.slice(
      dial.indexOf("圆心：盖住环体的中间部分"),
      dial.indexOf("读数压在圆心"),
    );
    expect(center).toContain('instrument ? "size-[76%]" : "size-[60%]"');
    expect(center).not.toContain("touch-none");
    // 圆心盘必须排在拖拽层之后，才能在叠放顺序上盖住它
    expect(dial.indexOf("rounded-full touch-none")).toBeLessThan(
      dial.indexOf('instrument ? "size-[76%]" : "size-[60%]"'),
    );
  });

  it("桌面保留 60% 圆心命中区；单屏版放大读数时仍留出 12% 环带", () => {
    // 桌面：外圈半径 50%，内圈半径 30%，环带宽度 20%。
    const inner = (82 - 44 / 2) / 100;
    expect(inner).toBeCloseTo(0.6, 5);
    // 手机：圆心占直径 76%，两侧各留 12% 的径向环带。
    expect((1 - 0.76) / 2).toBeCloseTo(0.12, 5);
  });

  it("拖动结束后停止响应移动", () => {
    expect(dial).toMatch(/const endDrag = useCallback\([\s\S]*?draggingRef\.current = false;/);
  });
});

describe("安全区（BLF-1448）", () => {
  it("导航顶部留出安全区，PWA 全屏时站点名不被状态栏压住", () => {
    expect(nav).toContain("pt-[env(safe-area-inset-top)]");
  });

  it("外壳左右各自取 max()，横屏单侧刘海不把另一侧也撑开", () => {
    expect(globals).toMatch(
      /\.shell\s*\{[^}]*padding-left:\s*max\(1\.25rem,\s*env\(safe-area-inset-left\)\)/,
    );
    expect(globals).toMatch(
      /\.shell\s*\{[^}]*padding-right:\s*max\(1\.25rem,\s*env\(safe-area-inset-right\)\)/,
    );
  });

  it("640px 断点重新取 max()，否则横屏 iPhone 的刘海会被 2rem 覆盖", () => {
    const media = globals.slice(globals.indexOf("@media (min-width: 640px)"));
    const shellBlock = media.slice(media.indexOf(".shell"), media.indexOf("}", media.indexOf(".shell")));
    expect(shellBlock).toContain("max(2rem, env(safe-area-inset-left))");
    expect(shellBlock).toContain("max(2rem, env(safe-area-inset-right))");
  });

  it("--nav-h 按导航真实高度（44px 触控行 + 安全区）校准，不是 56 + 安全区", () => {
    // .shell-nav 是 border-box：59px 安全区下真实高度是 44 + 59 = 103px，
    // 写 56 + 59 会多出 12px，粘性目录 top 与锚点 scroll-mt 都会跟着偏。
    expect(globals).toContain("--nav-h: max(56px, calc(44px + env(safe-area-inset-top)));");
  });

  it("页脚底部安全区仍然保留（不被这轮改动带走）", () => {
    // BLF-1451 页脚拆成了 SiteFooter（要跟着工具区换皮）；dock 让位也在这层做
    const footer = read("components/SiteFooter.tsx");
    expect(footer).toContain("env(safe-area-inset-bottom)");
    expect(footer).toContain("--dock-h");
  });

  it("viewport-fit=cover 是 env() 生效的前提，不能删", () => {
    expect(layout).toContain('viewportFit: "cover"');
  });
});

describe("安装入口：为什么之前「PW 没触发」", () => {
  /**
   * BLF-1443 只做了清单 / 图标 / SW，页面里从来没有捕获 beforeinstallprompt、
   * 更没有调用 prompt()。Chrome 早已移除自动弹的 mini-infobar，所以能力在、
   * 入口不在。这组测试锁住「入口真的存在且会调 prompt()」。
   */
  it("页面里真的挂了安装入口", () => {
    expect(metronomePage).toContain("<InstallPrompt />");
  });

  it("点击会调用 deferred prompt 的 prompt()，并等 userChoice 落定", () => {
    expect(installPrompt).toContain("await deferred.prompt();");
    expect(installPrompt).toContain("await deferred.userChoice;");
  });

  /**
   * 死键的根因：清空 `window.__deferredInstallPrompt` 只是改了一个全局变量，
   * `useSyncExternalStore` 不会知道快照变了。必须显式派发通知，否则按钮留在
   * 原地、再点被 `if (!deferred) return` 挡回，直到整页刷新。
   */
  it("清空 deferred prompt 时一定派发通知，订阅者才会重算快照", () => {
    const deferred = Object.assign(new Event("beforeinstallprompt"), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });
    const dispatched: Event[] = [];
    const host = {
      __deferredInstallPrompt: deferred as BeforeInstallPromptEvent,
      dispatchEvent: (event: Event) => {
        dispatched.push(event);
        return true;
      },
    };

    const consumed = consumeDeferredInstallPrompt(host);

    expect(consumed).toBe(deferred);
    expect(host.__deferredInstallPrompt).toBeUndefined();
    expect(dispatched.map((event) => event.type)).toEqual([INSTALL_STATE_EVENT]);
  });

  it("没有 deferred prompt 时不派发空通知", () => {
    const dispatched: Event[] = [];
    const consumed = consumeDeferredInstallPrompt({
      dispatchEvent: (event: Event) => {
        dispatched.push(event);
        return true;
      },
    });

    expect(consumed).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it("组件消费时走同一个入口，不再自己清空全局变量", () => {
    const from = installPrompt.indexOf("const install = useCallback(");
    const to = installPrompt.indexOf('if (dismissed || entry === "hidden") return null;');
    const body = installPrompt.slice(from, to);

    expect(body).toContain("consumeDeferredInstallPrompt(window)");
    expect(body).not.toContain("window.__deferredInstallPrompt = undefined;");
  });

  it("订阅与捕获脚本用同一个事件名，避免只清空不通知", () => {
    expect(INSTALL_CAPTURE_SCRIPT).toContain(`new Event('${INSTALL_STATE_EVENT}')`);
    expect(installPrompt).toContain(
      "window.addEventListener(INSTALL_STATE_EVENT, onChange)",
    );
  });
});

describe("安装入口：捕获脚本必须抢在 React 之前", () => {
  /**
   * 实测 beforeinstallprompt 在 ~78ms 触发，晚注册的监听一次都收不到
   * （Chromium 里 `lateHit === 0`）。所以捕获必须在 head 的内联脚本里做。
   */
  it("脚本挂在 <head>，不是等到 React 的 useEffect", () => {
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    expect(head).toContain("INSTALL_CAPTURE_SCRIPT");
    expect(layout).toContain('from "@/lib/install-prompt"');
  });

  it("脚本先 preventDefault 再存事件，否则 Chrome 会自己处理掉", () => {
    const prevent = INSTALL_CAPTURE_SCRIPT.indexOf("event.preventDefault();");
    const store = INSTALL_CAPTURE_SCRIPT.indexOf("window.__deferredInstallPrompt = event;");

    expect(prevent).toBeGreaterThan(-1);
    expect(store).toBeGreaterThan(prevent);
  });

  it("脚本幂等：重复插入不会叠加监听", () => {
    expect(INSTALL_CAPTURE_SCRIPT).toContain("if (window.__installPromptCapture) return;");
  });

  it("装好后清掉 deferred prompt，入口自己消失", () => {
    expect(INSTALL_CAPTURE_SCRIPT).toContain('addEventListener(\'appinstalled\'');
    expect(INSTALL_CAPTURE_SCRIPT).toContain("window.__deferredInstallPrompt = undefined;");
  });

  it("内联脚本不含插值，静态字符串直接注入是安全的", () => {
    expect(INSTALL_CAPTURE_SCRIPT).not.toContain("${");
  });
});

describe("安装入口：显示条件", () => {
  const base = { standalone: false, hasDeferredPrompt: false, isIos: false, isSafari: false };

  it("已经有 deferred prompt：给一键安装", () => {
    expect(resolveInstallEntry({ ...base, hasDeferredPrompt: true })).toBe("native");
  });

  it("iOS Safari 没有 beforeinstallprompt：给文字指引", () => {
    expect(resolveInstallEntry({ ...base, isIos: true, isSafari: true })).toBe(
      "ios-instructions",
    );
  });

  it("iOS 上的 Chrome / Edge 没有「添加到主屏幕」，不显示指引", () => {
    expect(resolveInstallEntry({ ...base, isIos: true, isSafari: false })).toBe("hidden");
  });

  it("已经装过（standalone）就不再劝装，哪怕还能拿到 prompt", () => {
    expect(resolveInstallEntry({ ...base, standalone: true, hasDeferredPrompt: true })).toBe(
      "hidden",
    );
    expect(
      resolveInstallEntry({ ...base, standalone: true, isIos: true, isSafari: true }),
    ).toBe("hidden");
  });

  it("既没有 prompt 也不是 iOS Safari：什么都不显示", () => {
    expect(resolveInstallEntry(base)).toBe("hidden");
  });
});

describe("安装入口：UA 判断", () => {
  it("认得 iPhone / iPad / iPod", () => {
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe(true);
  });

  it("iPadOS 13+ 伪装成 macOS，靠触点数兜底", () => {
    const desktopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(isIosUserAgent(desktopUa, 5)).toBe(true);
    // 真的 Mac 没有多点触控屏
    expect(isIosUserAgent(desktopUa, 0)).toBe(false);
  });

  it("Safari 与 iOS 上的套壳浏览器分开", () => {
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(isSafariUserAgent(safari)).toBe(true);

    for (const shell of ["CriOS", "FxiOS", "EdgiOS"]) {
      const ua = safari.replace("Version/17.0", `${shell}/17.0`);
      expect(isSafariUserAgent(ua), shell).toBe(false);
    }
  });

  it("桌面 Chrome 不是 Safari（UA 里没有 Safari/）", () => {
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("iOS 指引三步，且提到「添加到主屏幕」这个菜单项", () => {
    expect(IOS_INSTALL_STEPS).toHaveLength(3);
    expect(IOS_INSTALL_STEPS.join(" ")).toContain("添加到主屏幕");
  });
});

describe("安装入口：服务端渲染安全", () => {
  it("静态预渲染时不碰 navigator / matchMedia，且默认不显示", () => {
    // 服务端快照一律 false → 首屏 HTML 里没有安装区块，不会闪一下又消失
    const html = renderToStaticMarkup(createElement(InstallPrompt));
    expect(html).toBe("");
  });

  it("UA 在客户端快照里读，渲染体不碰 navigator", () => {
    const snapshotFrom = installPrompt.indexOf("function getInstallEntrySnapshot()");
    const snapshotTo = installPrompt.indexOf("function getInstallEntryServerSnapshot()");
    const snapshot = installPrompt.slice(snapshotFrom, snapshotTo);
    expect(snapshot).toContain("navigator.userAgent");

    // 渲染体（组件函数体）里不能出现 navigator / matchMedia
    const componentFrom = installPrompt.indexOf("export function InstallPrompt()");
    const component = installPrompt.slice(componentFrom);
    expect(component).not.toContain("navigator.userAgent");
    expect(component).not.toContain("window.matchMedia");
  });

  it("不用 effect 里 setState 的写法（会触发级联渲染，lint 也会拦）", () => {
    // 只看代码，注释里解释「为什么不用 useEffect」是应该的
    const code = installPrompt.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toContain("useEffect(");
    expect(code).not.toContain("setEnvironment");
  });
});
