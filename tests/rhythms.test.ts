import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RhythmPatterns } from "@/components/RhythmPatterns";
import { METERS, type Meter } from "@/lib/metronome";
import {
  FULL_PATTERN_ID,
  GRID_LENGTH,
  RHYTHM_METERS,
  RHYTHM_PATTERNS,
  accentCells,
  barCells,
  bpmAdvice,
  canvasCell,
  cellsPerBeat,
  countLabels,
  density,
  describeGrid,
  ghostCount,
  indexesOf,
  patternById,
  restCount,
  rhythmGroups,
  savedStrikes,
  sixteenthDurationMs,
  strikeCount,
  strikesInRange,
} from "@/lib/rhythms";

/**
 * 节奏型页的守护。
 *
 * 纯逻辑（lib/rhythms.ts）在这里逐条钉住；页面结构则靠服务端渲染出的
 * HTML 核对——仓库 vitest 是 node 环境，没有 DOM，能渲染就不要靠猜源码。
 */

const html = renderToStaticMarkup(createElement(RhythmPatterns));
const componentSource = readFileSync(
  new URL("../components/RhythmPatterns.tsx", import.meta.url),
  "utf8",
);

function meterByLabel(label: string): Meter {
  const found = METERS.find((meter) => meter.label === label);
  if (!found) throw new Error(`找不到拍号 ${label}`);
  return found;
}

const FOUR_FOUR = meterByLabel("4/4");
const SIX_EIGHT = meterByLabel("6/8");
const SEVEN_EIGHT = meterByLabel("7/8");

describe("节奏型表", () => {
  it("覆盖任务要求的八种节奏型", () => {
    const ids = RHYTHM_PATTERNS.map((pattern) => pattern.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "eighth-notes",
        "quarter-and-eighth",
        "samba",
        "sixteenth-full",
        "sixteenth-ghost",
        "dotted-eighth",
        "shuffle",
        "triplet-feel",
      ]),
    );
  });

  it("每个节奏型都是 16 格的 4/4 小节", () => {
    for (const pattern of RHYTHM_PATTERNS) {
      expect(pattern.cells, pattern.id).toHaveLength(GRID_LENGTH);
      expect(pattern.cells.every((cell) => cell !== undefined)).toBe(true);
    }
  });

  it("每种格子状态都被至少一个节奏型用到", () => {
    const kinds = new Set(RHYTHM_PATTERNS.flatMap((pattern) => [...pattern.cells]));
    expect(kinds).toEqual(new Set(["strike", "ghost", "rest"]));
  });

  it("十六分留白只在 e 和 a 留白，1 和 and 照常出声", () => {
    const pattern = patternById("sixteenth-ghost");
    // 口诀是 1 e & a：奇数位是 1 与 and（击弦），偶数位是 e 与 a（留白）
    pattern.cells.forEach((cell, index) => {
      const expected = index % 2 === 0 ? "strike" : "ghost";
      expect(cell, `第 ${index + 1} 格`).toBe(expected);
    });
  });

  it("十六分全弹每一格都出声", () => {
    const pattern = patternById(FULL_PATTERN_ID);
    expect(strikeCount(pattern)).toBe(GRID_LENGTH);
    expect(ghostCount(pattern)).toBe(0);
    expect(restCount(pattern)).toBe(0);
  });

  it("每个节奏型都给出建议 BPM 区间与练法", () => {
    for (const pattern of RHYTHM_PATTERNS) {
      expect(pattern.bpm[0], pattern.id).toBeGreaterThan(0);
      expect(pattern.bpm[1], pattern.id).toBeGreaterThan(pattern.bpm[0]);
      expect(pattern.practice.length, pattern.id).toBeGreaterThanOrEqual(2);
      expect(pattern.summary.length, pattern.id).toBeGreaterThan(4);
    }
  });

  it("找不到的 id 回落到第一个节奏型", () => {
    expect(patternById("nope").id).toBe(RHYTHM_PATTERNS[0].id);
  });
});

