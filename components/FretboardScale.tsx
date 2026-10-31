"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  buildScaleNotes,
  SCALE_PATHS,
  type ScaleNote,
} from "@/lib/fretboard-scale";

const NOTES = buildScaleNotes();
const STRINGS = [1, 2, 3, 4, 5, 6] as const;
const COLOR_VARS = SCALE_PATHS.map((path) => path.colorVar);

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
}: {
  note: ScaleNote;
  activePath: "all" | number;
}) {
  const visible = activePath === "all" || note.pathIds.includes(activePath);
  const radius = 13;
  const colors =
    activePath === "all"
      ? note.pathIds.map((id) => COLOR_VARS[id - 1])
      : [COLOR_VARS[activePath - 1]];
  const x = noteX(note.fret);
  const y = stringY(note.stringNumber);

  return (
    <g opacity={visible ? 1 : 0.13}>
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

export function FretboardScale() {
  const [activePath, setActivePath] = useState<"all" | number>("all");
  const [landscape, setLandscape] = useState(false);
  const [status, setStatus] = useState("");
  const statusTimer = useRef<number | null>(null);

  const announce = (message: string) => {
    setStatus(message);
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 3200);
  };

  useEffect(
    () => () => {
      if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    },
    [],
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      setLandscape(false);
      setStatus("已退出横屏");
      if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
      statusTimer.current = window.setTimeout(() => setStatus(""), 3200);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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
        <Link
          href="/library"
          aria-label="返回资料库"
          className="grid size-11 place-items-center rounded-full border border-rule bg-surface text-ink-700"
        >
          <Icon name="back" className="size-4" />
        </Link>
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

      <div className="scale-board-viewport">
        <svg
          role="img"
          aria-label="C 大调十五品六色指板音阶，一弦在上，六弦在下"
          viewBox="0 0 820 220"
          className="scale-board"
        >
          <defs>
            <linearGradient id="scale-board-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-board-800)" />
              <stop offset="1" stopColor="var(--color-board-900)" />
            </linearGradient>
          </defs>
          <rect x="46" y="15" width="750" height="185" rx="9" fill="url(#scale-board-wood)" />
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
              <line
                x1="46"
                y1={stringY(stringNumber)}
                x2="796"
                y2={stringY(stringNumber)}
                stroke="var(--color-on-accent)"
                strokeOpacity=".34"
                strokeWidth={0.7 + (stringNumber - 1) * 0.18}
              />
              <text
                x="28"
                y={stringY(stringNumber) + 4}
                textAnchor="end"
                fill="var(--color-ink-700)"
                fontFamily="var(--font-mono)"
                fontSize="10"
                fontWeight="600"
              >
                {stringNumber}
              </text>
            </g>
          ))}
          {NOTES.map((note) => (
            <NoteMark key={note.key} note={note} activePath={activePath} />
          ))}
        </svg>
      </div>
      <p className="scale-board-hint">↔ 滑动查看 15 品 · 横屏显示更完整</p>

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
