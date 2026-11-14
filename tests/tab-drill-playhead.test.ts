import { describe, expect, it } from "vitest";
import { activeNoteIndex } from "@/lib/tab-timing";
import {
  beatPositionAt,
  beatTimeForResume,
  elapsedBeatsAt,
  nextBeatAfter,
  tabDrillSectionPosition,
  tabDrillVisualState,
  type TabDrillTimeline,
} from "@/lib/tab-drill-playhead";
import { totalBeats } from "@/lib/tab-timing";
import { WEEK1_SECTIONS } from "@/lib/week-1-tab-exercises";
import { readFileSync } from "node:fs";
import path from "node:path";

const systemsSource = readFileSync(
  path.join(process.cwd(), "components", "TabSystems.tsx"),
  "utf8",
);
const drillSource = readFileSync(
  path.join(process.cwd(), "components", "TabDrill.tsx"),
  "utf8",
);
const styles = readFileSync(
  path.join(process.cwd(), "astro", "styles", "global.css"),
  "utf8",
);

describe("weekly TAB playhead timeline", () => {
  it("holds the saved beat offset until the resumed audio start time", () => {
    const timeline: TabDrillTimeline = { anchorTime: 20, elapsedBeats: 2.25 };

    expect(elapsedBeatsAt(timeline, 19.9, 120)).toBe(2.25);
  });

  it("advances the saved beat offset using the current BPM", () => {
    const timeline: TabDrillTimeline = { anchorTime: 20, elapsedBeats: 2.25 };

    expect(elapsedBeatsAt(timeline, 20.5, 120)).toBe(3.25);
  });

  it("keeps fractional beat positions and wraps at the loop length", () => {
    const timeline: TabDrillTimeline = { anchorTime: 10, elapsedBeats: 0.5 };

    expect(beatPositionAt(timeline, 12.3, 120, 4)).toBeCloseTo(1.1);
  });

  it("highlights a sixteenth-note event between eighth-note positions", () => {
    const timeline: TabDrillTimeline = { anchorTime: 10, elapsedBeats: 0 };
    const sixteenths = [
      {
        notes: Array.from({ length: 16 }, () => ({ string: 6 as const, fret: 5, duration: "16" as const })),
      },
    ];
    const beatPosition = beatPositionAt(timeline, 10.15, 120, 4);

    expect(activeNoteIndex(sixteenths, beatPosition)).toBe(1);
  });

  it("highlights the current triplet event instead of quantizing it to an eighth note", () => {
    const timeline: TabDrillTimeline = { anchorTime: 10, elapsedBeats: 0 };
    const triplets = [
      {
        notes: Array.from({ length: 12 }, () => ({ string: 6 as const, fret: 5, duration: "8t" as const })),
      },
    ];
    const beatPosition = beatPositionAt(timeline, 10.2, 120, 4);

    expect(activeNoteIndex(triplets, beatPosition)).toBe(1);
  });

  it("starts a fresh timeline on beat zero", () => {
    const timeline: TabDrillTimeline = { anchorTime: 100, elapsedBeats: 0 };

    expect(nextBeatAfter(timeline.elapsedBeats)).toBe(0);
    expect(beatTimeForResume(timeline, 120)).toBe(100);
  });

  it("resumes on the next beat instead of replaying the paused beat", () => {
    const timeline: TabDrillTimeline = { anchorTime: 100, elapsedBeats: 2.25 };

    expect(nextBeatAfter(timeline.elapsedBeats)).toBe(3);
    expect(beatTimeForResume(timeline, 120)).toBe(100.375);
  });

  it("激光播放头由同一个 beatPosition 驱动，不另开计时器", () => {
    expect(drillSource).toContain("tabDrillVisualState(");
    expect(drillSource).toContain("visualState.localBeat");
    expect(systemsSource).toContain("beatPosition");
    expect(systemsSource).not.toContain("setInterval");
    expect(systemsSource).not.toContain("requestAnimationFrame");
  });

  it("播放头带激光线与光晕，并可在减弱动态效果下保持静态", () => {
    expect(systemsSource).toContain('className="tab-playhead"');
    expect(systemsSource).toContain('className="tab-playhead-line"');
    expect(styles).toContain(".tab-playhead");
    expect(styles).toContain("drop-shadow(0 0 4px var(--color-accent-glow))");
  });

  it("当前练习段在标题旁有可见信号标", () => {
    expect(drillSource).toContain('className="tab-section-live"');
    expect(drillSource).toContain("当前段");
    expect(styles).toContain(".tab-section-live");
  });
});

