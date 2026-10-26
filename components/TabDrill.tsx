"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { TabStaff } from "@/components/TabStaff";
import { clampBpm, METERS } from "@/lib/metronome";
import { createMetronomeAudio, type MetronomeAudio } from "@/lib/metronome-audio";
import type { TabSection } from "@/lib/tab-practice";
import { activeNoteIndex, totalBeats } from "@/lib/tab-timing";

export type TabDrillLegendItem = {
  symbol: string;
  label: string;
};

export type TabDrillProps = {
  idPrefix: string;
  eyebrow: string;
  title: string;
  summary: string;
  sections: readonly TabSection[];
  legend?: readonly TabDrillLegendItem[];
};

/**
 * 练习谱 + 节拍器（2026-10-26）。
 *
 * 一个音频时钟同时驱动两件事：拍点发声，谱面点亮当前拍位上的音符。
 * 拍位由 lib/tab-timing.ts 从音符时值推导，不是另写一份手数的小节表。
 *
 * 速度默认取本节第一段的目标速度；播放中改速度，发声与高亮一起跟着变。
 * 每段自己的目标速度仍显示在段标题旁，两者不混。
 */
const METER = METERS.find((option) => option.label === "4/4") ?? METERS[0];
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const START_LEAD_S = 0.06;
const POLL_MS = 50;

