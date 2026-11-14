import { clampBpm } from "@/lib/metronome";
import { totalBeats } from "@/lib/tab-timing";
import type { TabSection } from "@/lib/tab-practice";

export type TabDrillTimeline = {
  /** Audio time at which the current run begins advancing. */
  anchorTime: number;
  /** Completed beat position saved before this run was started. */
  elapsedBeats: number;
};

export function elapsedBeatsAt(
  timeline: TabDrillTimeline,
  audioTime: number,
  bpm: number,
): number {
  const delta = Math.max(0, audioTime - timeline.anchorTime);
  return Math.max(0, timeline.elapsedBeats) + (delta * clampBpm(bpm)) / 60;
}

export function beatPositionAt(
  timeline: TabDrillTimeline,
  audioTime: number,
  bpm: number,
  loopBeats: number,
): number {
  if (!Number.isFinite(loopBeats) || loopBeats <= 0) return 0;
  return elapsedBeatsAt(timeline, audioTime, bpm) % loopBeats;
}

export function nextBeatAfter(elapsedBeats: number): number {
  if (!Number.isFinite(elapsedBeats) || elapsedBeats <= 0) return 0;
  return Math.floor(elapsedBeats) + 1;
}

export function beatTimeForResume(timeline: TabDrillTimeline, bpm: number): number {
  const nextBeat = nextBeatAfter(timeline.elapsedBeats);
  const untilNextBeat = Math.max(0, nextBeat - timeline.elapsedBeats);
  return timeline.anchorTime + (untilNextBeat * 60) / clampBpm(bpm);
}

export type TabDrillSectionPosition = {
  sectionIndex: number;
  /** 当前段内部的拍位，从 0 开始。 */
  localBeat: number;
};

export type TabDrillVisualState = TabDrillSectionPosition & {
  /** 当前段 id；未开始时为 null。 */
  activeSectionId: string | null;
  /** 激光播放头是否可见；暂停与 reduced-motion 下隐藏。 */
  showPlayhead: boolean;
};

/**
 * 周练段落按目录顺序串成一轮。
 *
 * 每段从上一段结束的拍位开始；走完最后一段后回到第一段。
 * 这样同一个音频时钟可以依次推进段落，而不必为每段各开一个计时器。
 */
export function tabDrillSectionPosition(
  sections: readonly TabSection[],
  beatPosition: number,
): TabDrillSectionPosition {
  if (sections.length === 0 || !Number.isFinite(beatPosition)) {
    return { sectionIndex: 0, localBeat: 0 };
  }

  const lengths = sections.map((section) => totalBeats(section.measures));
  const cycleBeats = lengths.reduce((total, length) => total + length, 0);
  if (cycleBeats <= 0) return { sectionIndex: 0, localBeat: 0 };

  const raw = ((beatPosition % cycleBeats) + cycleBeats) % cycleBeats;
  const normalized = raw >= cycleBeats - 1e-6 ? 0 : raw;
  let start = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const end = start + lengths[index];
    if (normalized < end - 1e-6) {
      return { sectionIndex: index, localBeat: Math.max(0, normalized - start) };
    }
    start = end;
  }

  return { sectionIndex: lengths.length - 1, localBeat: Math.max(0, lengths.at(-1) ?? 0) };
}

/**
 * 由「拍位 + 播放状态 + 动效偏好」决定谱面该显示什么。
 *
 * 音符高亮跟随 activeSectionId 保留到暂停之后；
 * 激光播放头只在真正播放且未要求减弱动态效果时出现。
 */
export function tabDrillVisualState(
  sections: readonly TabSection[],
  beatPosition: number,
  options: { running: boolean; reducedMotion: boolean },
): TabDrillVisualState {
  if (sections.length === 0 || !Number.isFinite(beatPosition) || beatPosition < 0) {
    return { sectionIndex: 0, localBeat: 0, activeSectionId: null, showPlayhead: false };
  }

  const position = tabDrillSectionPosition(sections, beatPosition);
  const activeSectionId = sections[position.sectionIndex]?.id ?? null;
  return {
    ...position,
    activeSectionId,
    showPlayhead:
      activeSectionId !== null && options.running && !options.reducedMotion,
  };
}
