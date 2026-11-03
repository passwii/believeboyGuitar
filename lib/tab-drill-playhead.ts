import { clampBpm } from "@/lib/metronome";

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
