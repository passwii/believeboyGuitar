# 练习节拍器统一控制实施计划

> **For agentic workers:** Execute this plan task by task in the current worktree. Each task starts with a failing test and ends with its focused verification.

**Goal:** 统一节拍器练习页的 5 BPM 步进、空格快捷键、周练暂停续播与桌面悬浮控制。

**Architecture:** 共用一个 Space 键事件绑定器和按键安全规则；各播放器保留自己的状态与音频实例。`TabDrill` 用可测试的节拍时间线函数保存暂停 beat offset，桌面悬浮控件通过原有 `TabDrill` 状态控制 BPM 和播放。

**Tech Stack:** Next.js 16.4.1、React 19.3.0、TypeScript、Vitest 5、现有 CSS 语义令牌。

## Global Constraints

- `BPM_STEP` 保持为 5；练习中的加减按钮复用该共享常量。
- `TabDrill` 音频和谱面高亮共用同一时间线。
- 悬浮控制只在宽屏周练详情页显示；窄屏继续用行内控制。
- Space 不劫持原生控件、自定义速度滑杆、输入法组合或重复按键。
- 使用现有语义颜色、字号、触控尺寸；不增加依赖。
- 最终执行 `npm run typecheck && npm test && npm run build`，并检查桌面和手机周练页面。

---

### Task 1: 共用 Space 键绑定与安全规则

**Files:**
- Create: `lib/metronome-keyboard.ts`
- Create: `tests/metronome-keyboard.test.ts`
- Modify: `components/Metronome.tsx`
- Modify: `components/PracticeMetronome.tsx`
- Modify: `components/TabDrill.tsx`
- Modify: `tests/metronome-a11y.test.ts`
- Modify: `tests/practice-metronome.test.ts`

**Interface:**
- `bindMetronomeSpaceShortcut(host, toggle): () => void`
- Shared handler accepts only unmodified, non-repeating Space keydowns outside editable/native interactive/custom slider targets and prevents scrolling only when it toggles.

- [x] Add pure event-handler tests for activation, default-prevented, repeat, composition, modifiers, interactive target, slider target, and group target.
- [x] Run `npx vitest run tests/metronome-keyboard.test.ts` and confirm the new import is missing.
- [x] Implement the binding helper and use it from the three player components.
- [x] Mark each transport button with `aria-keyshortcuts="Space"` and update source-based tests to assert the shared binding.
- [x] Run the focused keyboard and accessibility tests.

### Task 2: Preserve the weekly practice playhead on pause

**Files:**
- Create: `lib/tab-drill-playhead.ts`
- Create: `tests/tab-drill-playhead.test.ts`
- Modify: `components/TabDrill.tsx`
- Modify: `tests/practice-metronome.test.ts`

**Interface:**
- `elapsedBeatsAt(timeline, audioTime, bpm): number`
- `eighthPositionAt(timeline, audioTime, bpm, loopEighths): number`
- `nextBeatAfter(elapsedBeats): number`, returning beat 0 for a fresh start and the next whole beat after a paused position.
- `beatTimeForResume(timeline, bpm): number`

- [x] Test fresh start, pause before the scheduled start, fractional beat progress, loop wrapping, and resumed next-beat time.
- [x] Run `npx vitest run tests/tab-drill-playhead.test.ts` and confirm it fails because the module is absent.
- [x] Implement timeline helpers and update `TabDrill` to save beat offset, cancel future audio on pause, retain the playhead, and schedule the next beat when resumed.
- [x] Add a start-generation guard so a second Space press during audio unlock cancels the pending start consistently.
- [x] Run the focused playhead and practice metronome tests.

### Task 3: Unify 5 BPM controls and add the desktop practice float

**Files:**
- Modify: `components/PracticeMetronome.tsx`
- Modify: `components/TabDrill.tsx`
- Modify: `app/globals.css`
- Modify: `tests/practice-metronome.test.ts`
- Modify: `DESIGN.md`

- [x] Add failing assertions for shared `BPM_STEP` use, float controls, accessible expand/collapse state, and the reserved desktop rail.
- [x] Run `npx vitest run tests/practice-metronome.test.ts` and confirm the assertions fail against current controls.
- [x] Update both exercise players to use ±`BPM_STEP` and expose descriptive button labels.
- [x] Add a compact right-center control for wide weekly pages, reveal ±5 controls on explicit expansion, keep one audio state, and hide the duplicate inline group only at the wide breakpoint.
- [x] Reserve 13rem of page width for the float at the chosen wide breakpoint and keep the phone layout unchanged.
- [x] Update `DESIGN.md` with the agreed interaction contract and Space-key scope.
- [x] Run the focused practice, design-system, and accessibility tests.

### Task 4: Full verification and visual review

**Files:**
- Review changed files and final diff.

- [x] Run `npm run typecheck && npm test && npm run build`.
- [x] Inspect the weekly practice page at 1440px and 390px; confirm the side rail does not cover TAB and the mobile page has only its inline controls.
- [x] Check Space with body focus, transport button focus, and BPM slider focus; confirm only the intended player toggles and the page does not scroll when the shortcut handles Space.
- [x] Review `git diff --check` and `git status --short`.
