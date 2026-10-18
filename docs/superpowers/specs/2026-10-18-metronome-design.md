# 节拍器页面 — 需求盘点与方案

日期：2026-10-18
状态：待确认（Stage 0 产出，确认后进入 Stage 1）
对应 issue：BLF-1364

本文只做方案，不改代码。实现拆成三个阶段（见 §12），每阶段单独提 PR。

> **修订（2026-10-18，Stage 1 合并后）**：初稿把 `.segment` / `--container-measure` / `text-display` / `--radius-card` / `tests/design-system.test.ts` 当作 `origin/main` 上已有的原语，实际都不存在。§9 已改为只用现有 Tailwind utility；同时补上了已排程点击的撤销（§4 / §8）与页面恢复后的状态定义（§4）。
>
> **修订二（2026-10-18，PR #2 review 后）**：§9.1 分段控件那行补上了 `min-h-11 min-w-11`——单照抄 `ThreeNotesPerString.tsx:71-94` 实测只有 27×43px，达不到本方案自己定的 44pt 触摸目标；§11 用例数由 36 校正为 38；§2 「设计系统的一档字号」这句旧结论已改掉。§13 第 1 项（导航拥挤）已由实测结论回答。

## 1. 需求盘点

把原始需求逐条翻译成可执行条目，并标出落点阶段。

| # | 用户原话 | 理解 | 本方案落点 | 阶段 |
| --- | --- | --- | --- | --- |
| 1 | 纯前端可实现，不涉及后端 | 无接口、无数据库、无账号；构建产物仍是静态导出 | Web Audio API 在浏览器里合成声音，页面走静态路由 | 1 / 2 |
| 2 | 页面要简化，适配手机，方便快速点击 | 单列、无侧栏、无长文；控件在拇指可及区；触摸目标 ≥44pt | 单屏布局，主按钮 64px 高 | 2 |
| 3 | 页面上可以进行基础音效的选择 | 2–3 种音色，切换即时生效，不需要下载素材 | 合成三种音色（木质 / 电子 / 机械） | 1 / 2 |
| 4 | 顶部选择节拍（拍号） | 常见拍号即可，含复合拍重音 | 6 种拍号 + 重音模型 | 1 |
| 5 | BPM 速度「由你来做效果」 | 速度控件的形式由我定，但要简单 | 大号读数 + 滑杆 + ±1 按钮 + 速度术语 | 2 |
| 6 | 大号开始/暂停 + 小号结束 | 一个主按钮承担开始/暂停，结束是次级动作 | 主按钮 toggle，结束 = 停止并回到第 1 拍 | 2 |

## 2. 范围

**做：** 拍号选择、BPM 控制、三种音色、开始/暂停/结束、拍点指示、键盘操作、移动端布局。

**不做（与 `CLAUDE.md` §刻意不做 一致，或明确列为 P2）：**

- 后端、账号、云同步、练习打卡、进度统计、复习提醒
- 曲谱播放、录音、多轨、鼓机、节奏型编辑
- 暗色模式、PWA / 离线安装
- CI（仓库明确不做）
- **P2 候选（默认不做，需要时再提）**：Tap tempo 测速、屏幕常亮（Wake Lock）、记住上次的拍号/BPM/音色、自定义拍号（9/8、12/8）

`content/manifest.ts` 不变：节拍器不是「资料」，不登记进清单。改动只涉及新路由、新组件、新纯函数模块**和 `SiteNav.tsx` 的一个入口**；**不改全站设计系统**——不加字号档位、不加语义令牌、不改 `DESIGN.md` §3（见 §9）。

## 3. 页面结构

信息顺序按「先定拍子 → 再定速度 → 最后动手」：

```
┌─────────────────────────────┐
│ 导航（首页 / 资料库 / 节拍器） │
├─────────────────────────────┤
│ 拍号                         │  4/4  3/4  2/4  6/8  5/4  7/8
│ [4/4][3/4][2/4][6/8][5/4][7/8]│  ← 分段控件，44pt
│                             │
│            96               │  ← 大号读数（text-6xl + tabular-nums）
│         Andante             │  ← 速度术语
│  −   ●━━━━━━━━━━━━━   +     │  ← 滑杆 + ±1，30–240
│                             │
│      ● ○ ○ ○                │  ← 拍点指示，当前拍高亮
│                             │
│ ┌─────────────────────────┐ │
│ │         开始            │ │  ← 主按钮，64px 高
│ └─────────────────────────┘ │
│           结束              │  ← 小号文字按钮，44pt 命中
│                             │
│ 音色   [木质][电子][机械]     │  ← 分段控件
└─────────────────────────────┘
```

