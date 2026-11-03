import { describe, expect, it } from "vitest";
import { activeNoteIndex } from "@/lib/tab-timing";
import {
  beatPositionAt,
  beatTimeForResume,
  elapsedBeatsAt,
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
});
