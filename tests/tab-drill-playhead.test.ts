import { describe, expect, it } from "vitest";
import {
  beatTimeForResume,
  elapsedBeatsAt,
  eighthPositionAt,
  nextBeatAfter,
  type TabDrillTimeline,
} from "@/lib/tab-drill-playhead";

describe("weekly TAB playhead timeline", () => {
  it("holds the saved beat offset until the resumed audio start time", () => {
    const timeline: TabDrillTimeline = { anchorTime: 20, elapsedBeats: 2.25 };

    expect(elapsedBeatsAt(timeline, 19.9, 120)).toBe(2.25);
  });

  it("advances the saved beat offset using the current BPM", () => {
    const timeline: TabDrillTimeline = { anchorTime: 20, elapsedBeats: 2.25 };

    expect(elapsedBeatsAt(timeline, 20.5, 120)).toBe(3.25);
  });

  it("maps the playhead to an eighth-note position and wraps at the loop length", () => {
    const timeline: TabDrillTimeline = { anchorTime: 10, elapsedBeats: 0.5 };

    expect(eighthPositionAt(timeline, 12.3, 120, 8)).toBe(2);
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
});