- 桌面端同样单列，最大宽度约 40em（`max-w-[40rem]`），不为了填满宽屏而拉散。
- 页面不复用首页的大标题块：顶部直接进拍号，减少一次滚动。

## 4. 交互与状态机

三个状态：`idle`（未开始）、`running`、`paused`。

| 动作 | 当前状态 | 结果 |
| --- | --- | --- |
| 点主按钮 | `idle` | → `running`，从第 1 拍开始 |
| 点主按钮 | `running` | → `paused`，停在下一次该响的拍子上 |
| 点主按钮 | `paused` | → `running`，从暂停的那一拍继续 |
| 点结束 | `running` / `paused` | → `idle`，拍点指示回到第 1 拍 |
| 点结束 | `idle` | 无动作，按钮 `disabled` |
| 改拍号 | 任意 | 立即生效；`running` 时从新小节第 1 拍重新起算 |
| 改 BPM | 任意 | 立即生效；`running` 时下一拍起用新间隔，不重置小节位置 |
| 切音色 | 任意 | 立即生效，不打断节拍 |

**键盘：** `Space` 切换开始/暂停，`Esc` 结束。`Space` 在滑杆或按钮获得焦点时不劫持（避免和原生行为打架）。

**已在排程的拍子必须可撤销。** 120ms 的向前看意味着改拍号 / 改 BPM / 切音色 / 暂停 / 结束时，音频时钟里可能已经排进了 1–2 个还没发声的点击。只改 React 状态而不撤销这些已排程节点，会听到旧参数漏出来的点击，与上表「立即生效」不符。因此音频封装必须提供 `cancelFrom(time)`：把 `time` 之后已排程的 source 全部 `stop()` 并清空队列，再按新参数重建。这一条是 Stage 2 的实现前提，不是可选项。

**页面隐藏 / 恢复：** `visibilitychange` 到 hidden 时停止调度并 `suspend()`，同时把状态从 `running` **显式改为 `paused`**（按钮回到「开始」）。只清 interval 而不改状态，会让界面停在 `running` 却不再出声，用户点一下只是把它「暂停」掉。回到 visible 时**不自动恢复**：等用户再点一次主按钮，从暂停的那一拍继续——这同时满足 iOS 切后台后需要新手势才能解锁音频的要求。

**音频解锁：** AudioContext 在第一次用户点击（开始按钮）时创建并 `resume()`，满足 iOS Safari 的手势要求。不使用自动播放。

## 5. 拍号与重音模型

| 拍号 | beatsPerBar | beatUnit | 重音拍（0 起） | 说明 |
| --- | --- | --- | --- | --- |
| 4/4 | 4 | 4 | `[0]` | 默认 |
| 3/4 | 3 | 4 | `[0]` | 圆舞曲 |
| 2/4 | 2 | 4 | `[0]` | 进行曲 |
| 6/8 | 6 | 8 | `[0, 3]` | 复合拍，两个大拍 |
| 5/4 | 5 | 4 | `[0]` | 3+2 听感，只重音第 1 拍 |
| 7/8 | 7 | 8 | `[0, 2, 4]` | 2+2+3 |

规则：单拍子只重音第 1 拍；复合拍（6/8）每三个八分音符一个重音；7/8 按 2+2+3。

声音区分：重音用高音 + 原音量，弱拍降一个八度附近（频率 ×0.72）并 −6dB。**不用两套素材**，同一音色按参数区分即可。

## 6. BPM 方案

- 范围 **30–240**，默认 **90**，步进 1。超出范围夹紧。
- 控件：`−1` 按钮、原生 `input[type=range]`（step 1）、`+1` 按钮。滑杆命中区 44pt，焦点环沿用全站 `:focus-visible`。
- 读数：大号数字（等宽数字 `tabular-nums`，避免变化时抖动）+ 速度术语。
- 速度术语（近似区间，只作提示，不参与计算）：Largo <60、Adagio 60–75、Andante 76–107、Moderato 108–119、Allegro 120–167、Presto ≥168。
- 不做数字直接编辑：手机上调出键盘会顶起页面，滑杆 + ±1 已经够快。
- 不做 Tap tempo（P2）。

## 7. 音效方案与素材调研

### 调研记录（ego 浏览器，2026-10-18）

