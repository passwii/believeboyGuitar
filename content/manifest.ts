export const STAGES = ["入门", "基础", "进阶"] as const;
export type Stage = (typeof STAGES)[number];

export const TOPICS = [
  "乐理",
  "技巧",
  "音阶与指板",
  "曲谱",
  "设备与音色",
  "资料库说明",
] as const;
export type Topic = (typeof TOPICS)[number];

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export interface Lesson {
  /** 唯一标识，对应 content/lessons/<slug>.html */
  slug: string;
  title: string;
  summary: string;
  stage: Stage;
  topics: Topic[];
  tags: string[];
  /** 1（最易）到 5（最难） */
  difficulty: Difficulty;
  /** 来源出处与版权说明 */
  source: string;
  /** 最近整理时间，YYYY-MM-DD */
  updatedAt: string;
}

export interface HomeGoal {
  title: string;
  detail: string;
}

/** 主页的近期学习目标，手写维护 */
export const home: { goals: HomeGoal[] } = {
  goals: [
    {
      title: "把 C 大调一弦三音的七个把位练顺",
      detail:
        "先慢速把每个把位的六个音组弹匀，再把相邻把位接起来，走完整条指板再回到起点。",
    },
  ],
};

/** 全部资料。这是网站目录与筛选的唯一事实来源 */
export const lessons: Lesson[] = [
  {
    slug: "c-major-three-notes-per-string",
    title: "C 大调一弦三音系统",
    summary: "七个把位的交互指板图、品位数速查表与练习要点。",
    stage: "基础",
    topics: ["音阶与指板"],
    tags: ["音阶", "指型", "大调", "调式", "交替拨弦"],
    difficulty: 3,
    source:
      "本资料库原创内容。音位按标准调弦 EADGBE 与 C 大调音阶推导得出，不是抄录。",
    updatedAt: "2026-10-16",
  },
  {
    slug: "how-to-use-this-library",
    title: "如何使用这个资料库",
    summary: "资料库的组织方式、内容约定，以及新增一篇资料的完整流程。",
    stage: "入门",
    topics: ["资料库说明"],
    tags: ["说明", "工作流"],
    difficulty: 1,
    source: "本资料库原创内容",
    updatedAt: "2026-10-16",
  },
];
