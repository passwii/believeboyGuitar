/**
 * 练习计划的纯逻辑：时长分配与段落做法。
 *
 * 三条纪律与两条提醒曾是页面上的常驻区块（BLF-1452 Stage 1 删除）：
 * 它们属于《练习方法：速度墙与注意力焦点》这篇知识条目，练习页只留
 * 今天照着做的安排，不再复述一遍说明文字。
 *
 * 这个模块不碰 DOM、不碰 React，可以在 node（vitest）下直接 import。
 * 组件见 `components/PracticePlanner.tsx`。
 *
 * 段落做法与纪律来自 `research/practice.md` 汇总的研究结论：
 * · 热身与四段结构来自 D1 / D2 / D3 / D4；
 * · 慢练判定与提速阶梯来自 E1 / E2 与节拍器配套指引 M1 / M2；
 * · 难段拆解来自 F1（按重音分组、组尾补音、只弹目标音）；
 * · 录音回听来自 G1 / G2（放大镜法；自评改善不等于弹得更好）；
 * · 速度墙机制来自 E1。
 *
 * 刻意不做：任何按天的间隔表、进度统计与打卡。
 * 研究结论里明确没有「最优间隔」，也不存在「练 X 小时就达到 Y」的门槛
 * （见 research/practice.md §6 第 1、4 条）。
 */

export type TechniqueId =
  | "alternate-picking"
  | "bend"
  | "vibrato"
  | "scale-connection"
  | "chord-change";

export interface TechniqueGoal {
  id: TechniqueId;
  label: string;
  /** 这一项在技术段里的具体做法 */
  steps: string[];
}

/** 可勾选的技术目标。顺序即界面里的展示顺序。 */
export const TECHNIQUE_GOALS: readonly TechniqueGoal[] = [
  {
    id: "alternate-picking",
    label: "交替拨弦",
    steps: ["单音一律交替拨，不要连续拨；先求准确，再求速度。"],
  },
  {
    id: "bend",
    label: "推弦",
    steps: [
      "推到目标音并听准它，推到位再换下一个音；注意力放在声音上，不是手指动作。",
    ],
  },
  {
    id: "vibrato",
    label: "揉弦",
    steps: ["每个音的宽度与速度保持一致，听着不发抖、不忽宽忽窄。"],
  },
  {
    id: "scale-connection",
    label: "音阶衔接",
    steps: [
      "把走句按重音切成一组一组，先两两合并再逐步加长；换弦处单独慢练。",
    ],
  },
  {
    id: "chord-change",
    label: "和弦转换",
    steps: [
      "单独练转换的那一刻，不从头弹整首；组尾补一个音落在强拍上，下一组才接得上。",
    ],
  },
];

/** 可选的总时长（分钟） */
export const PRACTICE_DURATIONS: readonly number[] = [20, 40, 60];

/** 默认时长：一段完整练习的常见长度 */
export const DEFAULT_DURATION = 40;

export type SegmentId = "warmup" | "technique" | "repertoire" | "free";

export interface SegmentRatio {
  id: SegmentId;
  name: string;
  ratio: number;
}

/**
 * 四段的比例：热身 15% / 技术 40% / 曲目 30% / 自由弹 15%。
 *
 * 自由弹不可省——它决定你还愿不愿意回来（research D3）。
 */
export const SEGMENT_RATIOS: readonly SegmentRatio[] = [
  { id: "warmup", name: "热身", ratio: 0.15 },
  { id: "technique", name: "技术练习", ratio: 0.4 },
  { id: "repertoire", name: "曲目", ratio: 0.3 },
  { id: "free", name: "自由弹", ratio: 0.15 },
];

export type SegmentMinutes = Record<SegmentId, number>;

/**
 * 把总时长按比例拆到四段，分钟数之和恒等于总时长。
 *
 * 用最大余数法分配：先取每段的整数部分，剩下的分钟按小数部分从大到小补。
 * 直接四舍五入会让 7 分钟变成 1/3/2/1（和为 7 但比例偏了），
 * 或 1/0/0/0 这种把整段时间丢给第一段的情况。
 */
