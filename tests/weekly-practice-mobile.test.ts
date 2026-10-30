import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("每周练习手机阅读版", () => {
  const page = read("app/library/[slug]/page.tsx");
  const drill = read("components/TabDrill.tsx");
  const staff = read("components/TabStaff.tsx");
  const weekOne = read("content/lessons/week-1-finger-independence.html");
  const weekTwo = read("content/lessons/week-2-alternate-picking.html");

  it("手机页头只保留周次，说明与元数据后置", () => {
    expect(page).toContain('const isWeeklyPractice = lesson.series?.id === "finger-training-weeks";');
    expect(page).toContain('<span className="sm:hidden">{lesson.series?.label ?? lesson.title}</span>');
    expect(page).toContain('className="mt-4 measure text-body text-ink-700 text-pretty max-sm:hidden"');
    expect(page).toContain("text-meta text-ink-500 max-sm:hidden");
  });

  it("曲谱排在练习说明之前，说明在手机上默认折叠", () => {
    for (const content of [weekOne, weekTwo]) {
      expect(content.indexOf("<lesson-widget")).toBeLessThan(content.indexOf("<details"));
      expect(content).toContain('<details class="lesson-focus__notes">');
      expect(content).toContain("<summary>练习说明</summary>");
    }
  });

  it("手机练习卡去掉重复标题、摘要、段落提示和图注", () => {
    expect(drill).toContain("flex flex-wrap items-start justify-between gap-4 max-sm:hidden");
    expect(drill).toContain("text-meta leading-relaxed text-ink-700 max-sm:hidden");
    expect(drill).toContain("text-body text-ink-700 text-pretty max-sm:hidden");
    expect(drill).toContain("mt-3 hidden border-l-2 border-control-edge pl-3 sm:block");
    expect(staff).toContain("text-meta text-ink-500 max-sm:hidden");
  });

  it("手机 TAB 纵向分行，桌面才允许横向滚动", () => {
    expect(staff).toContain('className="flex flex-col gap-2 sm:hidden"');
    expect(staff).toContain('className="hidden sm:block"');
    expect(staff).toContain('className="-mx-1 overflow-x-auto px-1"');
    expect(staff.indexOf("sm:hidden")).toBeLessThan(staff.indexOf("overflow-x-auto"));
  });
});
