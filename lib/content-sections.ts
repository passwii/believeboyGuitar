import { WIDGET_NAMES, type WidgetName } from "@/content/widgets";

/**
 * 把一篇正文拆成「纯文本段」与「交互组件」两类片段，
 * 让正文可以自己决定组件插在哪个位置。
 */

export type ContentSection =
  | { kind: "prose"; html: string }
  | { kind: "widget"; name: WidgetName };

const MARKER = /<lesson-widget\s+name="([^"]+)"\s*>\s*<\/lesson-widget>/g;
const ARTICLE_WRAPPER = /^\s*<article\b[^>]*>([\s\S]*)<\/article>\s*$/i;

/** 去掉正文最外层的 <article>，只留下它可以放进别处的内部片段 */
export function stripArticleWrapper(html: string): string {
  const match = ARTICLE_WRAPPER.exec(html);
  return (match ? match[1] : html).trim();
}

/** 正文里出现的组件名，按出现顺序返回（含未注册的名字，交给校验函数报错） */
export function widgetMarkerNames(html: string): string[] {
  return [...html.matchAll(MARKER)].map((match) => match[1]);
}

export function splitContentSections(html: string): ContentSection[] {
  const body = stripArticleWrapper(html);
  const sections: ContentSection[] = [];
  let cursor = 0;

  for (const match of body.matchAll(MARKER)) {
    const start = match.index;
    const prose = body.slice(cursor, start).trim();
    if (prose !== "") sections.push({ kind: "prose", html: prose });

    const name = match[1];
    // 用 find 取回窄化后的元素本身，避免 `as WidgetName` 断言：
    // 命中则 name 的类型就是 WidgetName，未命中则抛错。
    const widget = WIDGET_NAMES.find((candidate) => candidate === name);
    if (!widget) {
      throw new Error(`正文引用了未注册的组件：${name}`);
    }
    sections.push({ kind: "widget", name: widget });

    cursor = start + match[0].length;
  }

  const tail = body.slice(cursor).trim();
  if (tail !== "") sections.push({ kind: "prose", html: tail });

  return sections;
}
