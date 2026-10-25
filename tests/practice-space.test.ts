import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lessons, practice } from "@/content/manifest";
import { SITE } from "@/content/site";
import { summarizeTabSections, tabSummaryText, WEEK1_SECTIONS } from "@/lib/tab-exercises";

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

  it("练习卡片排在知识、工具与节拍器之前", () => {
    const practice = home.indexOf('id="home-practice"');
    const knowledge = home.indexOf('id="home-knowledge"');
    const tools = home.indexOf('id="home-tools"');
    const metronome = home.indexOf('id="home-metronome"');
    expect(practice).toBeGreaterThan(-1);
    expect(practice).toBeLessThan(knowledge);
    expect(knowledge).toBeLessThan(tools);
    expect(tools).toBeLessThan(metronome);
  });

  it("分类卡片是图标 + 名称，不再靠一行行文字说明", () => {
    for (const id of ["practice", "knowledge", "tools", "metronome"]) {
      expect(home).toContain(`<SectionIcon id="${id}"`);
    }
  });

  it("本周练习来自 manifest，目标只在练习页读一次", () => {
    expect(home).toContain("practice.current");
    expect(home).toContain("WEEK1_SECTIONS");
    // 目标不在首页重复摊开：详情在 /practice，数据仍只有 manifest 一份
    expect(home).not.toContain("practice.goals");
    // 首页是入口，不再有导语段落
    expect(home).not.toContain("把收集到的资料整理改写成");
  });

  it("首页不再有区块小标签（eyebrow）与编号行", () => {
    expect(home).not.toContain("text-micro");
    expect(home).not.toContain("padStart(2");
  });
});

describe("曲谱摘要由谱面推出，不是页面里的字面量", () => {
  it("第 1 周的条数、速度、弦与品位都从数据算出来", () => {
    const summary = summarizeTabSections(WEEK1_SECTIONS);
    expect(summary.count).toBe(WEEK1_SECTIONS.length);

    const bpms = [...new Set(WEEK1_SECTIONS.map((section) => section.bpm))];
    expect(summary.bpm).toBe(bpms.length === 1 ? bpms[0] : null);

    const notes = WEEK1_SECTIONS.flatMap((section) =>
      section.measures.flatMap((measure) => measure.notes),
    );
    const frets = notes.map((note) => note.fret);
    const strings = notes.map((note) => note.string);
    expect(summary.frets).toBe(`${Math.min(...frets)}–${Math.max(...frets)}`);
    const stringRange =
      Math.min(...strings) === Math.max(...strings)
        ? `${strings[0]}`
        : `${Math.min(...strings)}–${Math.max(...strings)}`;
    expect(summary.strings).toBe(stringRange);
  });

  it("换一组练习，摘要跟着变（不会把第 1 周写死）", () => {
    const shifted = WEEK1_SECTIONS.map((section) => ({
      ...section,
      bpm: section.bpm + 20,
      measures: section.measures.map((measure) => ({
        notes: measure.notes.map((note) => ({ ...note, fret: (note.fret + 2) as typeof note.fret })),
      })),
    }));
    const summary = summarizeTabSections(shifted);
    expect(summary.bpm).toBe(WEEK1_SECTIONS[0].bpm + 20);
    expect(tabSummaryText(summary)).not.toBe(tabSummaryText(summarizeTabSections(WEEK1_SECTIONS)));
    expect(tabSummaryText(summary)).toContain("♩=");
  });

  it("首页与曲谱卡都不再手写品位字面量", () => {
    for (const file of ["app/page.tsx", "components/TabExercise.tsx"]) {
      const source = read(file);
      expect(source, `${file} 又写死了品位`).not.toMatch(/6 弦 5[–-]8 品/);
      expect(source, `${file} 又写死了速度`).not.toMatch(/♩=100/);
    }
  });
});

describe("练习空间 /practice", () => {
  const page = read("app/practice/page.tsx");

  it("不再是跳转壳，而是一页练习", () => {
    expect(page).not.toContain('httpEquiv="refresh"');
    expect(page).toContain("<TabExercise");
    expect(page).toContain("<PracticePlanner");
  });

  it("本周目标与首页读的是同一份 manifest 数据", () => {
    expect(page).toContain("practice.goals");
    expect(practice.goals.length).toBeGreaterThan(0);
    for (const goal of practice.goals) {
      expect(goal.title.trim()).not.toBe("");
    }
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