| 站点 | 结果 | 判断 |
| --- | --- | --- |
| Freesound | 搜「metronome click」376 条，CC0 160 条（如 MPC Metronome click - High、Click Metronome atonal high、Metronome 1kHz） | 素材质量高，但**下载需要登录**，自动化取不到；逐个素材还要登记署名与授权文件 |
| Pixabay | 触发 Cloudflare 人机验证 | 不可用 |
| Mixkit | 免费音效站，可下载，Sound Effects Free License | 可下载但需要逐个裁切、统一响度，授权条款要随仓库记录 |
| Wikimedia Commons | 有真实节拍器录音：`Metronome_60bpm.wav`（**CC0**，10.7 MB，1 分钟整段）、`Sound_Classic_Metronome_96.ogg`（CC BY-SA 4.0，389 KB）、`Pulse_4x4.ogg`（CC BY-SA 3.0） | 授权干净，但都是**整段节拍**而不是单次点击；直接用会把 BPM 锁死，必须裁出单次点击 |

### 结论：主方案用 Web Audio 合成，素材作为 P2 备选

理由：

1. **时间精度。** 合成音的起播时间由 `AudioContext.currentTime` 决定，不受解码/缓冲抖动影响；素材播放要多一层 decode 与 sample 起始偏移校准。
2. **体积与授权。** 合成是 0 字节、0 授权登记；Commons 的 CC0 文件是 10.7 MB 整段录音，必须裁切后再归一化响度，属于额外工序。
3. **音色选择本身就是参数差异**（频率、包络、噪声量），合成天然支持「木质 / 电子 / 机械」三种，且重音/弱拍只改参数。

三种音色（都用 OscillatorNode / BufferSource 噪声 + GainNode 包络，不用第三方库）：

| 音色 | 设计 | 听感 |
| --- | --- | --- |
| 木质（默认） | 8ms 带通噪声瞬态（中心约 2.4kHz）+ 三角波 1.2kHz 指数衰减 45ms | 木鱼 / 节拍器敲击 |
| 电子 | 方波 2kHz，20ms 指数衰减，起音 1ms | 电子节拍器 / 录音棚 click |
| 机械 | 5ms 高通噪声 + 800Hz / 1.6kHz 两个短谐波，衰减 30ms | 老式机械节拍器的金属咔哒 |

**如果确认要「真实录音」音色（P2）：** 从 Commons 的 CC0 文件裁出 30–60ms 单次点击，转 mono 44.1kHz，约 3–5 KB，放 `public/sounds/`，并在 `docs/` 记录来源 URL、作者与授权。这件事单独做，不阻塞三个阶段。

## 8. 技术实现要点

- **调度**：lookahead scheduler —— 25ms 的 `setInterval` 只负责「往音频时钟里排拍子」，每次向前看 120ms，用 `AudioContext.currentTime + offset` 精确排程。不用 `setInterval` 直接发声（手机浏览器会漂移）。
- **纯逻辑抽到 `lib/metronome.ts`**（可单测、不碰 DOM）：`METERS`、`accentIndexes`、`bpmToIntervalMs`、`clampBpm`、`tempoName`、`nextBeat`。
- **音频封装在 `lib/metronome-audio.ts`**：只在客户端组件里引用，导出 `createMetronomeAudio()`，内部管 AudioContext、音色参数、`schedule(beatIndex, time, meter)`。便于将来换实现。
  - **Stage 1 已落地现状（`origin/main`）**：`createMetronomeAudio()` 提供 `timbre` / `setTimbre` / `state` / `currentTime` / `resume` / `schedule` / `suspend` / `dispose`；另有 `TIMBRES`、`DEFAULT_TIMBRE`、`isAccentBeat`、`clickParams`。**尚无 `cancelFrom`**。
  - **Stage 2 必须补 `cancelFrom(time: number): void`**（见 §4）：记录每次排程的 `AudioScheduledSourceNode`，`cancelFrom` 把 `start` 在 `time` 之后的 source 逐个 `stop(0)` 并从队列移除，然后才允许按新参数重排。同时补对应用例到 `tests/metronome.test.ts`。这是 Stage 2 的范围，不是重做 Stage 1。
