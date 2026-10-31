import type { PracticeWeek } from "@/content/manifest";
import { widgetMarkerNames } from "@/lib/content-sections";
import { WIDGET_NAMES } from "@/content/widgets";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_IN_CONTENT = [
  { pattern: /<script\b/i, message: "不得包含 <script>" },
  { pattern: /<style\b/i, message: "不得包含 <style>" },
  { pattern: /<link\b/i, message: "不得包含 <link>" },
  { pattern: /\sstyle\s*=/i, message: "不得包含行内 style 属性" },
] as const;

export function validatePracticeWeek(week: PracticeWeek): string[] {
  const issues: string[] = [];
  if (!SLUG_PATTERN.test(week.slug)) {
    issues.push(`slug 应为小写 kebab-case：${week.slug}`);
  }
  if (week.label.trim() === "") issues.push(`${week.slug}：label 不能为空`);
  if (week.title.trim() === "") issues.push(`${week.slug}：title 不能为空`);
  if (week.focus.trim() === "") issues.push(`${week.slug}：focus 不能为空`);
  return issues;
}

export function checkManifestAgainstFiles(
  weeks: readonly PracticeWeek[],
  files: readonly string[],
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const week of weeks) {
    if (seen.has(week.slug)) issues.push(`slug 重复：${week.slug}`);
    seen.add(week.slug);
  }

  const expected = new Set(weeks.map((week) => `${week.slug}.html`));
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
    if (rule.pattern.test(html)) issues.push(`${slug}：内容文件${rule.message}`);
  }
  if (!/<article\b/i.test(html)) issues.push(`${slug}：内容文件缺少 <article> 根元素`);
  if (!/<\/article>/i.test(html)) issues.push(`${slug}：内容文件 <article> 未闭合`);
  for (const name of widgetMarkerNames(html)) {
    if (!(WIDGET_NAMES as readonly string[]).includes(name)) {
      issues.push(`${slug}：正文引用了未注册的组件：${name}`);
    }
  }
  return issues;
}

export function runContentCheck(input: {
  weeks: readonly PracticeWeek[];
  files: readonly string[];
  readHtml: (slug: string) => string;
}): string[] {
  const issues = input.weeks.flatMap(validatePracticeWeek);
  issues.push(...checkManifestAgainstFiles(input.weeks, input.files));
  for (const week of input.weeks) {
    if (input.files.includes(`${week.slug}.html`)) {
      issues.push(...validateContentHtml(input.readHtml(week.slug), week.slug));
    }
  }
  return issues;
}
