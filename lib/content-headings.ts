export type ContentHeading = { id: string; title: string };

function headingText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 给正文 H2 补稳定 id；周练不用目录，但保留锚点能力。 */
export function addLessonHeadingIds(html: string): {
  html: string;
  headings: ContentHeading[];
} {
  const headings: ContentHeading[] = [];
  const result = html.replace(
    /<h2\b([^>]*)>([\s\S]*?)<\/h2\s*>/gi,
    (_, attributes: string, body: string) => {
      const id = `practice-heading-${headings.length + 1}`;
      const withoutId = attributes
        .replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .trimEnd();
      headings.push({ id, title: headingText(body) });
      return `<h2${withoutId} id="${id}">${body}</h2>`;
    },
  );
  return { html: result, headings };
}
