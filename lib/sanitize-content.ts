/**
 * 正文渲染前的最后一道闸。
 *
 * content/lessons/*.html 是仓库里手写的、进过版本库的文件，不是用户输入；
 * 但它最终会被 `dangerouslySetInnerHTML` 注入页面，所以这里把
 * 「内容约定」里禁止的东西在渲染时再清一遍，而不是只靠 `npm test` 事后拦截。
 *
 * 与 lib/content-check.ts 的规则一一对应：script / style / link / 行内 style / 事件处理器。
 *
 * 被引用处：app/library/[slug]/page.tsx（渲染前清理）与 tests/sanitize-content.test.ts。
 * 注意：静态分析工具若只按「生产入口」分析，会把本文件误报为未使用——
 * 它同时被页面与测试引用，全量分析下并非死文件。
 */
export function sanitizeContentHtml(html: string): string {
  return (
    html
      // 成对出现的 script / style，连同内容一起删掉
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      // 落单的 script / style / link 标签（link 是空元素，本来就闭合不了）
      .replace(/<\/?(?:script|style|link)\b[^>]*>/gi, "")
      // 行内 style 属性
      .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      // on开头的事件处理器属性
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  );
}
