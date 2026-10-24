import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lessons, practice } from "@/content/manifest";
import { SITE } from "@/content/site";
import { WEEK1_SECTIONS } from "@/lib/tab-exercises";

/**
 * Stage 1 的守护（BLF-1452）：首页第一分类是「练习」，练习页只留
 * 目标 / 曲谱 / 计划三块，练习计划不再是工具间里的一个工具。
 *
 * 这一轮重设计的重点是「删优先于加」：页面变短、说明文案退场，
 * 但数据仍只有一份来源——本周练哪一节来自 manifest 的 practice，
 * 曲谱来自 lib/tab-exercises.ts，站点名来自 content/site.ts。
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("站点身份只有一个来源", () => {
  it("改名后的站名不再是旧名", () => {
    expect(SITE.name).toBe("琴房");
    for (const file of [
      "app/layout.tsx",
      "app/manifest.ts",
      "app/page.tsx",
      "components/SiteNav.tsx",
      "components/SiteFooter.tsx",
      "components/Metronome.tsx",
    ]) {
      expect(read(file), `${file} 还写着旧站名`).not.toContain("电吉他学习资料库");
    }
  });
});

describe("首页：练习是第一分类", () => {
  const home = read("app/page.tsx");

  it("练习区块排在知识与工具之前", () => {
    const practice = home.indexOf('id="practice-heading"');
    const knowledge = home.indexOf('id="knowledge-heading"');
    const tools = home.indexOf('id="tools-heading"');
    expect(practice).toBeGreaterThan(-1);
    expect(practice).toBeLessThan(knowledge);
    expect(knowledge).toBeLessThan(tools);
  });

  it("本周练习与目标都来自 manifest，不在页面里另写一份", () => {
    expect(home).toContain("practice.current");
    expect(home).toContain("practice.goals");
    expect(home).toContain("WEEK1_SECTIONS");
    // 首页是入口，不再有导语段落
    expect(home).not.toContain("把收集到的资料整理改写成");
  });
});

describe("练习空间 /practice", () => {
  const page = read("app/practice/page.tsx");

  it("不再是跳转壳，而是一页练习", () => {
    expect(page).not.toContain('httpEquiv="refresh"');
    expect(page).toContain("<TabExercise");
    expect(page).toContain("<PracticePlanner");
  });

  it("本周练哪一节登记在 manifest，且指向真实的资料", () => {
    expect(practice.current.week).toBeGreaterThan(0);
    expect(practice.current.title.trim()).not.toBe("");
    const slugs = lessons.map((lesson) => lesson.slug);
    expect(slugs).toContain(practice.current.lessonSlug);
    expect(read("app/library/[slug]/page.tsx")).toContain(
      "lessons.map((lesson) => ({ slug: lesson.slug }))",
    );
  });

  it("每条练习都带基本要求与注释（曲谱区完整呈现）", () => {
    expect(WEEK1_SECTIONS.length).toBeGreaterThan(0);
    for (const section of WEEK1_SECTIONS) {
      expect(section.focus.trim(), `${section.id} 缺少要求`).not.toBe("");
      expect(section.tip.trim(), `${section.id} 缺少注释`).not.toBe("");
      expect(section.measures.length).toBeGreaterThan(0);
    }
    const tab = read("components/TabExercise.tsx");
    expect(tab).toContain("section.focus");
    expect(tab).toContain("section.tip");
    expect(tab).toContain("<TabStaff");
  });
});

describe("练习计划不再是工具间的工具", () => {
  it("/tools/practice 变成指向 /practice 的跳转壳", () => {
    const shell = read("app/tools/practice/page.tsx");
    expect(shell).toContain('content="0;url=/practice"');
    expect(shell).toContain('href="/practice"');
    expect(shell).toContain('canonical: "/practice"');
  });

  it("工具清单里不再有练习计划", () => {
    const tools = read("components/ToolPages.tsx");
    expect(tools).not.toContain("/tools/practice");
  });
});
