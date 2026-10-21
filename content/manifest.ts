export const STAGES = ["入门", "基础", "进阶"] as const;
export type Stage = (typeof STAGES)[number];

export const TOPICS = [
  "乐理",
  "技巧",
  "音阶与指板",
  "曲谱",
  "设备与音色",
  "练习方法",
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
    {
      title: "用 CAGED 走一遍整条指板",
      detail:
        "按 C → A → G → E → D 五个形状依次弹出根音，确认每个形状的根音落在同一条 C 上。",
    },
    {
      title: "把交替拨弦的速度墙位置记下来",
      detail:
        "在完全不弹错的速度上弹稳，再往上提；记下出错的那个速度，下次从更慢处重新开始。",
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
  {
    slug: "pocket-amp-sk17-guide",
    title: "Pocket AMP（SK17）操作与效果模块手册",
    summary: "面板操作、80 个预设、六大效果模块、连接录音、M-EFCS、固件与常见问题速查。",
    stage: "入门",
    topics: ["设备与音色"],
    tags: ["Pocket AMP", "SK17", "效果器", "音色", "录音", "M-EFCS", "MIDI"],
    difficulty: 2,
    source:
      "用户整理改写。依据 Pocket AMP / SK17 原厂说明书与 M-VAVE 官网、下载中心公开资料；原稿保留于 docs/Pocket-AMP-SK17-操作与效果手册.md，并标注来源差异与待实机核对项。",
    updatedAt: "2026-10-16",
  },
  {
    slug: "fretboard-positions-and-naming",
    title: "把位命名体系与 CAGED 连接",
    summary:
      "position、shape、box 的含义差别，CAGED 五个形状如何连成整条指板，以及七个把位的衔接路径。",
    stage: "进阶",
    topics: ["音阶与指板"],
    tags: ["把位", "命名体系", "CAGED", "五声音阶", "Box", "衔接"],
    difficulty: 3,
    source:
      "本资料库原创内容，依据 jazzguitar.be、appliedguitartheory、fretjam、Chordalogy、Ted Greene 教学资料等公开教程改写。音位与形状位置由标准调弦 EADGBE 与 C 大调推导得出，不是抄录；涉及指法与 Box 边界的内容已标注需实琴核对。",
    updatedAt: "2026-10-20",
  },
  {
    slug: "harmony-chords-and-modes",
    title: "和弦构造、调式与和声进行",
    summary:
      "三和弦与七和弦的构成、级数与功能的记法、七个调式的色彩音，以及模态借用的读法。",
    stage: "基础",
    topics: ["乐理"],
    tags: ["和弦", "三和弦", "七和弦", "调式", "模态借用", "罗马数字", "Nashville"],
    difficulty: 3,
    source:
      "本资料库原创内容，依据 Open Music Theory、musictheory.net、Guitar.com、Premier Guitar、jazzguitar.be 等公开教程改写。级数表与音程公式由十二平均律推导；调式色彩为听觉描述，已标注需结合乐器判断。",
    updatedAt: "2026-10-20",
  },
  {
    slug: "guitar-technique-bending-picking",
    title: "推弦、揉弦与交替拨弦",
    summary:
      "推弦目标音对照表、揉弦的参数拆解、渐进提速法与十六分音符的留白处理。",
    stage: "基础",
    topics: ["技巧"],
    tags: ["推弦", "揉弦", "交替拨弦", "节奏", "点弦", "泛音", "击弦", "勾弦"],
    difficulty: 3,
    source:
      "本资料库原创内容，依据 Guitar Player、Guitar World、Guitar Command、Ultimate Guitar、New Guitar Daily 等公开教程改写。推弦目标音与品位由标准调弦 EADGBE 推导；实际音准与音色需在实琴上核对。",
    updatedAt: "2026-10-20",
  },
  {
    slug: "practice-method-and-speed-wall",
    title: "练习方法：速度墙与注意力焦点",
    summary:
      "为什么线性提速必然撞墙、慢练的四条判定、每天的练习结构，以及外部注意力焦点的研究证据。",
    stage: "基础",
    topics: ["练习方法"],
    tags: ["练习方法", "速度墙", "慢练", "刻意练习", "节拍器", "注意力焦点", "拆解"],
    difficulty: 3,
    source:
      "本资料库原创内容。引用 Chua 等 2021 年发表于《心理学通报》的系统综述与元分析（73 项研究、1824 名被试）、Mornell & Wulf 2018 年的音乐演奏实验，以及莱顿大学 2019 年关于外部注意力焦点的博士论文；其余依据吉他教学与练习方法类公开资料改写。",
    updatedAt: "2026-10-20",
  },
  {
    slug: "tone-signal-chain-and-gear",
    title: "音色的五层模型与信号链顺序",
    summary:
      "从吉他本体到房间的五层音色模型、效果器顺序的通用骨架、拾音器高度与 IR 长度选择。",
    stage: "进阶",
    topics: ["设备与音色"],
    tags: ["音色", "信号链", "效果器", "拾音器", "压缩", "EQ", "IR", "推子"],
    difficulty: 3,
    source:
      "本资料库原创内容，依据 Boss、Strymon、Focusrite、Marshall、Seymour Duncan、Celestion 官方文档与 Sound on Sound、The Rig Doctor、Guitar Lobby 等公开资料改写。与《Pocket AMP（SK17）操作与效果模块手册》不重复：本文讲通用原理，已列出可补充项与一条待实机核对的 IR 长度发现。",
    updatedAt: "2026-10-20",
  },
];