describe("周练段落推进", () => {
  const sectionBeats = WEEK1_SECTIONS.map((section) => totalBeats(section.measures));
  const cycleBeats = sectionBeats.reduce((total, beats) => total + beats, 0);

  it("第 1 周七段总拍数为 112，每段各 16 拍", () => {
    for (const beats of sectionBeats) {
      expect(beats).toBeCloseTo(16, 5);
    }
    expect(cycleBeats).toBeCloseTo(112, 5);
  });

  it("按目录顺序逐段推进，而不是每轮都停在第一段", () => {
    const first = tabDrillSectionPosition(WEEK1_SECTIONS, 0);
    expect(first.sectionIndex).toBe(0);
    expect(first.localBeat).toBeCloseTo(0, 5);
    const second = tabDrillSectionPosition(WEEK1_SECTIONS, 16);
    expect(second.sectionIndex).toBe(1);
    expect(second.localBeat).toBeCloseTo(0, 5);
    const secondLate = tabDrillSectionPosition(WEEK1_SECTIONS, 31.5);
    expect(secondLate.sectionIndex).toBe(1);
    expect(secondLate.localBeat).toBeCloseTo(15.5, 5);
    const last = tabDrillSectionPosition(WEEK1_SECTIONS, 96);
    expect(last.sectionIndex).toBe(6);
    expect(last.localBeat).toBeCloseTo(0, 5);
  });

  it("走完最后一段后回到第一段并重置局部拍位", () => {
    const tail = tabDrillSectionPosition(WEEK1_SECTIONS, 111.75);
    expect(tail.sectionIndex).toBe(6);
    expect(tail.localBeat).toBeCloseTo(15.75, 5);
    const wrap = tabDrillSectionPosition(WEEK1_SECTIONS, 112);
    expect(wrap.sectionIndex).toBe(0);
    expect(wrap.localBeat).toBeCloseTo(0, 5);
  });
});

describe("周练暂停/恢复的播放头可见性", () => {
  it("暂停时隐藏激光播放头，但保留当前段的音符高亮", () => {
    const state = tabDrillVisualState(WEEK1_SECTIONS, 20, {
      running: false,
      reducedMotion: false,
    });
    expect(state.sectionIndex).toBe(1);
    expect(state.localBeat).toBeCloseTo(4, 5);
    expect(state.activeSectionId).toBe("monday");
    expect(state.showPlayhead).toBe(false);
  });

  it("恢复播放时在当前段重新显示激光播放头", () => {
    const state = tabDrillVisualState(WEEK1_SECTIONS, 20, {
      running: true,
      reducedMotion: false,
    });
    expect(state.sectionIndex).toBe(1);
    expect(state.activeSectionId).toBe("monday");
    expect(state.showPlayhead).toBe(true);
  });

  it("减弱动态效果时即使正在播放也不显示激光播放头", () => {
    const state = tabDrillVisualState(WEEK1_SECTIONS, 20, {
      running: true,
      reducedMotion: true,
    });
    expect(state.activeSectionId).toBe("monday");
    expect(state.showPlayhead).toBe(false);
  });

  it("未开始时没有激活段与播放头", () => {
    const state = tabDrillVisualState(WEEK1_SECTIONS, -1, {
      running: false,
      reducedMotion: false,
    });
    expect(state.activeSectionId).toBeNull();
    expect(state.showPlayhead).toBe(false);
  });

  it("TabDrill 使用纯函数决定播放头可见性", () => {
    expect(drillSource).toContain("tabDrillVisualState(");
    expect(drillSource).toContain("visualState.showPlayhead");
    expect(drillSource).toContain("running,");
    expect(drillSource).toContain("section.id === visualState.activeSectionId");
  });
});
