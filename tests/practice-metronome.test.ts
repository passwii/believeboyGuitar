import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeMetronome } from "@/components/PracticeMetronome";
import { WeekOneTabDrill } from "@/components/WeekOneTabDrill";
import { BPM_STEP } from "@/lib/metronome";

const componentPath = path.join(process.cwd(), "components", "PracticeMetronome.tsx");
const source = existsSync(componentPath) ? readFileSync(componentPath, "utf8") : "";
const tabDrillSource = readFileSync(path.join(process.cwd(), "components", "TabDrill.tsx"), "utf8");
const styles = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
const practiceHtml = renderToStaticMarkup(createElement(PracticeMetronome));
const tabDrillHtml = renderToStaticMarkup(createElement(WeekOneTabDrill));

describe("练习页节拍器", () => {
  it("两个练习节拍器都使用共享的 5 BPM 步进", () => {
    expect(BPM_STEP).toBe(5);
    expect(source).toContain("changeBpm(-BPM_STEP)");
    expect(source).toContain("changeBpm(BPM_STEP)");
    expect(tabDrillSource).toContain("changeBpm(-BPM_STEP)");
    expect(tabDrillSource).toContain("changeBpm(BPM_STEP)");
    expect(practiceHtml).toContain(`aria-label="减速 ${BPM_STEP} BPM"`);
    expect(practiceHtml).toContain(`aria-label="加速 ${BPM_STEP} BPM"`);
    expect(tabDrillHtml).toContain(`aria-label="减速 ${BPM_STEP} BPM"`);
    expect(tabDrillHtml).toContain(`aria-label="加速 ${BPM_STEP} BPM"`);
  });

  it("练习播放按钮声明空格快捷键", () => {
    expect(source).toContain('aria-label={running ? "暂停节拍器" : "开始节拍器"}');
    expect(source).toContain("useState(100)");
    expect(practiceHtml).toContain('aria-keyshortcuts="Space"');
    expect(tabDrillHtml).toContain('aria-keyshortcuts="Space"');
  });

  it("资料库练习和周练谱例都绑定共享的 Space 规则", () => {
    expect(source).toContain("createMetronomeAudio");
    expect(source).toContain("bindMetronomeSpaceShortcut");
    expect(tabDrillSource).toContain("bindMetronomeSpaceShortcut");
    expect(source).toContain("audio.schedule(");
  });

  it("周练桌面浮层保持 BPM 和 transport 可见，调速控制可展开", () => {
    expect(tabDrillHtml).toContain('class="practice-metronome-float"');
    expect(tabDrillHtml).toContain('aria-expanded="false"');
    expect(tabDrillHtml).toContain('aria-controls="week1-tab-tempo-controls"');
    expect(tabDrillHtml).toContain('aria-label="当前速度 100 BPM"');
    expect(tabDrillHtml).toContain('aria-label="开始练习节拍器"');
  });

  it("只在宽屏预留固定浮层的右侧轨道", () => {
    expect(styles).toMatch(/@media \(min-width: 1280px\)[\s\S]*?\.practice-focus[\s\S]*?\.practice-metronome-float/);
    expect(styles).toMatch(/\.practice-metronome-float\s*\{[^}]*position:\s*fixed/);
    expect(styles).toMatch(/\.practice-metronome-float\s*\{[^}]*top:\s*50%/);
    expect(styles).toMatch(/\.tab-drill-controls\s*\{[^}]*display:\s*none/);
    const inlineControlsClass = tabDrillHtml.match(/class="tab-drill-controls ([^"]+)"/)?.[1] ?? "";
    expect(inlineControlsClass.split(/\s+/)).not.toContain("flex");
  });

  it("启动等待期间再次按空格会取消待启动状态", () => {
    expect(source).toContain("const startingRef = useRef(false)");
    expect(source).toContain("if (runningRef.current || startingRef.current) pause();");
    expect(source).toContain("startingRef.current = true;");
    expect(source).toContain("startingRef.current = false;");
  });

  it("周练暂停时保存当前位置，恢复时接着下一个节拍", () => {
    expect(tabDrillSource).toContain("elapsedBeatsAt(");
    expect(tabDrillSource).toContain("beatTimeForResume(");
    expect(tabDrillSource).toContain("eighthPositionAt(");
    expect(tabDrillSource).toContain("timelineRef.current = { anchorTime: 0, elapsedBeats }");
  });
});
