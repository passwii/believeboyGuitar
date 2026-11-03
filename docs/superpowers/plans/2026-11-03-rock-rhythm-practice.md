# 摇滚节奏型练习实施计划

> **For agentic workers:** Execute the steps inline in this session. Keep each test-first change small and verify before moving on.

**Goal:** Add a standalone 摇滚节奏型 practice entry with a reusable, accurate 12-bar TAB rendering.

**Architecture:** Generalize the manifest and picker from weeks to practice entries while preserving current week labels. Extend the shared TAB data and SVG renderer for simultaneous chord tones and per-measure technique annotations, then provide the 12-bar rock rhythm as one continuous `TabDrill` section; `TabStaff` lays it out in three four-bar desktop systems.

**Tech Stack:** Next.js static export, TypeScript, React SVG, Vitest, semantic lesson HTML.

## Global Constraints

- `content/manifest.ts` is the sole practice directory source.
- Lesson HTML uses `<article>` and semantic tags only; widgets are registered in `content/widgets.ts` and mapped in `components/LessonWidget.tsx`.
- TAB remains six-string TAB with 1st string at the top; do not add standard notation.
- Reuse shared score components and semantic design tokens.
- Run `npm run typecheck && npm test && npm run build`; inspect the resulting practice page.

---

### Task 1: Generalize practice directory terminology

**Files:**
- Modify: `content/manifest.ts`
- Modify: `lib/weekly.ts`
- Modify: `app/practice/page.tsx`
- Modify: `app/practice/[slug]/page.tsx`
- Modify: `components/PracticeEntryPicker.tsx`
- Test: `tests/weekly.test.ts`, `tests/practice-week-picker.test.ts`, and practice page tests

- [x] Add assertions that a standalone entry may use the same label and title without duplicated heading text, and that picker wording is generic.
- [x] Run the focused Vitest files and confirm the new expectations fail.
- [x] Rename the manifest collection and entry type to practice-entry terminology, preserving existing routes and their labels.
- [x] Render a same-name standalone entry without duplicating its name in list rows or page headings.
- [x] Run focused tests and typecheck.

### Task 2: Extend reusable TAB events and annotations

**Files:**
- Modify: `lib/tab.ts`
- Modify: `lib/tab-timing.ts`
- Modify: `components/TabStaff.tsx`
- Modify: `components/TabSystems.tsx`
- Modify: `components/TabDrill.tsx`
- Test: `tests/tab-score.test.ts`, `tests/tab-timing.test.ts`, `tests/tab-layout.test.ts`

- [x] Add failing tests for simultaneous chord tones counting as one timing event and rendering at the same rhythmic slot.
- [x] Add failing tests for shared chord labels and palm-mute ranges rendering from measure data.
- [x] Run focused tests and confirm the expected failures.
- [x] Add a reusable chord-tone representation and measure annotations for chord labels, palm-mute ranges, slide and tie markings.
- [x] Keep note timing, accessible descriptions, and mobile system wrapping event-based.
- [x] Run focused tests and typecheck.

### Task 3: Add the 12-bar rock rhythm entry

**Files:**
- Create: `lib/rock-rhythm-tab-exercises.ts`
- Create: `components/RockRhythmTabDrill.tsx`
- Modify: `content/manifest.ts`
- Modify: `content/widgets.ts`
- Modify: `components/LessonWidget.tsx`
- Create: `content/lessons/rock-rhythm-pattern.html`
- Test: `tests/rock-rhythm-tab.test.ts`, `tests/content.test.ts`

- [x] Add failing data tests for one 12-bar section, 4/4 at 160 BPM, chord positions, and source-derived techniques.
- [x] Run the focused test and confirm it fails because the entry and score are missing.
- [x] Encode the 12 measures from the supplied images without inventing unclear pitches or durations; annotate any uncertain source details in the lesson notes.
- [x] Register the new widget and add exactly one manifest entry and matching lesson file.
- [x] Verify static HTML includes chord tones, annotations, per-measure data, and accessible score descriptions.
- [x] Run focused tests and typecheck.

### Task 4: Verify rendered practice experience

**Files:**
- Inspect: `/practice/rock-rhythm-pattern` output

- [x] Run `npm run typecheck && npm test && npm run build`.
- [x] Inspect the rendered desktop and mobile score, checking the three four-bar systems, chord labels, palm-mute lines, readable fret numbers, and page overflow.
- [x] Review the diff for unrelated edits, temporary output, and content-contract violations.
