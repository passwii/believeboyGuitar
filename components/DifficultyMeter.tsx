const LEVELS = [1, 2, 3, 4, 5];

/**
 * 难度刻度。
 *
 * 不用 ★☆ 字符：字符是颜色/形状之外的第三种编码，读屏会念成「实心星」。
 * 这里用五段刻度，语义交给 aria-label，视觉只表达长度。
 */
export function DifficultyMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {LEVELS.map((level) => (
          <span
            key={level}
            className={`block h-1 w-3 rounded-pill ${
              level <= value ? "bg-accent-700" : "bg-ink-100"
            }`}
          />
        ))}
      </span>
      <span className="sr-only">难度 {value}，共 5 级</span>
    </span>
  );
}
