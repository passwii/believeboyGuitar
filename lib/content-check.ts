import { DIFFICULTIES, STAGES, TOPICS, type Lesson } from "@/content/manifest";
import { widgetMarkerNames } from "@/lib/content-sections";
import { WIDGET_NAMES } from "@/content/widgets";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FORBIDDEN_IN_CONTENT: { pattern: RegExp; message: string }[] = [
  { pattern: /<script\b/i, message: "不得包含 <script>" },
  { pattern: /<style\b/i, message: "不得包含 <style>" },
  { pattern: /<link\b/i, message: "不得包含 <link>" },
  { pattern: /\sstyle\s*=/i, message: "不得包含行内 style 属性" },
];

export function validateLessonMetadata(lesson: Lesson): string[] {
  const issues: string[] = [];

  if (!SLUG_PATTERN.test(lesson.slug)) {
    issues.push(`slug 应为小写 kebab-case：${lesson.slug}`);
  }
  if (lesson.title.trim() === "") {
    issues.push(`${lesson.slug}：title 不能为空`);
  }
  if (lesson.summary.trim() === "") {
    issues.push(`${lesson.slug}：summary 不能为空`);
  }
  if (lesson.source.trim() === "") {
    issues.push(`${lesson.slug}：source 不能为空`);
  }
  if (!STAGES.includes(lesson.stage)) {
    issues.push(`${lesson.slug}：stage 不在允许值内：${lesson.stage}`);
  }
  if (!DATE_PATTERN.test(lesson.updatedAt)) {
    issues.push(`${lesson.slug}：updatedAt 应为 YYYY-MM-DD：${lesson.updatedAt}`);
  }
  if (!DIFFICULTIES.includes(lesson.difficulty)) {
    issues.push(`${lesson.slug}：difficulty 应为 1-5：${lesson.difficulty}`);
  }
  if (lesson.topics.length === 0) {
    issues.push(`${lesson.slug}：至少需要一个 topic`);
  }
  for (const topic of lesson.topics) {
    if (!TOPICS.includes(topic)) {
      issues.push(`${lesson.slug}：topic 不在允许值内：${topic}`);
    }
  }

  return issues;
}

export function checkManifestAgainstFiles(lessons: Lesson[], files: string[]): string[] {
  const issues: string[] = [];

  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (seen.has(lesson.slug)) {
      issues.push(`slug 重复：${lesson.slug}`);
    }
    seen.add(lesson.slug);
  }

  const expected = new Set([...seen].map((slug) => `${slug}.html`));

  for (const file of expected) {
    if (!files.includes(file)) {
      issues.push(`清单中有 ${file.replace(/\.html$/, "")}，但缺少 content/lessons/${file}`);
    }
  }
  for (const file of files) {
    if (!expected.has(file)) {
      issues.push(`存在游离内容文件（清单中无对应条目）：content/lessons/${file}`);
    }
  }

  return issues;
}

export function validateContentHtml(html: string, slug: string): string[] {
  const issues: string[] = [];

  for (const rule of FORBIDDEN_IN_CONTENT) {
    if (rule.pattern.test(html)) {
      issues.push(`${slug}：内容文件${rule.message}`);
    }
  }
  if (!/<article\b/i.test(html)) {
    issues.push(`${slug}：内容文件缺少 <article> 根元素`);
  }
  if (!/<\/article>/i.test(html)) {
    issues.push(`${slug}：内容文件 <article> 未闭合`);
  }
  for (const name of widgetMarkerNames(html)) {
    if (!(WIDGET_NAMES as readonly string[]).includes(name)) {
      issues.push(`${slug}：正文引用了未注册的组件：${name}`);
    }
  }

  return issues;
}

export function runContentCheck(input: {
  lessons: Lesson[];
  files: string[];
  readHtml: (slug: string) => string;
}): string[] {
  const issues: string[] = [];

  for (const lesson of input.lessons) {
    issues.push(...validateLessonMetadata(lesson));
  }

  issues.push(...checkManifestAgainstFiles(input.lessons, input.files));

  for (const lesson of input.lessons) {
    if (input.files.includes(`${lesson.slug}.html`)) {
      issues.push(...validateContentHtml(input.readHtml(lesson.slug), lesson.slug));
    }
  }

  return issues;
}
