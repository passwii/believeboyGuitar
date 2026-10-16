export type LessonHeading = { id: string; title: string };

const BASIC_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function headingText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (entity, value: string) => {
        if (!value.startsWith("#")) return BASIC_ENTITIES[value.toLowerCase()];
        const hex = value[1].toLowerCase() === "x";
        const codePoint = Number.parseInt(value.slice(hex ? 2 : 1), hex ? 16 : 10);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}

// 仅处理 sanitizeContentHtml 清理过的仓库正文，非通用 HTML 解析或清理器。
export function addLessonHeadingIds(html: string): {
  html: string;
  headings: LessonHeading[];
} {
  const headings: LessonHeading[] = [];
  const result = html.replace(
    /<h2\b([^>]*)>([\s\S]*?)<\/h2\s*>/gi,
    (_, attributes: string, body: string) => {
      const id = `lesson-heading-${headings.length + 1}`;
      const withoutId = attributes
        .replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .trimEnd();
      headings.push({ id, title: headingText(body) });
      return `<h2${withoutId} id="${id}">${body}</h2>`;
    },
  );

  return { html: result, headings };
}

export function shouldShowLessonToc(headings: LessonHeading[]): boolean {
  return headings.length >= 6;
}
