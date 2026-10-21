import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MetronomeGuide } from "@/components/MetronomeGuide";
import {
  GUIDE_CLOSING,
  GUIDE_HISTORY_NOTE,
  GUIDE_LEAD,
  GUIDE_SECTIONS,
} from "@/lib/metronome-guide";

/**
 * 节拍器页面「配套指引」的守护。
 *
 * 依据 research/practice.md §4 的 M1–M10：调研结论是现有功能全部支持、
 * 只需要补文案。所以这里守的是「文案还在、关键条目没丢」，
 * 而不是某个交互控件的存在。
 */

const source = readFileSync(new URL("../components/MetronomeGuide.tsx", import.meta.url), "utf8");
const html = renderToStaticMarkup(createElement(MetronomeGuide));

/** 全部要点的纯文本 */
const allItems = GUIDE_SECTIONS.flatMap((section) => section.items);
const allText = [GUIDE_LEAD, ...GUIDE_SECTIONS.map((s) => s.summary), ...allItems.map((i) => `${i.title}${i.body}`), GUIDE_HISTORY_NOTE, GUIDE_CLOSING].join("\n");

describe("区块结构", () => {
  it("渲染出「配套指引」标题与三小节", () => {
    expect(html).toContain("配套指引");
    expect(html).toContain('id="metronome-guide-heading"');
    for (const section of GUIDE_SECTIONS) {
      expect(html).toContain(section.title);
    }
  });

  it("三个小节就是「速度标尺」「分组锚点」「使用纪律」", () => {
    expect(GUIDE_SECTIONS.map((section) => section.title)).toEqual([
      "速度标尺",
      "分组锚点",
      "使用纪律",
    ]);
  });

  it("引言把节拍器说成两件工具加一条纪律", () => {
    expect(GUIDE_LEAD).toContain("速度标尺");
    expect(GUIDE_LEAD).toContain("分组锚点");
    expect(GUIDE_LEAD).toContain("纪律");
  });

  it("每小节 2–4 条要点", () => {
    for (const section of GUIDE_SECTIONS) {
      expect(section.items.length).toBeGreaterThanOrEqual(2);
      expect(section.items.length).toBeLessThanOrEqual(4);
    }
  });

  it("区块用 section + 标题关联，可读屏定位", () => {
    expect(html).toContain('aria-labelledby="metronome-guide-heading"');
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
  });
});

describe("关键条目齐全（对应 M1–M10）", () => {
  it("速度标尺：起步速度、慢速判定、提速阶梯、恒定速度", () => {
    const scale = GUIDE_SECTIONS[0].items.map((item) => item.body).join("\n");
    expect(scale).toContain("120 BPM");
    expect(scale).toContain("72");
    expect(scale).toContain("六成");
    expect(scale).toContain("零错误");
    expect(scale).toContain("手腕放松");
    expect(scale).toContain("音色一致");
    expect(scale).toContain("动态可控");
    expect(scale).toContain("5 BPM");
    expect(scale).toContain("10 次");
    expect(scale).toContain("同一个速度");
  });

  it("分组锚点：重音标分组起点、拍号决定重音模型", () => {
    const anchor = GUIDE_SECTIONS[1].items.map((item) => item.body).join("\n");
    expect(anchor).toContain("重音");
    expect(anchor).toContain("4/4");
    expect(anchor).toContain("6/8");
    expect(anchor).toContain("7/8");
  });

  it("使用纪律：三速度并行、关掉节拍器", () => {
    const discipline = GUIDE_SECTIONS[2].items.map((item) => item.body).join("\n");
    expect(discipline).toContain("超慢速");
    expect(discipline).toContain("中等速");
    expect(discipline).toContain("表演速");
    expect(discipline).toContain("关掉节拍器");
  });

  it("每条要点都标注了调研依据编号", () => {
    for (const item of allItems) {
      expect(item.sources.length).toBeGreaterThan(0);
      for (const sourceId of item.sources) {
        expect(sourceId).toMatch(/^M\d+$/);
      }
    }
  });

  it("正文里不再出现第二个冒号（引导词后的分隔符是唯一的）", () => {
    for (const item of allItems) {
      expect(item.body, item.title).not.toContain("：");
    }
  });

  it("M1/M2/M3/M9/M4/M5/M6/M7/M10 都被引用到", () => {
    const used = new Set(allItems.flatMap((item) => item.sources));
    for (const id of ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M9", "M10"]) {
      expect(used.has(id), `缺少 ${id}`).toBe(true);
    }
  });
});

describe("M8（记录进度）不做，但写成正面表述", () => {
  it("M8 不在任何要点里", () => {
    const used = new Set(allItems.flatMap((item) => item.sources));
    expect(used.has("M8")).toBe(false);
  });

  it("说明句是正面表述，不是对使用者的限制说明", () => {
    expect(GUIDE_HISTORY_NOTE).toContain("不记录历史");
    expect(GUIDE_HISTORY_NOTE).toContain("进步靠自己记");
    // 不出现「不支持」「不能做」这类把限制甩给使用者的措辞
    expect(GUIDE_HISTORY_NOTE).not.toMatch(/不支持|无法|不能|禁止|限制/);
  });

  it("页面上确实出现了这句说明", () => {
    expect(html).toContain(GUIDE_HISTORY_NOTE);
  });
});

describe("收尾与语气", () => {
  it("收尾写明「节拍器是标尺不是答案」", () => {
    expect(GUIDE_CLOSING).toContain("标尺");
    expect(GUIDE_CLOSING).toContain("不是答案");
    expect(html).toContain(GUIDE_CLOSING);
  });

  it("没有营销腔与 emoji", () => {
    expect(allText).not.toMatch(/[✨🚀💪🔥⭐️]/u);
    for (const word of ["颠覆", "革命性", "最强", "必看", "神器"]) {
      expect(allText).not.toContain(word);
    }
  });
});

describe("设计约束", () => {
  it("只用六档字号，没有任意字号", () => {
    expect(source).not.toMatch(/\btext-\[[^\]]+\]/);
    const sizes = [...source.matchAll(/\btext-(display|title|body|label|meta|micro)\b/g)].map(
      ([, name]) => name,
    );
    for (const name of sizes) {
      expect(["display", "title", "body", "label", "meta", "micro"]).toContain(name);
    }
  });

  it("不写颜色字面量，只用现有令牌类", () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\b(?:bg|text|border)-\[/);
    expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });

  it("没有内联样式、没有交互控件", () => {
    expect(source).not.toMatch(/\sstyle\s*=/);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });

  it("窄屏不靠外层容器横向滚动：区块里没有表格", () => {
    expect(html).not.toContain("<table");
  });
});
