import { TabSystems, type TabSystemLayout } from "@/components/TabSystems";
import { describeMeasureNotes, describePicking, type TabMeasure } from "@/lib/tab";
import {
  TAB_LAYOUT,
  tabMeasureGroupsByWidth,
  tabMeasureWidth,
  tabSystemWidth,
} from "@/lib/tab-layout";

export type TabStaffProps = {
  measures: readonly TabMeasure[];
  bpm: number;
  /** 拍号，默认 4/4。 */
  timeSignature?: readonly [number, number];
  cdStart?: string;
  /** 给读屏与图注用的曲谱名称。 */
  title?: string;
  /** 额外显示在谱面上方信息栏中的标签。 */
  meta?: readonly string[];
  /** 当前拍位落在哪个音符上（按 measures 顺序的全局序号）；播放时由上层给出 */
  activeNoteIndex?: number | null;
};

function tabMinWidthClass(maxNoteCount: number): string {
  if (maxNoteCount >= 15) return "tab-staff tab-staff--wide";
  if (maxNoteCount >= TAB_LAYOUT.denseNoteCount) return "tab-staff tab-staff--triplet";
  return "tab-staff";
}

function chunkMeasureIndexes(count: number, size: number): number[][] {
  const groups: number[][] = [];
  for (let index = 0; index < count; index += size) {
    groups.push(
      Array.from({ length: Math.min(size, count - index) }, (_, offset) => index + offset),
    );
  }
  return groups;
}

function buildSystemLayouts(
  measures: readonly TabMeasure[],
  measureWidths: readonly number[],
  groups: readonly number[][],
): TabSystemLayout[] {
  return groups.map((indexes) => {
    const selectedWidths = indexes.map((index) => measureWidths[index]);
    return {
      measures: indexes.map((index) => measures[index]),
      measureWidths: selectedWidths,
      width: tabSystemWidth(selectedWidths),
      measureStart: indexes[0] ?? 0,
    };
  });
}

function describeMeasureRange(
  measures: readonly TabMeasure[],
  startIndex: number,
): string {
  return measures
    .map((measure, index) => {
      const picking = describePicking(measure);
      return `第 ${startIndex + index + 1} 小节：${describeMeasureNotes(measure)}${
        picking ? `；拨片：${picking}` : ""
      }`;
    })
    .join("；");
}

export function TabStaff({
  measures,
  bpm,
  timeSignature = [4, 4],
  cdStart,
  title = "TAB 谱",
  meta = [],
  activeNoteIndex = null,
}: TabStaffProps) {
  if (measures.length === 0) {
    return <p className="text-meta text-ink-500">这份谱面还没有音符。</p>;
  }

  const measureWidths = measures.map((measure) =>
    tabMeasureWidth(Math.max(measure.notes.length, measure.picking?.length ?? 0)),
  );
  const measureOffsets: number[] = [];
  let noteTotal = 0;
  for (const measure of measures) {
    measureOffsets.push(noteTotal);
    noteTotal += measure.notes.length;
  }

  const desktopSystems = buildSystemLayouts(
    measures,
    measureWidths,
    chunkMeasureIndexes(measures.length, TAB_LAYOUT.measuresPerSystem),
  );
  const mobileSystems = buildSystemLayouts(
    measures,
    measureWidths,
    tabMeasureGroupsByWidth(measureWidths),
  );
  const desktopWidth = Math.max(...desktopSystems.map((system) => system.width));
  const desktopHeight = desktopSystems.length * TAB_LAYOUT.systemHeight;
  const maxNoteCount = Math.max(...measures.map((measure) => measure.notes.length));
  const minWidthClass = tabMinWidthClass(maxNoteCount);
  const [beatsPerBar, beatUnit] = timeSignature;
  const timeSignatureLabel = `${beatsPerBar}/${beatUnit}`;
  const description = describeMeasureRange(measures, 0);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-500 max-sm:hidden">
        {cdStart ? <span>CD {cdStart}</span> : null}
        <span>♩ = {bpm}</span>
        <span>{timeSignatureLabel} 拍</span>
        <span>{measures.length} 小节</span>
        {meta.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </figcaption>

      <div className="flex flex-col gap-2 sm:hidden">
        {mobileSystems.map((system) => {
          const start = system.measureStart + 1;
          const end = system.measureStart + system.measures.length;
          const rangeLabel = start === end ? `第 ${start} 小节` : `第 ${start}–${end} 小节`;

          return (
            <div
              key={`mobile-system-${system.measureStart}`}
              role="region"
              aria-label={`${title}，${rangeLabel}`}
            >
              <svg
                viewBox={`0 0 ${system.width} ${TAB_LAYOUT.systemHeight}`}
                width={system.width}
                height={TAB_LAYOUT.systemHeight}
                role="img"
                aria-label={`${title}：${rangeLabel}`}
                className="block h-auto w-full text-ink-950"
              >
                <desc>{describeMeasureRange(system.measures, system.measureStart)}</desc>
                <TabSystems
                  systems={[system]}
                  measureOffsets={measureOffsets}
                  activeNoteIndex={activeNoteIndex}
                />
              </svg>
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block">
        <div
          className="-mx-1 overflow-x-auto px-1"
          tabIndex={0}
          role="region"
          aria-label={`${title}，可左右滚动`}
        >
          <svg
            viewBox={`0 0 ${desktopWidth} ${desktopHeight}`}
            width={desktopWidth}
            height={desktopHeight}
            role="img"
            aria-label={`${title}：${measures.length} 小节，速度每分钟 ${bpm} 拍`}
            className={`block h-auto w-full text-ink-950 ${minWidthClass}`}
          >
            <desc>{description}</desc>
            <TabSystems
              systems={desktopSystems}
              measureOffsets={measureOffsets}
              activeNoteIndex={activeNoteIndex}
            />
          </svg>
        </div>
      </div>
    </figure>
  );
}