- **组件 `components/Metronome.tsx`**（`"use client"`）：状态机 + 调度器 + 控件；调度器与 AudioContext 放 `useRef`，不用全局状态、不加依赖。
- **页面 `app/metronome/page.tsx`**：`metadata.title = "节拍器"`，只做壳，渲染 `<Metronome />`。
- **导航**：`components/SiteNav.tsx` 增加「节拍器」入口。`DESIGN.md` §4「全站导航」当前写的是「只突出……首页、资料库等主要入口」，加第三项与它不矛盾，但需在 Stage 2 顺手把该句补成「首页 / 资料库 / 节拍器」。（注意：导航在 `DESIGN.md` 的 **§4**，不是 §5；§5 是「组件与内容表达」。）
- **静态导出兼容**：无动态路由、无服务端读取、无 `window` 顶层访问。
- **清理**：`useEffect` 卸载时 `clearInterval` + `dispose()`；`visibilitychange` 到 hidden 时 `clearInterval` + `suspend()` **并把状态改为 `paused`**（见 §4）。

## 9. 设计系统边界（重要：本方案不假定不存在的原语）

`origin/main` 上的 `app/globals.css` 只有 71 行，**只有颜色与字体族令牌**：没有任何字号档位（`--text-*`）、没有 `--container-measure` / `--radius-card`、没有 `.segment` / `.segment-track` 组件层类，`tests/design-system.test.ts` 也不存在。`DESIGN.md` §3 只有散文描述（「应形成明确的字号阶梯」），没有字号表。

这是本方案在 Stage 0 的一个真实错误：初稿把这些当成「现有令牌与类」并计划在 Stage 3 同步「六档改七档」，等于让 Stage 2 复用不存在的样式、让 Stage 3 修改不存在的测试。已按下面两选一修正，**本阶段不替全站拍板设计系统**。

### 9.1 推荐方案（Stage 2 直接可行）：只用现有 Tailwind utility

不新增任何令牌、不改 `DESIGN.md`、不动 `tests/design-system.test.ts`（它不存在，也不由本任务创建）：

| 需求 | 实现 | 说明 |
| --- | --- | --- |
| BPM 大号读数 | `text-6xl font-semibold tabular-nums leading-none` | 60px；`tabular-nums` 防抖动。现有最大 `text-4xl`（首页 h1）不够大，但 `text-6xl` 是 Tailwind 内置档位，不算任意值 |
| 拍号 / 音色分段控件 | 照抄 `components/ThreeNotesPerString.tsx:71-94` 的 `aria-pressed` 模式，**并补 `min-h-11 min-w-11`** | `role="group"` + `aria-pressed` + `rounded-sm border border-control-edge p-0.5`；按钮 `min-h-11 min-w-11 flex-1 rounded-sm px-1 text-sm font-medium`；选中态 `bg-accent-700 text-white`。这是仓库内**已验证存在**的模式，不依赖 `.segment`。**`min-h-11 min-w-11` 不能省**：单照抄 `71-94` 的 `px-3 py-1.5` 实测只有 27×43px，不到 §1 / §10 定的 44pt 触摸目标（`min-w-11` 取 `LibraryBrowser.tsx:34` 现成写法）。补上后按钮 44×44px、六项横排 270px，390px 一行放得下、无横向溢出 |
| 主按钮 64px | `h-16 w-full rounded-md bg-accent-700 text-white text-lg font-medium` | 组件层类不新增，全部内联 utility |
| 结束按钮 44px 命中 | `min-h-11` + `text-sm text-ink-700` | `min-h-11` 是仓库现用写法（`LibraryBrowser.tsx:34`） |
| 拍点圆点 | `size-3 rounded-full bg-accent-600` / `bg-ink-100 ring-1 ring-rule` | 同 `ThreeNotesPerString.tsx:137-144` |
| 容器宽度 | `mx-auto w-full max-w-[40rem] px-5` | 直接用长度，不引用不存在的 `--container-measure` |
| 圆角 | `rounded-md`（现有 utility） | 不引用不存在的 `--radius-card` |

优点：不产生跨页面的设计系统改动，Stage 2 可立即开工，不阻塞在全站令牌重构上。代价：`text-6xl` 是个具体档位，如果将来全站建字号阶梯，需要回来把它收敛成语义令牌。

### 9.2 备选方案（需先做前置任务）：先建设计系统，再做节拍器

如果希望节拍器就用语义令牌（`text-numeral`、`--container-measure`、`.segment`），必须**先**有一个独立的前置 issue 完成：`@theme` 建字号阶梯、`DESIGN.md` §3 加字号表、新建 `tests/design-system.test.ts` 守护阶梯。那是全站改动，**不属于 BLF-1364 的范围**，且会让 Stage 2 被它阻塞。