export function TabDrill({
  idPrefix,
  eyebrow,
  title,
  summary,
  sections,
  legend = [],
}: TabDrillProps) {
  const headingId = `${idPrefix}-heading`;
  const totalMeasures = sections.reduce((total, section) => total + section.measures.length, 0);
  const defaultBpm = sections[0]?.bpm ?? 100;
  const loopEighths = Math.max(
    2,
    Math.ceil(Math.max(...sections.map((section) => totalBeats(section.measures))) * 2),
  );

  const [bpm, setBpm] = useState(defaultBpm);
  const [running, setRunning] = useState(false);
  /** 当前八分音符位置；-1 表示未开始 */
  const [eighth, setEighth] = useState(-1);

  const audioRef = useRef<MetronomeAudio | null>(null);
  const intervalRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const nextBeatTimeRef = useRef(0);
  const nextBeatIndexRef = useRef(0);
  const bpmRef = useRef(defaultBpm);
  const runningRef = useRef(false);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const beatSeconds = useCallback(() => 60 / bpmRef.current, []);

  const scheduleWindow = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const horizon = audio.currentTime + SCHEDULE_AHEAD_S;
    while (nextBeatTimeRef.current < horizon) {
      audio.schedule(nextBeatIndexRef.current, nextBeatTimeRef.current, METER);
      nextBeatTimeRef.current += beatSeconds();
      nextBeatIndexRef.current = (nextBeatIndexRef.current + 1) % METER.beatsPerBar;
    }
  }, [beatSeconds]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) audio.cancelFrom(audio.currentTime);
    setRunning(false);
    setEighth(-1);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const audio = audioRef.current ?? createMetronomeAudio();
    audioRef.current = audio;
    await audio.resume();
    if (runningRef.current) return;
    runningRef.current = true;
    startTimeRef.current = audio.currentTime + START_LEAD_S;
    nextBeatTimeRef.current = startTimeRef.current;
    nextBeatIndexRef.current = 0;
    setRunning(true);
    setEighth(0);
    scheduleWindow();
    intervalRef.current = window.setInterval(scheduleWindow, LOOKAHEAD_MS);
    pollRef.current = window.setInterval(() => {
      const current = audioRef.current;
      if (!current) return;
      const elapsed = current.currentTime - startTimeRef.current;
      if (elapsed < 0) return;
      const position = Math.floor((elapsed / beatSeconds()) * 2);
      setEighth(position % loopEighths);
    }, POLL_MS);
  }, [beatSeconds, loopEighths, scheduleWindow]);

  const toggle = useCallback(() => {
    if (runningRef.current) stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stop]);

  useEffect(
    () => () => {
      runningRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      void audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  const beatPosition = eighth < 0 ? -1 : eighth / 2;
  const activeNotes: Record<string, number | null> = {};
  for (const section of sections) {
    activeNotes[section.id] =
      beatPosition < 0 ? null : activeNoteIndex(section.measures, beatPosition);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 scroll-mt-24 overflow-hidden rounded-card border border-rule bg-surface"
    >
      <header className="border-b border-rule px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-micro font-medium text-ink-500">{eyebrow}</p>
            <h2 id={headingId} className="mt-1 scroll-mt-24 text-title text-ink-950">
              {title}
            </h2>
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-500">
            <div className="flex gap-1">
              <dt>练习</dt>
              <dd className="font-mono text-ink-950 tabular-nums">{sections.length} 段</dd>
            </div>
            <div className="flex gap-1">
              <dt>小节</dt>
              <dd className="font-mono text-ink-950 tabular-nums">{totalMeasures}</dd>
            </div>
            <div className="flex gap-1">
              <dt>弦</dt>
              <dd className="font-mono text-ink-950 tabular-nums">6 弦</dd>
            </div>
          </dl>
        </div>
        <p className="mt-3 text-meta leading-relaxed text-ink-700">{summary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBpm((value) => clampBpm(value - 1))}
            aria-label="速度减一拍"
            className="grid size-11 place-items-center rounded-control border border-control-edge/40 text-ink-700 transition-colors duration-150 hover:bg-surface-muted active:scale-95"
          >
            <Icon name="minus" className="size-4" />
          </button>
          <span className="w-16 text-center font-mono text-label text-ink-950 tabular-nums">
            {bpm} BPM
          </span>
          <button
            type="button"
            onClick={() => setBpm((value) => clampBpm(value + 1))}
            aria-label="速度加一拍"
            className="grid size-11 place-items-center rounded-control border border-control-edge/40 text-ink-700 transition-colors duration-150 hover:bg-surface-muted active:scale-95"
          >
            <Icon name="plus" className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={running}
            className="ml-1 flex h-11 items-center gap-2 rounded-control bg-accent-700 px-4 text-label font-semibold text-on-accent transition-[filter] duration-150 hover:brightness-110 active:scale-[0.99]"
          >
            <Icon name={running ? "pause" : "play"} className="size-4" />
            {running ? "暂停" : "开始"}
          </button>
          <span className="text-meta text-ink-500">一个时钟驱动发声与谱面高亮</span>
        </div>

        {legend.length > 0 ? (
          <ul aria-label="谱面记号图例" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {legend.map((item) => (
              <li key={`${item.symbol}-${item.label}`} className="flex items-center gap-1.5">
                <span className="min-w-5 font-mono text-label font-semibold text-ink-700">
                  {item.symbol}
                </span>
                <span className="text-meta text-ink-500">{item.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="divide-y divide-rule">
        {sections.map((section, index) => {
          const sectionHeadingId = `${idPrefix}-${section.id}`;

          return (
            <section
              key={section.id}
              aria-labelledby={sectionHeadingId}
              className="scroll-mt-24 px-4 py-6 sm:px-6"
            >
              <header className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 w-6 shrink-0 font-mono text-label text-ink-500 tabular-nums"
                >
                  {String(index).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3
                      id={sectionHeadingId}
                      className="scroll-mt-24 text-title text-ink-950"
                    >
                      {section.title}
                    </h3>
                    <span className="inline-flex items-center rounded-pill bg-surface-muted px-2.5 py-1 font-mono text-meta text-ink-700 tabular-nums">
                      ♩ = {section.bpm}
                    </span>
                  </div>
                  <p className="mt-2 text-body text-ink-700 text-pretty">{section.focus}</p>
                </div>
              </header>

              <div className="mt-4 sm:ml-9">
                <TabStaff
                  measures={section.measures}
                  bpm={running ? bpm : section.bpm}
                  activeNoteIndex={activeNotes[section.id]}
                  cdStart={section.cdStart}
                  title={`${section.title} TAB 谱`}
                  meta={[section.rhythm, ...(section.labels ?? [])]}
                />
                <div className="mt-3 border-l-2 border-control-edge pl-3">
                  <p className="text-meta leading-relaxed text-ink-500">
                    <strong className="font-medium text-ink-700">练习提示：</strong>
                    {section.tip}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {running ? `正在以每分钟 ${bpm} 拍播放，谱面高亮当前拍位` : "练习节拍器已停止"}
      </p>
    </section>
  );
}
