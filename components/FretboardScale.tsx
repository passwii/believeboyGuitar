import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { PracticeMetronome } from "@/components/PracticeMetronome";
import { playGuitarPluck } from "@/lib/guitar-pluck";
import { STANDARD_TUNING } from "@/lib/guitar";
import {
  buildScaleNotes,
  nextFretboardString,
  SCALE_PATHS,
  type ScaleNote,
} from "@/lib/fretboard-scale";

const NOTES = buildScaleNotes();
const STRINGS = [1, 2, 3, 4, 5, 6] as const;
const COLOR_VARS = SCALE_PATHS.map((path) => path.colorVar);
const BOARD_LEFT = 46;
const BOARD_TOP = 15;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
}

function NoteMark({
  note,
  activePath,
  activeString,
  pluckedNote,
}: {
  note: ScaleNote;
  activePath: "all" | number;
  activeString: number | null;
  pluckedNote: string | null;
}) {
  const visible =
    (activePath === "all" || note.pathIds.includes(activePath)) &&
    (activeString === null || note.stringNumber === activeString);
  const plucked = pluckedNote === note.key;
  const radius = 13;
  const colors =
    activePath === "all"
      ? note.pathIds.map((id) => COLOR_VARS[id - 1])
      : [COLOR_VARS[activePath - 1]];
  const x = noteX(note.fret);
  const y = stringY(note.stringNumber);

  return (
    <g opacity={visible ? 1 : 0.13} className={plucked ? "scale-note is-plucked" : "scale-note"}>
      <desc>
        {note.stringNumber} 弦 {note.fret} 品 · {note.degree} 级 · 路径{" "}
        {note.pathIds.join(" / ")}
      </desc>
      {colors.length > 1 ? (
        <>
          <circle cx={x} cy={y} r={radius} fill={colors[0]} />
          <path d={arcPath(x, y, radius, -Math.PI / 2, Math.PI / 2)} fill={colors[1]} />
          {colors.length > 2 ? (
            <circle
              cx={x}
              cy={y}
              r={radius - 4}
              fill="none"
              stroke={colors[2]}
              strokeWidth="2"
            />
          ) : null}
        </>
      ) : (
        <circle cx={x} cy={y} r={radius} fill={colors[0]} />
      )}
      <circle cx={x} cy={y} r={radius} fill="none" stroke="#fbfcf8" strokeOpacity=".18" />
      {plucked ? (
        <circle
          cx={x}
          cy={y}
          r={radius + 6}
          fill="none"
          stroke="var(--color-accent-700)"
          strokeWidth="1.5"
          opacity=".8"
          className="scale-note-ring"
        />
      ) : null}
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fill="white"
        fontFamily="var(--font-mono)"
        fontSize="9"
        fontWeight="700"
      >
        {note.degree}
      </text>
    </g>
  );
}

function noteX(fret: number) {
  return 46 + (fret - 0.5) * 50;
}

function stringY(stringNumber: number) {
  return 30 + (stringNumber - 1) * 31;
}

/**
 * 琴弦的阻尼振动波形。
 *
 * 能量由 `pluckString` 注入，逐帧衰减；振幅固定到所在弦的 y，
 * 两端被琴枕 / 琴桥约束，越靠近中间摆动越大——这是弦的物理模态，
 * 而不是给整条线加一个 CSS 位移。
 */
function stringPath(stringNumber: number, energy: number): string {
  const baseY = stringY(stringNumber);
  const amplitude = energy * 7;
  if (amplitude <= 0.01) {
    return `M ${BOARD_LEFT} ${baseY} H 796`;
  }
  const points: string[] = [];
  for (let x = BOARD_LEFT; x <= 796; x += 18) {
    const ratio = (x - BOARD_LEFT) / (796 - BOARD_LEFT);
    const envelope = Math.sin(Math.PI * ratio);
    const wave = Math.sin(ratio * Math.PI * (2 + stringNumber)) * envelope * amplitude;
    points.push(`${x} ${baseY + wave}`);
  }
  return `M ${points.join(" L ")}`;
}