**决定：走 9.1。** Stage 2 的验收按 9.1 的写法检查；Stage 3 不再包含「`--text-numeral` 与 `DESIGN.md` 同步」这项（它已被移除，见 §12），只做动效、可访问性与真机验收。

## 10. 可访问性

- **不逐拍 `aria-live`。** 每拍播报会把读屏刷屏。拍点指示整组 `aria-hidden="true"`，另配 `sr-only` 文本「第 2 拍，共 4 拍」，由视觉用户和读屏用户各自取用。
- 状态变化（开始 / 暂停 / 结束）用 `role="status"` 播报一次；BPM 变化用 `aria-live="polite"` 且节流到 400ms，避免拖动滑杆时连播。
- 滑杆有可访问名「速度」与 `aria-valuetext`（如「每分钟 96 拍」）。
- 所有控件键盘可达，焦点环沿用全站样式；触摸目标 ≥44pt，主按钮 ≥64pt。
- `prefers-reduced-motion: reduce` 下拍点只换颜色，不做缩放/淡入动画。
- 不新增颜色，全部复用现有令牌，对比度门禁自动覆盖。

## 11. 验证计划

**自动化：**

- `tests/metronome.test.ts`：拍号模型与重音索引、BPM 边界夹紧与取整、BPM → 间隔毫秒、速度术语边界、节拍推进（含 6/8 与 7/8）。已在 Stage 1 落地（38 个用例，均为 `it()`，无 `it.each`）。
- `npm run typecheck && npm test && npm run build`（静态导出必须成功）。
- **不新增** `tests/design-system.test.ts`：它在本仓库不存在，也不由本任务创建（见 §9）。

**人工（每阶段结束）：**

- 1440 与 390 两个宽度截图核对布局、无横向溢出、按钮在拇指区。
- Safari 响应式 / iOS 真机验证：首次点击能出声、切后台会停、锁屏回来不重复播放。
- 键盘走一遍：Tab 顺序、Space 切换、Esc 结束、滑杆方向键。
- 开启「减弱动态效果」确认无动画残留。
- 读屏抽查：状态变化只播报一次。

## 12. 分阶段拆分

| 阶段 | 内容 | 产出 | 验收 |
| --- | --- | --- | --- |
| **Stage 0** | 本方案（需求盘点、交互、拍号模型、音效调研、拆分） | 本文档 | 用户确认 |
| **Stage 1** | 拍号/BPM 逻辑与音频引擎：`lib/metronome.ts`、`lib/metronome-audio.ts`、`tests/metronome.test.ts` | 纯逻辑 + 单测，无 UI | 单测通过，typecheck 通过 |
| **Stage 2** | 页面与交互：`app/metronome/page.tsx`、`components/Metronome.tsx`、导航入口、移动端布局 | 可用的节拍器页面 | 两个宽度截图 + 构建通过 |
| **Stage 3** | 打磨与验收：拍点动效、减弱动态效果、读屏、真机音频解锁、（可选）CC0 素材音色 | 打磨与验收 | 全量测试 + 人工清单逐条勾选 |

Stage 1 与 Stage 2 有依赖关系（2 用 1 的 API），Stage 3 在 2 之后。

**注：** Stage 3 原计划包含「`--text-numeral` 与 `DESIGN.md` 同步」，因该设计系统原语在 `origin/main` 不存在，已改走 §9.1（纯 Tailwind utility），这一项从 Stage 3 移除。

## 13. 风险与待确认

1. **导航第三项在 390px 是否拥挤。** 实测结论：430 / 390 / 375 / 360px 全部单行，header 54px 高，不挤；只有窄于 350px（含 320px）才换两行（header 82px），这是 `SiteNav` 已有的 `flex-wrap` 优雅降级。**结论：不为节拍器改站点名，不动全站。**
2. **字号方案已定（§9.1）**：BPM 读数用 `text-6xl`，不新增 `--text-numeral`，不改 `DESIGN.md`。如果以后要做全站字号阶梯，那是独立的前置 issue，不阻塞本任务。
3. **音效是否必须是真实录音。** 本方案默认合成（体积 0、授权 0、精度最高）。若坚持真实录音，走 P2 的 CC0 裁切流程，多一道素材工序。
4. **P2 项**（Tap tempo、屏幕常亮、记住上次设置）默认不做；其中「记住上次设置」在手机上是真需求，建议 Stage 3 后单独评估。
5. **拍号集合** 默认 6 种；9/8、12/8 这类需要时再加，不影响模型（`beatsPerBar` + `accents` 已能表达）。
