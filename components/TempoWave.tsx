import type { Meter } from "@/lib/metronome";

/**
 * 拍点波形（2026-10-26，D4）。
 *
 * 一根柱是一拍里的四分之一。峰值出现在每拍起点，重音拍的峰值更高；
 * 播放时，当前拍的那一组柱换成强调色。
 *
 * 它只表达两件真实信息：拍号（每小节几拍、重音在哪）与当前拍。
 * 不做假音频分析——柱高由拍号推导，不随音量变化；高亮由 Metronome 的
 * 调度循环给出，和真正发声的拍是同一个来源。
 *
 * 纯展示组件：没有状态、没有计时器；画在 SVG 里是为了用属性而不是行内
 * 样式表达高度（组件层不允许行内样式）。
 */
const SUBDIVISIONS = 4;
const MAX_HEIGHT = 44;
/** viewBox 里的列距与柱宽：柱只占 1/4，SVG 横向拉伸后仍然是一根细柱而不是一块砖 */
const COLUMN_WIDTH = 40;
const BAR_WIDTH = 10;

export function TempoWave({
  meter,
  activeBeat,
  running,
  subdivisions = SUBDIVISIONS,
  className = "",
}: {
  meter: Meter;
  activeBeat: number;
  running: boolean;
  /** 每拍切成几根柱；窄容器（首页快捷条）用 2 根就够 */
  subdivisions?: number;
  className?: string;
}) {
  const columns = Array.from({ length: meter.beatsPerBar * subdivisions }, (_, index) => {
    const beat = Math.floor(index / subdivisions);
    const subdivision = index % subdivisions;
    // 每拍起点最高，往后四分之一递减；重音拍整体抬高一些
    const decay = 0.5 + 0.5 * Math.exp(-subdivision * 0.8);
    const accent = meter.accents.includes(beat) ? 1 : 0.78;
    return {
      beat,
      height: Math.round(MAX_HEIGHT * decay * accent),
    };
  });

  return (
    <svg
      viewBox={`0 0 ${columns.length * COLUMN_WIDTH} ${MAX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`block w-full ${className}`}
    >
      {columns.map((column, index) => {
        const active = running && column.beat === activeBeat;
        return (
          <rect
            key={index}
            x={index * COLUMN_WIDTH + (COLUMN_WIDTH - BAR_WIDTH) / 2}
            y={MAX_HEIGHT - column.height}
            width={BAR_WIDTH}
            height={column.height}
            rx={1}
            className={active ? "fill-accent-700" : "fill-ink-200"}
          />
        );
      })}
    </svg>
  );
}
