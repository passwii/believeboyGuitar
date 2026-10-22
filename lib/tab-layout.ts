/**
 * TAB 谱面的几何计算。
 *
 * 版式按公开出版的 TAB 来：符杠贴着这一小节最高的那个音符往上留一段符干，符干
 * 落在品位数字的上沿。节奏符号必须和数字连成一体——断在半空里就会被读成谱面顶部
 * 另起的一行符号，而不是「这几个数字是八分音符」。
 */

export const TAB_LAYOUT = {
  /** 每个谱表放几个小节。 */
  measuresPerSystem: 4,
  measureWidth: 150,
  systemPadX: 16,
  measurePadX: 15,
  /** 一弦（谱表最上面那条线）的 y。 */
  staffTop: 48,
  stringGap: 18,
  stringCount: 6,
  /** 符杠行不会高过这个 y，给三连音标记留出位置。 */
  rhythmFloor: 24,
  /** 符杠与它下面最高那个音符的距离。 */
  stemLength: 26,
  /** 指法标记与六弦的距离。 */
  fingerGap: 18,
  /** 一个谱表的高度，含符杠、六线与指法行。 */
  systemHeight: 176,
  noteFontSize: 15,
  denseNoteFontSize: 11,
  /** 一小节音符数达到这个值就换小字号。 */
  denseNoteCount: 12,
  /** 双符杠之间的间距。 */
  beamGap: 4,
  /** 符干下端与数字上沿之间留的空隙。 */
  stemGap: 1.5,
  /** 等宽字体数字的字形高度（em 的倍数）。 */
  fretGlyphTop: 0.78,
  /** 不连符杠的音符（四分音符）的符干长度。 */
  plainStemLength: 24,
} as const;

/** 一个谱表的宽度。 */
export function tabSystemWidth(): number {
  return TAB_LAYOUT.systemPadX * 2 + TAB_LAYOUT.measureWidth * TAB_LAYOUT.measuresPerSystem;
}

/** 某根弦的 y。1 = 最细的高音弦，画在最上面。 */
export function tabStringY(rowTop: number, string: number): number {
  return rowTop + TAB_LAYOUT.staffTop + (string - 1) * TAB_LAYOUT.stringGap;
}

/** 小节内第 index 个音符的 x；音符均分小节，落在每一格的中心。 */
export function tabNoteX(measureX: number, index: number, count: number): number {
  const usable = TAB_LAYOUT.measureWidth - TAB_LAYOUT.measurePadX * 2;
  return measureX + TAB_LAYOUT.measurePadX + ((index + 0.5) * usable) / count;
}

/** 音符挤在一起时换小字号，避免相邻数字粘住。 */
export function tabNoteFontSize(noteCount: number): number {
  return noteCount >= TAB_LAYOUT.denseNoteCount
    ? TAB_LAYOUT.denseNoteFontSize
    : TAB_LAYOUT.noteFontSize;
}

/** 品位数字的基线；字形以弦线为中心。 */
export function tabFretBaselineY(stringY: number): number {
  return stringY + 5;
}

export type TabStemSpanOptions = {
  /** 音符所在弦线的 y。 */
  stringY: number;
  fontSize: number;
  /** 符杠的 y；不连符杠的音符省略，画一段固定长度的符干。 */
  beamY?: number;
};

/**
 * 符干的上下端。下端贴着品位数字的字形上沿，上端接符杠——这样节奏符号和
 * 数字之间始终是一条连续的线，不会各自漂在谱面的两端。
 */
export function tabStemSpan({ stringY, fontSize, beamY }: TabStemSpanOptions): {
  top: number;
  bottom: number;
} {
  const bottom = stringY - fontSize * TAB_LAYOUT.fretGlyphTop - TAB_LAYOUT.stemGap;
  const top =
    beamY === undefined
      ? bottom - TAB_LAYOUT.plainStemLength
      : Math.min(beamY, bottom - 6);

  return { top, bottom };
}

/** 符杠行的 y：贴着这一小节最高那个音符往上留一段符干。 */
export function tabBeamRowY(highestStringY: number): number {
  return Math.max(TAB_LAYOUT.rhythmFloor, highestStringY - TAB_LAYOUT.stemLength);
}

/** 一组符杠的 y；十六分音符是两条，由外向内排。 */
export function tabBeamYs(beamY: number, beamCount: number): number[] {
  return Array.from({ length: beamCount }, (_, index) => beamY + index * TAB_LAYOUT.beamGap);
}

export type TabTripletMark = {
  /** 括号横线、两端短竖线与数字基线的 y。 */
  lineY: number;
  tickY: number;
  labelY: number;
  centerX: number;
};

/** 三连音标记：一根带两端短竖线的横线，数字写在横线上方。 */
export function tabTripletMark(beamY: number, startX: number, endX: number): TabTripletMark {
  return {
    lineY: beamY - 8,
    tickY: beamY - 4,
    labelY: beamY - 11,
    centerX: (startX + endX) / 2,
  };
}
