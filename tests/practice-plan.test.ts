import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticePlanner } from "@/components/PracticePlanner";
import {
  DEFAULT_DURATION,
  PRACTICE_DURATIONS,
  SEGMENT_RATIOS,
  TECHNIQUE_GOALS,
  allocateSegmentMinutes,
  buildPracticePlan,
  normalizeSongTitle,
  planSummary,
  planStatus,
  type SegmentMinutes,
} from "@/lib/practice-plan";

/**
 * 练习计划页的纯逻辑与结构守护。
 *
 * 纯逻辑集中在 `lib/practice-plan.ts`：时长换算、比例、段落做法、纪律文案。
 * 组件只负责交互与排版，所以这里能覆盖的纯函数行为都直接测纯函数。
 */

const root = process.cwd();

function sumMinutes(minutes: SegmentMinutes): number {
  return minutes.warmup + minutes.technique + minutes.repertoire + minutes.free;
}

describe("段落比例", () => {
  it("热身 15% / 技术 40% / 曲目 30% / 自由弹 15%", () => {
    expect(SEGMENT_RATIOS.map((segment) => segment.id)).toEqual([
      "warmup",
      "technique",
      "repertoire",
      "free",
    ]);
    expect(SEGMENT_RATIOS.map((segment) => segment.ratio)).toEqual([0.15, 0.4, 0.3, 0.15]);
    // 四段比例之和为 1，分钟数分配才有意义
    const total = SEGMENT_RATIOS.reduce((sum, segment) => sum + segment.ratio, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("自由弹不可省（它决定你还愿不愿意回来）", () => {
    expect(SEGMENT_RATIOS.find((segment) => segment.id === "free")?.ratio).toBeGreaterThan(0);
  });
});

describe("allocateSegmentMinutes", () => {
  it("20 分钟的分配", () => {
    expect(allocateSegmentMinutes(20)).toEqual({
      warmup: 3,
      technique: 8,
      repertoire: 6,
      free: 3,
    });
  });

  it("40 分钟的分配", () => {
    expect(allocateSegmentMinutes(40)).toEqual({
      warmup: 6,
      technique: 16,
      repertoire: 12,
      free: 6,
    });
  });

  it("60 分钟的分配", () => {
    expect(allocateSegmentMinutes(60)).toEqual({
      warmup: 9,
      technique: 24,
      repertoire: 18,
      free: 9,
    });
  });

  it("任何时长下各段之和恒等于总时长", () => {
    for (let total = 0; total <= 180; total += 1) {
      expect(sumMinutes(allocateSegmentMinutes(total)), `${total} 分钟`).toBe(total);
    }
  });

  it("技术段始终是最长的一段", () => {
    for (const total of [20, 40, 60, 15, 35, 55]) {
      const minutes = allocateSegmentMinutes(total);
      expect(minutes.technique).toBeGreaterThanOrEqual(minutes.warmup);
      expect(minutes.technique).toBeGreaterThanOrEqual(minutes.repertoire);
      expect(minutes.technique).toBeGreaterThanOrEqual(minutes.free);
    }
  });

  it("总时长够四段时，不把整段时间丢给第一段（没有 0 分钟的段）", () => {
    for (const total of [4, 5, 7, 10, 20, 40, 60]) {
      const minutes = allocateSegmentMinutes(total);
      for (const value of Object.values(minutes)) {
        expect(value, `${total} 分钟`).toBeGreaterThan(0);
      }
    }
  });

  it("不足四段时允许出现 0 分钟，但总和仍等于总时长", () => {
    const minutes = allocateSegmentMinutes(3);
    expect(sumMinutes(minutes)).toBe(3);
    expect(Math.max(...Object.values(minutes))).toBeLessThanOrEqual(2);
  });

  it("非法输入回落到全零，不产生负数分钟", () => {
    expect(allocateSegmentMinutes(0)).toEqual({
      warmup: 0,
      technique: 0,
      repertoire: 0,
      free: 0,
    });
    expect(allocateSegmentMinutes(-10)).toEqual({
      warmup: 0,
      technique: 0,
      repertoire: 0,
      free: 0,
    });
    expect(allocateSegmentMinutes(Number.NaN)).toEqual({
      warmup: 0,
      technique: 0,
      repertoire: 0,
      free: 0,
    });
  });
});

describe("buildPracticePlan", () => {
  it("按热��� → 技术 → 曲目 → 自由弹的顺序给出四段", () => {
    const plan = buildPracticePlan({ totalMinutes: 40 });
    expect(plan.segments.map((segment) => segment.name)).toEqual([
      "热身",
      "技术练习",
      "曲目",
      "自由弹",
    ]);
  });

  it("各段分钟数之和等于总时长", () => {
    for (const total of PRACTICE_DURATIONS) {
      const plan = buildPracticePlan({ totalMinutes: total });
      const sum = plan.segments.reduce((acc, segment) => acc + segment.minutes, 0);
      expect(sum).toBe(total);
    }
  });

  it("每段都给出具体做法，不只是一句标题", () => {
    const plan = buildPracticePlan({ totalMinutes: 40 });
    for (const segment of plan.segments) {
      expect(segment.steps.length, segment.name).toBeGreaterThan(0);
      for (const step of segment.steps) expect(step.length).toBeGreaterThan(4);
    }
  });

  it("技术段包含慢练的判定与恒定速度", () => {
    const plan = buildPracticePlan({ totalMinutes: 40 });
    const technique = plan.segments.find((segment) => segment.id === "technique");
    const text = technique?.steps.join("\n") ?? "";
    expect(text).toContain("60%");
    expect(text).toContain("5 BPM");
    expect(text).toContain("零错误");
    expect(text).toContain("同一个速度");
  });

  it("勾选的技术项各自带一条具体做法，未勾选的不会出现", () => {
    const plan = buildPracticePlan({
      totalMinutes: 40,
      techniques: ["bend", "chord-change"],
    });
    const technique = plan.segments.find((segment) => segment.id === "technique");
    const text = technique?.steps.join("\n") ?? "";

    expect(plan.techniqueLabels).toEqual(["推弦", "和弦转换"]);
    expect(text).toContain("推弦");
    expect(text).toContain("和弦转换");
    expect(text).not.toContain("揉弦");
    expect(text).not.toContain("交替拨弦");
  });

  it("没有勾选技术项时，仍然给出一段可执行的技术段", () => {
    const plan = buildPracticePlan({ totalMinutes: 40 });
    const technique = plan.segments.find((segment) => segment.id === "technique");
    const text = technique?.steps.join("\n") ?? "";
    expect(text).toContain("本周焦点");
    expect(plan.techniqueLabels).toEqual([]);
  });

  it("未登记的技术项被忽略", () => {
    const plan = buildPracticePlan({
      totalMinutes: 40,
      techniques: ["bend", "tapping" as never],
    });
    expect(plan.techniqueLabels).toEqual(["推弦"]);
  });

  it("曲名会去掉首尾空格，并出现在曲目段里", () => {
    const plan = buildPracticePlan({ totalMinutes: 40, songTitle: "  Little Wing  " });
    expect(plan.songTitle).toBe("Little Wing");
    const repertoire = plan.segments.find((segment) => segment.id === "repertoire");
    expect(repertoire?.steps.join("\n")).toContain("《Little Wing》");
  });

  it("曲名留空时曲目段仍然成立", () => {
    const plan = buildPracticePlan({ totalMinutes: 40, songTitle: "   " });
    expect(plan.songTitle).toBe("");
    const repertoire = plan.segments.find((segment) => segment.id === "repertoire");
    const text = repertoire?.steps.join("\n") ?? "";
    expect(text).toContain("挑一首");
    expect(text).not.toContain("《");
  });

  it("曲目段包含拆解与录音回听的做法", () => {
    const plan = buildPracticePlan({ totalMinutes: 40 });
    const repertoire = plan.segments.find((segment) => segment.id === "repertoire");
    const text = repertoire?.steps.join("\n") ?? "";
    expect(text).toContain("重音");
    expect(text).toContain("录");
    expect(text).toContain("保养曲");
  });

  it("自由弹段包含关掉节拍器与收尾完整弹一遍", () => {
    const plan = buildPracticePlan({ totalMinutes: 40 });
    const free = plan.segments.find((segment) => segment.id === "free");
    const text = free?.steps.join("\n") ?? "";
    expect(text).toContain("关掉节拍器");
    expect(text).toContain("弹一遍");
  });

  it("短时长（20 分钟）的热身段给出精简做法", () => {
    const short = buildPracticePlan({ totalMinutes: 20 });
    const warmup = short.segments.find((segment) => segment.id === "warmup");
    expect(warmup?.steps.length).toBeLessThan(
      buildPracticePlan({ totalMinutes: 60 }).segments.find((s) => s.id === "warmup")?.steps.length ??
        0,
    );
  });
});

describe("planSummary", () => {
  it("先给结果：总时长、技术与曲目", () => {
    const plan = buildPracticePlan({
      totalMinutes: 40,
      techniques: ["vibrato"],
      songTitle: "Blackbird",
    });
    const summary = planSummary(plan);
    expect(summary).toContain("40 分钟");
    expect(summary).toContain("揉弦");
    expect(summary).toContain("《Blackbird》");
  });

  it("未指定的项目写明「未指定」，不留空", () => {
    const summary = planSummary(buildPracticePlan({ totalMinutes: 20 }));
    expect(summary).toContain("未指定");
  });
});

describe("planStatus", () => {
  it("播报结构性的变化", () => {
    const plan = buildPracticePlan({ totalMinutes: 40, techniques: ["vibrato"] });
    expect(planStatus(plan)).toContain("40 分钟");
    expect(planStatus(plan)).toContain("揉弦");
  });

  it("不含曲名：曲名由输入框自己读出来，摘要不再重复", () => {
    const plan = buildPracticePlan({ totalMinutes: 40, songTitle: "Blackbird" });
    expect(planStatus(plan)).not.toContain("Blackbird");
    // 可见摘要里仍然有曲名
    expect(planSummary(plan)).toContain("《Blackbird》");
  });
});

describe("normalizeSongTitle", () => {
  it("去掉首尾空格", () => {
    expect(normalizeSongTitle("  想你  ")).toBe("想你");
    expect(normalizeSongTitle("   ")).toBe("");
    expect(normalizeSongTitle("")).toBe("");
  });
});

describe("组件结构", () => {
  const html = renderToStaticMarkup(createElement(PracticePlanner));

  it("时长用分段控件表达，选中态由 aria-pressed 承担", () => {
    expect(html).toContain("segment-track");
    expect(html.match(/class="segment"/g) ?? []).toHaveLength(PRACTICE_DURATIONS.length);
    expect(html.match(/aria-pressed="/g) ?? []).toHaveLength(PRACTICE_DURATIONS.length);
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(1);
    expect(html).toContain(`${DEFAULT_DURATION} 分钟`);
  });

  it("技术项是真实的 checkbox，不是 div 假装", () => {
    const checkboxes = html.match(/<input\b[^>]*type="checkbox"/g) ?? [];
    expect(checkboxes).toHaveLength(TECHNIQUE_GOALS.length);
    for (const goal of TECHNIQUE_GOALS) {
      expect(html).toContain(`id="practice-technique-${goal.id}"`);
      expect(html).toContain(`for="practice-technique-${goal.id}"`);
    }
  });

  it("每个 checkbox 都有可访问名（label 关联）", () => {
    for (const goal of TECHNIQUE_GOALS) {
      const id = `practice-technique-${goal.id}`;
      const label = html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`));
      expect(label, id).not.toBeNull();
      expect(label?.[1]).toContain(goal.label);
    }
  });

  it("曲名输入框有 label 关联", () => {
    expect(html).toContain('for="practice-song-title"');
    expect(html).toContain('id="practice-song-title"');
  });

  it("结果区是条目式列表，不是卡片墙", () => {
    expect(html).toContain("<ol");
    expect((html.match(/<li\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(html).not.toMatch(/rounded-card/);
  });

  it("四段按热身在前的顺序出现", () => {
    // 只看结果区：页面上方还有一个提到「交替拨弦」的提示文案，会干扰全文搜索
    const planHtml = html.slice(html.indexOf("今天的安排"));
    const order = ["热身", "技术练习", "曲目", "自由弹"].map((name) => planHtml.indexOf(name));
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("有 role=status 的播报区与一行可见摘要", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('class="sr-only"');
    // 可见摘要给出完整信息（含曲名），播报区只给结构性变化
    expect(html).toContain("共 40 分钟 · 技术：未指定 · 曲目：未指定");
    expect(html).toContain("共 40 分钟 · 技术：未指定");
  });
});

describe("页面外壳", () => {
  const source = readFileSync(path.join(root, "app", "practice", "page.tsx"), "utf8");

  it("使用统一的页面外壳与阅读列", () => {
    expect(source).toContain('<main className="shell flex-1 pt-4 pb-10 sm:py-14">');
    // 练习页是操作页：用比阅读列宽一档的 .sheet，TAB 谱在桌面不用横向滑动
    expect(source).toContain("sheet");
  });

  it("页头是图标 + 紧凑标题 + 周次胶囊，不再用区块小标签", () => {
    // 视觉重设计（BLF-1452 评论）：眉标（eyebrow）退场，区块标题自己说话
    expect(source).toContain("<SectionIcon id=\"practice\"");
    expect(source).toContain("text-title font-display");
    expect(source).not.toContain("text-micro");
    expect(source).not.toContain("font-mono text-micro");
  });

  it("没有任意字号与内联样式", () => {
    expect(source.match(/\btext-\[[^\]]+\]/g)).toBeNull();
    expect(source).not.toMatch(/\sstyle\s*=/);
  });

  it("练习页只留目标、曲谱与计划三块", () => {
    expect(source).toContain("<TabExercise");
    expect(source).toContain("<PracticePlanner");
    expect(source).not.toContain("DISCIPLINES");
    expect(source).not.toContain("CAVEATS");
  });
});