export function FretboardScale() {
  const [activePath, setActivePath] = useState<"all" | number>("all");
  const [activeString, setActiveString] = useState<number | null>(null);
  const [pluckedString, setPluckedString] = useState<number | null>(null);
  const [pluckedNote, setPluckedNote] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(false);
  const [status, setStatus] = useState("");
  const [stringEnergy, setStringEnergy] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const statusTimer = useRef<number | null>(null);
  const activeStringRef = useRef<number | null>(null);
  const pluckTimer = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const energyRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);

  const announce = useCallback((message: string) => {
    setStatus(message);
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 3200);
  }, []);

  useEffect(
    () => () => {
      if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
      if (pluckTimer.current !== null) window.clearTimeout(pluckTimer.current);
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    },
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (energyRef.current.some((energy) => energy > 0)) {
        const settled = energyRef.current.map(() => 0);
        energyRef.current = settled;
        setStringEnergy(settled);
      }
      return;
    }
    if (stringEnergy.some((energy) => energy > 0) && animationRef.current === null) {
      const step = () => {
        const next = energyRef.current.map((energy) => (energy > 0.01 ? energy * 0.93 : 0));
        energyRef.current = next;
        setStringEnergy(next);
        if (next.some((energy) => energy > 0)) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          animationRef.current = null;
        }
      };
      animationRef.current = requestAnimationFrame(step);
    }
  }, [reducedMotion, stringEnergy]);

  const pluckString = useCallback(
    (stringNumber: number, fret: number, noteKey?: string) => {
      const energy = energyRef.current.slice();
      energy[stringNumber - 1] = reducedMotion ? 0 : 1;
      energyRef.current = energy;
      setStringEnergy(energy);
      setPluckedString(stringNumber);
      setPluckedNote(noteKey ?? `${stringNumber}-${fret}`);
      const openMidi =
        STANDARD_TUNING.find((tuning) => tuning.number === stringNumber)?.openMidi ?? 40;
      playGuitarPluck(openMidi + fret, 0.7);
      if (pluckTimer.current !== null) window.clearTimeout(pluckTimer.current);
      pluckTimer.current = window.setTimeout(() => {
        setPluckedString(null);
        setPluckedNote(null);
      }, reducedMotion ? 240 : 850);
    },
    [reducedMotion],
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      setLandscape(false);
      announce("已退出横屏");
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [announce]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key !== "Enter" && event.key !== "p") return;

      const target = event.target;
      const interactive =
        target instanceof Element
          ? target.closest("input, textarea, select, button, a, [contenteditable='true']")
          : null;
      if (interactive) return;

      event.preventDefault();
      if (event.key === "p") {
        const stringNumber = activeStringRef.current ?? 6;
        pluckString(stringNumber, 0);
        announce(`试听 ${stringNumber} 弦空弦`);
        return;
      }
      const nextString = nextFretboardString(activeStringRef.current);
      activeStringRef.current = nextString;
      setActiveString(nextString);
      announce(`当前选中 ${nextString} 弦`);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [announce, pluckString]);

  async function toggleLandscape() {
    const next = !landscape;
    setLandscape(next);

    if (!next) {
      try {
        (screen.orientation as LockableOrientation | undefined)?.unlock?.();
        if (document.fullscreenElement) await document.exitFullscreen();
      } finally {
        announce("已退出横屏");
      }
      return;
    }

    let fullscreen = Boolean(document.fullscreenElement);
    let locked = false;
    try {
      if (!fullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        fullscreen = true;
      }
    } catch {
      // iOS Safari 不支持任意页面元素全屏。
    }
    try {
      const orientation = screen.orientation as LockableOrientation | undefined;
      if (orientation && typeof orientation.lock === "function") {
        await orientation.lock("landscape");
        locked = true;
      }
    } catch {
      // iOS 与部分浏览器没有 Orientation Lock。
    }

    announce(
      locked
        ? "已锁定真实横屏"
        : fullscreen
          ? "浏览器不支持方向锁定，已切换横屏布局"
          : "当前设备不支持自动横屏，已切换专注布局",
    );
  }

  return (
    <div className={`fretboard-scale ${landscape ? "fretboard-scale--landscape" : ""}`}>
      <header className="fretboard-scale__header">
        <a
          href="/library"
          aria-label="返回资料库"
          className="grid size-11 place-items-center rounded-full border border-rule bg-surface text-ink-700"
        >
          <Icon name="back" className="size-4" />
        </a>
        <div className="min-w-0 flex-1">
          <h1 className="text-title text-ink-950">指板音阶</h1>
          <p className="text-micro uppercase text-ink-500">C major · 15 frets</p>
        </div>
        <button
          type="button"
          aria-pressed={landscape}
          onClick={() => void toggleLandscape()}
          className="scale-orientation-toggle"
        >
          <Icon name="orientation" className="size-4" />
          {landscape ? "退出横屏" : "横屏"}
        </button>
      </header>

      <PracticeMetronome />

      <div className="scale-path-controls" role="group" aria-label="颜色路径">
        <button
          type="button"
          aria-pressed={activePath === "all"}
          onClick={() => setActivePath("all")}
          className="scale-path-chip scale-path-chip--all"
        >
          <span />
          全部
        </button>
        {SCALE_PATHS.map((path) => (
          <button
            key={path.id}
            type="button"
            aria-pressed={activePath === path.id}
            onClick={() => setActivePath(path.id)}
            className="scale-path-chip"
          >
            <span className={path.colorClass} />
            {String(path.id).padStart(2, "0")} · {path.label}
          </button>
        ))}
      </div>

      <div
        className="scale-board-viewport"
        role="group"
        aria-label="指板音阶"
        aria-describedby="practice-metronome-help"
          aria-keyshortcuts="Enter Space P"
        tabIndex={0}
      >
        <svg
          role="img"
          aria-label={
            activeString === null
              ? "C 大调十五品六色指板音阶，一弦在上，六弦在下"
              : `C 大调十五品指板音阶，当前选中 ${activeString} 弦`
          }
          viewBox="0 0 820 220"
          className="scale-board"
        >
          <defs>
            <linearGradient id="scale-board-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-board-800)" />
              <stop offset="1" stopColor="var(--color-board-900)" />
            </linearGradient>
          </defs>
          <rect x={BOARD_LEFT} y={BOARD_TOP} width="750" height="185" rx="9" fill="url(#scale-board-wood)" />
          {Array.from({ length: 15 }, (_, index) => index + 1).map((fret) => (
            <g key={`fret-${fret}`}>
              <line
                x1={46 + fret * 50}
                y1="15"
                x2={46 + fret * 50}
                y2="200"
                stroke="var(--color-on-accent)"
                strokeOpacity={fret === 1 ? ".38" : ".11"}
                strokeWidth={fret === 1 ? 4 : 1}
              />
              <text
                x={noteX(fret)}
                y="216"
                textAnchor="middle"
                fill="var(--color-ink-500)"
                fontFamily="var(--font-mono)"
                fontSize="9"
              >
                {fret}
              </text>
              {[3, 5, 7, 9, 12, 15].includes(fret) ? (
                <circle
                  cx={noteX(fret)}
                  cy="107.5"
                  r="2.5"
                  fill="var(--color-on-accent)"
                  fillOpacity=".17"
                />
              ) : null}
            </g>
          ))}
          {STRINGS.map((stringNumber) => (
            <g key={`string-${stringNumber}`}>
              {activeString === stringNumber ? (
                <circle
                  cx="24"
                  cy={stringY(stringNumber)}
                  r="10"
                  fill="var(--color-accent-700)"
                />
              ) : null}
              <path
                d={stringPath(stringNumber, stringEnergy[stringNumber - 1] ?? 0)}
                stroke={
                  pluckedString === stringNumber || activeString === stringNumber
                    ? "var(--color-accent-700)"
                    : "var(--color-on-accent)"
                }
                strokeOpacity={
                  pluckedString === stringNumber
                    ? ".95"
                    : activeString === null
                      ? ".34"
                      : activeString === stringNumber
                        ? ".82"
                        : ".12"
                }
                strokeWidth={0.9 + (stringNumber - 1) * 0.22 + (activeString === stringNumber ? 0.8 : 0)}
                fill="none"
                className="scale-string"
              />
              <text
                x="28"
                y={stringY(stringNumber) + 4}
                textAnchor="end"
                fill={
                  activeString === stringNumber
                    ? "var(--color-on-accent)"
                    : "var(--color-ink-700)"
                }
                fontFamily="var(--font-mono)"
                fontSize="10"
                fontWeight={activeString === stringNumber ? "700" : "600"}
              >
                {stringNumber}
              </text>
            </g>
          ))}
          {NOTES.map((note) => (
            <g
              key={note.key}
              onClick={() => pluckString(note.stringNumber, note.fret, note.key)}
              className="scale-note-hit"
            >
              <NoteMark
                note={note}
                activePath={activePath}
                activeString={activeString}
                pluckedNote={pluckedNote}
              />
            </g>
          ))}
        </svg>
      </div>
      <p className="scale-board-hint">点击音位试听并拨动琴弦 · ↔ 滑动查看 15 品 · 横屏显示更完整</p>

      <ul className="scale-degree-key" aria-label="音级对应">
        <li><strong>1</strong> C</li>
        <li><strong>2</strong> D</li>
        <li><strong>3</strong> E</li>
        <li><strong>4</strong> F</li>
        <li><strong>5</strong> G</li>
        <li><strong>6</strong> A</li>
        <li><strong>7</strong> B</li>
      </ul>

      <p role="status" aria-live="polite" className={`scale-status ${status ? "" : "sr-only"}`}>
        {status}
      </p>
    </div>
  );
}