export function allocateSegmentMinutes(totalMinutes: number): SegmentMinutes {
  const result: SegmentMinutes = { warmup: 0, technique: 0, repertoire: 0, free: 0 };
  const total = Number.isFinite(totalMinutes) ? Math.max(0, Math.floor(totalMinutes)) : 0;
  if (total === 0) return result;

  const exact = SEGMENT_RATIOS.map((segment) => ({
    id: segment.id,
    value: total * segment.ratio,
  }));

  let assigned = 0;
  for (const item of exact) {
    result[item.id] = Math.floor(item.value);
    assigned += result[item.id];
  }

  const byRemainder = [...exact].sort(
    (a, b) =>
      (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)) ||
      SEGMENT_RATIOS.findIndex((segment) => segment.id === a.id) -
        SEGMENT_RATIOS.findIndex((segment) => segment.id === b.id),
  );

  let rest = total - assigned;
  let index = 0;
  while (rest > 0 && byRemainder.length > 0) {
    result[byRemainder[index % byRemainder.length].id] += 1;
    rest -= 1;
    index += 1;
  }

  // 补齐：总时长够四段时，不让任何一段被舍成 0 分钟。
  // 从最长的一段挪一分钟过来，比例只动一点，总数不变。
  if (total >= SEGMENT_RATIOS.length) {
    for (const segment of SEGMENT_RATIOS) {
      if (result[segment.id] > 0) continue;
      const donor = SEGMENT_RATIOS.reduce((best, candidate) =>
        result[candidate.id] > result[best.id] ? candidate : best,
      );
      if (result[donor.id] <= 1) break;
      result[donor.id] -= 1;
      result[segment.id] += 1;
    }
  }

  return result;
}

export interface PlanSegment {
  id: SegmentId;
  name: string;
  minutes: number;
  /** 该段占总时长的比例，如 0.15 */
  share: number;
  steps: string[];
}

export interface PracticePlan {
  totalMinutes: number;
  /** 曲目名，已去掉首尾空格；空字符串表示没有指定 */
  songTitle: string;
  /** 已选技术项的显示名，保持勾选顺序 */
  techniqueLabels: string[];
  segments: PlanSegment[];
}

/** 曲名去掉首尾空格；空串表示不指定曲目 */
export function normalizeSongTitle(raw: string): string {
  return raw.trim();
}

/** 热身：时间不够时只保留最省事的两步 */
function warmupSteps(minutes: number): string[] {
  if (minutes < 5) {
    return [
      "手指拉伸后做四指独立性练习，每组严格用 1–2–3–4 四指，含小指。",
      "单音一律交替拨弦，从慢速起。热身只让手进入状态，不在这里练内容。",
    ];
  }
  return [
    "热水泡手，手指拉伸，不施加外力。",
    "复奏几个熟悉的和弦，检查手腕、前臂、肩膀有没有多余的紧张。",
    "四指独立性练习，每组严格用 1–2–3–4 四指，含小指。",
    "单音一律交替拨弦，从慢速起；先求准确，再求速度。",
  ];
}

/** 技术段：通用做法 + 勾选项的具体做法 */
function techniqueSteps(techniqueIds: readonly TechniqueId[]): string[] {
  const selected = TECHNIQUE_GOALS.filter((goal) => techniqueIds.includes(goal.id));

  const steps = [
    "从目标速度的 60% 起步，每次加 5 BPM；同一速度连续弹 10 次都干净，才算掌握这一档。",
  ];

  if (selected.length === 0) {
    steps.push("今天没有指定技术项：挑一项作为本周焦点，一周只改一项，改得深比到处改快。");
  } else {
    for (const goal of selected) {
      for (const step of goal.steps) steps.push(`${goal.label}：${step}`);
    }
  }

  steps.push("慢练的判定：零错误、手是松的、音色一致、动态可控，四项都满足再往上提速。");
  steps.push("整段用同一个速度，简单的地方也不偷偷加速。");

  return steps;
}

