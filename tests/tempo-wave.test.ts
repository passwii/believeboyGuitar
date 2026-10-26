import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TempoWave } from "@/components/TempoWave";
import { METERS, type Meter } from "@/lib/metronome";

/**
 * 拍点波形是「拍号的形状」：每拍四个细分、峰值落在拍点、重音拍更高。
 * 这里只验结构，不验配色（配色由 design-system 守护）。
 */
const meter = METERS.find((option) => option.label === "4/4")!;

type Props = { meter?: Meter; activeBeat?: number; running?: boolean };

function markup(props: Props = {}) {
  return renderToStaticMarkup(
    createElement(TempoWave, { meter, activeBeat: 0, running: false, ...props }),
  );
}

describe("拍点波形", () => {
  it("每拍四个细分，总列数随拍号变化", () => {
    const columns = (html: string) => html.match(/<rect/g)?.length ?? 0;
    expect(columns(markup())).toBe(meter.beatsPerBar * 4);
    const sixEight = METERS.find((option) => option.label === "6/8")!;
    expect(columns(markup({ meter: sixEight }))).toBe(sixEight.beatsPerBar * 4);
  });

  it("未播放时不高亮任何一拍", () => {
    expect(markup({ running: false, activeBeat: 2 }).match(/fill-accent-700/g) ?? []).toHaveLength(0);
  });

  it("播放时只高亮当前拍的那一组", () => {
    expect(markup({ running: true, activeBeat: 1 }).match(/fill-accent-700/g) ?? []).toHaveLength(4);
  });

  it("重音拍的峰值高于弱拍，拍内逐级递减", () => {
    const heights = (html: string) =>
      [...html.matchAll(/height="(\d+)"/g)].map((match) => Number(match[1]));
    const fourFour = heights(markup());
    expect(fourFour).toHaveLength(16);
    expect(fourFour[0]).toBeGreaterThan(fourFour[4]);
    expect(fourFour[0]).toBeGreaterThan(fourFour[1]);
    expect(fourFour[1]).toBeGreaterThan(fourFour[2]);
  });
});