describe("击弦统计", () => {
  it("八分音符每小节 8 次击弦、密度 50%", () => {
    const pattern = patternById("eighth-notes");
    expect(strikeCount(pattern)).toBe(8);
    expect(density(pattern)).toBeCloseTo(0.5);
  });

  it("十六分全弹每小节 16 次击弦、密度 100%", () => {
    const pattern = patternById(FULL_PATTERN_ID);
    expect(strikeCount(pattern)).toBe(16);
    expect(density(pattern)).toBe(1);
  });

  it("十六分留白每小节 8 次击弦、密度 50%", () => {
    const pattern = patternById("sixteenth-ghost");
    expect(strikeCount(pattern)).toBe(8);
    expect(ghostCount(pattern)).toBe(8);
    expect(restCount(pattern)).toBe(0);
    expect(density(pattern)).toBeCloseTo(0.5);
  });

  it("留白型比全弹省下的击弦数算得对", () => {
    expect(savedStrikes(patternById("sixteenth-ghost"))).toBe(8);
    expect(savedStrikes(patternById("eighth-notes"))).toBe(8);
    expect(savedStrikes(patternById(FULL_PATTERN_ID))).toBe(0);
  });

  it("密度在限格为 0 时不除零", () => {
    expect(density(patternById("eighth-notes"), 0)).toBe(0);
  });

  it("换拍号后只统计这一小节内的格数", () => {
    const pattern = patternById("eighth-notes");
    // 6/8 一小节 12 格：1& 2& 3& 1& 2& 3& → 6 次击弦
    expect(barCells(SIX_EIGHT)).toBe(12);
    expect(strikeCount(pattern, barCells(SIX_EIGHT))).toBe(6);
  });

  it("画布始终是 16 格，超出这一小节的格子标为 outside", () => {
    const pattern = patternById("eighth-notes");
    expect(canvasCell(pattern, 0, FOUR_FOUR)).toBe("strike");
    expect(canvasCell(pattern, 11, SIX_EIGHT)).toBe("rest");
    // 6/8 只有 12 格，第 13 格起属于下一小节
    expect(canvasCell(pattern, 12, SIX_EIGHT)).toBe("outside");
    expect(canvasCell(pattern, 15, SEVEN_EIGHT)).toBe("outside");
    expect(canvasCell(pattern, 15, FOUR_FOUR)).toBe("rest");
  });
});

describe("拍号与重音", () => {
  it("4/4 一小节 16 格，重音在第 1 拍", () => {
    expect(barCells(FOUR_FOUR)).toBe(16);
    expect(cellsPerBeat(FOUR_FOUR)).toBe(4);
    expect(accentCells(patternById("sixteenth-ghost"), FOUR_FOUR)).toEqual([0]);
  });

  it("6/8 一小节 12 格，重音在第 1、4 拍", () => {
    expect(barCells(SIX_EIGHT)).toBe(12);
    expect(cellsPerBeat(SIX_EIGHT)).toBe(2);
    expect(accentCells(patternById("sixteenth-ghost"), SIX_EIGHT)).toEqual([0, 6]);
  });

  it("7/8 一小节 14 格，重音在第 1、3、5 拍", () => {
    expect(barCells(SEVEN_EIGHT)).toBe(14);
    expect(cellsPerBeat(SEVEN_EIGHT)).toBe(2);
    expect(accentCells(patternById("sixteenth-ghost"), SEVEN_EIGHT)).toEqual([0, 4, 8]);
  });

  it("节奏型自己的重音也会被标到网格上", () => {
    // 桑巴的重音在第 1、3 拍：4/4 每拍 4 格 → 第 1 格与第 9 格
    const samba = patternById("samba");
    expect(accentCells(samba, FOUR_FOUR)).toEqual([0, 8]);
  });

  it("重音与拍号重音重合时只算一格", () => {
    const pattern = patternById("sixteenth-ghost");
    const cells = accentCells(pattern, FOUR_FOUR);
    expect(cells).toEqual([...new Set(cells)]);
  });

  it("只列出放得进 16 格画布的拍号（5/4 被排除）", () => {
    const labels = RHYTHM_METERS.map((meter) => meter.label);
    expect(labels).toContain("4/4");
    expect(labels).toContain("6/8");
    expect(labels).toContain("7/8");
    expect(labels).not.toContain("5/4");
  });

  it("数拍口诀随拍号变化", () => {
    expect(countLabels(FOUR_FOUR)).toEqual([
      "1",
      "e",
      "&",
      "a",
      "2",
      "e",
      "&",
      "a",
      "3",
      "e",
      "&",
      "a",
      "4",
      "e",
      "&",
      "a",
    ]);
    expect(countLabels(SIX_EIGHT)).toEqual(["1", "&", "2", "&", "3", "&", "4", "&", "5", "&", "6", "&"]);
  });
});