/** 曲目段：把技术用到实际音乐里 */
function repertoireSteps(songTitle: string): string[] {
  const opening =
    songTitle === ""
      ? "今天挑一首在学的曲子：不从头弹整首，先定位最难的几小节循环它。"
      : `今天推进《${songTitle}》：不从头弹整首，先定位最难的几小节循环它。`;

  return [
    opening,
    "按重音落点把难段分组：先只弹每组的第一个音，听清目标音在哪，再逐步加进整组。",
    "录一遍再回听：查节奏稳不稳、音准对不对、音色粗不粗；录音是镜子，不是成绩单。",
    "曲库分三层：学中的一到两首、打磨中的两三首、保养中的五首以上；每次过一首保养曲。",
  ];
}

/** 自由弹：不设目标地弹，并且收口 */
function freeSteps(): string[] {
  return [
    "不设目标地弹：接一段伴奏，或者清音弹几句即兴。",
    "关掉节拍器再弹一遍，练自然乐句与 articulation；节拍器是工具，也可以是干扰。",
    "收尾慢而完整地把刚才练的东西弹一遍，让最后留下的印象是「弹完了」，不是「卡住了」。",
  ];
}

/**
 * 生成一份完整的练习计划。
 *
 * 输入只有三样：总时长、勾选的技术项、可留空的曲名。
 * 输出是四段结构化安排，每段给出分钟数与具体做法。
 */
export function buildPracticePlan(input: {
  totalMinutes: number;
  techniques?: readonly TechniqueId[];
  songTitle?: string;
}): PracticePlan {
  const totalMinutes = Number.isFinite(input.totalMinutes)
    ? Math.max(0, Math.floor(input.totalMinutes))
    : 0;
  const minutes = allocateSegmentMinutes(totalMinutes);
  const songTitle = normalizeSongTitle(input.songTitle ?? "");
  const techniqueIds = (input.techniques ?? []).filter((id) =>
    TECHNIQUE_GOALS.some((goal) => goal.id === id),
  );

  const stepsBySegment: Record<SegmentId, string[]> = {
    warmup: warmupSteps(minutes.warmup),
    technique: techniqueSteps(techniqueIds),
    repertoire: repertoireSteps(songTitle),
    free: freeSteps(),
  };

  return {
    totalMinutes,
    songTitle,
    techniqueLabels: TECHNIQUE_GOALS.filter((goal) => techniqueIds.includes(goal.id)).map(
      (goal) => goal.label,
    ),
    segments: SEGMENT_RATIOS.map((segment) => ({
      id: segment.id,
      name: segment.name,
      minutes: minutes[segment.id],
      share: segment.ratio,
      steps: stepsBySegment[segment.id],
    })),
  };
}

/** 一行摘要：先给结果，再动工具 */
export function planSummary(plan: PracticePlan): string {
  const techniques =
    plan.techniqueLabels.length > 0 ? plan.techniqueLabels.join("、") : "未指定";
  const song = plan.songTitle === "" ? "未指定" : `《${plan.songTitle}》`;
  return `共 ${plan.totalMinutes} 分钟 · 技术：${techniques} · 曲目：${song}`;
}

/**
 * 读屏播报用的摘要：不带曲名。
 *
 * 曲名是用户正在输入的文本，如果摘要跟着逐字变化，读屏会把它与输入框的
 * 回显叠着念两遍。曲名本身已经由输入框读出来了，这里只播报结构性的变化。
 */
export function planStatus(plan: PracticePlan): string {
  const techniques =
    plan.techniqueLabels.length > 0 ? plan.techniqueLabels.join("、") : "未指定";
  return `共 ${plan.totalMinutes} 分钟 · 技术：${techniques}`;
}