describe("分组练习", () => {
  it("4/4 按拍分成四组，重音落在第一组", () => {
    const groups = rhythmGroups(FOUR_FOUR, patternById("sixteenth-ghost"));
    expect(groups).toHaveLength(4);
    expect(groups[0].description).toBe("第 1 组：重音 → 第 1 拍（十六分第 1–4 格）");
    expect(groups[1].description).toBe("第 2 组：第 2 拍（十六分第 5–8 格）");
    expect(groups[0].accent).toBe(true);
    expect(groups[1].accent).toBe(false);
  });

  it("每组都给出具体怎么练", () => {
    const groups = rhythmGroups(FOUR_FOUR, patternById("sixteenth-ghost"));
    for (const group of groups) {
      expect(group.instruction.length).toBeGreaterThan(8);
    }
    expect(groups[0].instruction).toContain("重音");
  });

  it("6/8 按重音分成 3+3 两组", () => {
    const groups = rhythmGroups(SIX_EIGHT, patternById("sixteenth-ghost"));
    expect(groups).toHaveLength(2);
    expect(groups[0].beatLabel).toBe("第 1–3 拍");
    expect(groups[1].beatLabel).toBe("第 4–6 拍");
    expect(groups[0].accent).toBe(true);
    expect(groups[1].accent).toBe(true);
  });

  it("7/8 按重音分成 2+2+3 三组", () => {
    const groups = rhythmGroups(SEVEN_EIGHT, patternById("sixteenth-ghost"));
    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.beatLabel)).toEqual([
      "第 1–2 拍",
      "第 3–4 拍",
      "第 5–7 拍",
    ]);
  });

  it("节奏型自带重音时那一组也被标成重音组（桑巴的第 3 拍）", () => {
    const groups = rhythmGroups(FOUR_FOUR, patternById("samba"));
    expect(groups[2].accent).toBe(true);
    expect(groups[1].accent).toBe(false);
  });

  it("能统计一组里有几次击弦", () => {
    const pattern = patternById("sixteenth-ghost");
    const groups = rhythmGroups(FOUR_FOUR, pattern);
    // 每组 4 格：1 和 and 出声 → 每组 2 次
    expect(strikesInRange(pattern, groups[0].startCell, groups[0].endCell)).toBe(2);
  });
});

describe("说明文案", () => {
  it("起步速度建议带上密度与提速阶梯", () => {
    const advice = bpmAdvice(patternById("sixteenth-ghost"));
    expect(advice).toContain("80 BPM");
    expect(advice).toContain("+5 BPM");
    expect(advice).toContain("50%");
  });

  it("网格的无障碍描述说清击弦、留白与重音的位置", () => {
    const description = describeGrid(patternById("sixteenth-ghost"), FOUR_FOUR);
    expect(description).toContain("十六分留白");
    expect(description).toContain("击弦在第 1、3、5、7、9、11、13、15 格");
    expect(description).toContain("留白但右手保持运动的是第 2、4、6、8、10、12、14、16 格");
    expect(description).toContain("重音在第 1 格");
  });

  it("拍号短于 4/4 时，说明末尾几格不属于这一小节", () => {
    const description = describeGrid(patternById("sixteenth-ghost"), SIX_EIGHT);
    expect(description).toContain("6/8 一小节 12 个十六分音符位");
    expect(description).toContain("末尾 4 格不属于这一小节");
  });

  it("十六分音符在 120 BPM 下只有 125 毫秒", () => {
    expect(sixteenthDurationMs(120)).toBe(125);
    expect(sixteenthDurationMs(60)).toBe(250);
    expect(sixteenthDurationMs(0)).toBe(0);
  });

  it("indexesOf 只返回指定状态的格", () => {
    const pattern = patternById("sixteenth-ghost");
    expect(indexesOf(pattern, "strike")).toHaveLength(8);
    expect(indexesOf(pattern, "rest")).toHaveLength(0);
  });
});

describe("页面结构", () => {
  it("有一个可访问名的节奏网格", () => {
    expect(html).toMatch(/role="img"[^>]*aria-label="节奏型「十六分留白」/);
  });

  it("每个节奏型都有芯片，按钮带开关语义", () => {
    const chips = [...html.matchAll(/<button\b[^>]*aria-pressed="(true|false)"[^>]*>/g)];
    expect(chips.length).toBeGreaterThanOrEqual(RHYTHM_PATTERNS.length);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("芯片与拍号都有可访问组名", () => {
    expect(html).toContain('aria-labelledby="rhythm-pattern-label"');
    expect(html).toContain('aria-labelledby="rhythm-meter-label"');
  });

  it("写清了「十六分音符不要全部实弹」这条结论", () => {
    expect(html).toContain("十六分音符不要全部实弹");
    expect(html).toContain("Sex Machine Syndrome");
    expect(html).toContain("125 毫秒");
    expect(html).toContain("右手可以一直动");
  });

  it("给出击弦密度、起步速度与分组练习", () => {
    expect(html).toContain("每小节击弦");
    expect(html).toContain("击弦密度");
    expect(html).toContain("起步速度");
    expect(html).toContain("分组练习");
    expect(html).toContain("第 1 组：重音 → 第 1 拍");
  });

  it("网格用 CSS grid，画布永远是 16 列", () => {
    expect(componentSource).toContain("grid-cols-16");
    expect(componentSource).toContain("GRID_COLUMNS");
    expect(componentSource).toContain("GRID_LENGTH");
  });

  it("窄屏时网格自己横向滚动，页面不产生横向溢出", () => {
    expect(componentSource).toContain("overflow-x-auto");
    expect(componentSource).toMatch(/min-w-\[/);
  });

  it("没有内联样式与任意字号", () => {
    expect(componentSource).not.toMatch(/\sstyle\s*=/);
    expect(componentSource).not.toMatch(/\btext-\[[^\]]+\]/);
  });

  it("可交互控件用现成的 44pt 芯片与分段类", () => {
    expect(componentSource).toContain('className="chip"');
    expect(componentSource).toContain('className="segment"');
  });
});
