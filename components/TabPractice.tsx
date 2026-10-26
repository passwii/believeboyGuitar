"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { TabExercise } from "@/components/TabExercise";
import { clampBpm, METERS } from "@/lib/metronome";
import { createMetronomeAudio, type MetronomeAudio } from "@/lib/metronome-audio";
import { WEEK1_SECTIONS } from "@/lib/tab-exercises";
import { activeNoteIndex, totalBeats } from "@/lib/tab-timing";

/**
 * 带节拍器的曲谱（2026-10-26，D4）。
 *
 * 一个时钟，两处反馈：拍点发声，同时把当前拍位上的音符点亮。
 * 拍位来自 lib/tab-timing.ts（由时值推导），不是另写一份手数的小节表；
 * 高亮与发声都读同一个音频时钟，所以改速度时两边一起变。
 *
 * 四段练习并行：同一拍位在四段里都会点亮——它们是同一周的并列练习，
 * 用同一个节拍器走，正好能对照。
 */
const METER = METERS.find((option) => option.label === "4/4") ?? METERS[0];
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const START_LEAD_S = 0.06;
const POLL_MS = 50;

const DEFAULT_BPM = WEEK1_SECTIONS[0]?.bpm ?? 100;
/** 最长一段的拍数，循环时按它回卷 */
const LOOP_BEATS = Math.max(...WEEK1_SECTIONS.map((section) => totalBeats(section.measures)));
const LOOP_EIGHTHS = Math.max(1, Math.ceil(LOOP_BEATS * 2));

export function TabPractice() {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [running, setRunning] = useState(false);
  /** 当前八分音符位置；-1 表示未开始 */
  const [eighth, setEighth] = useState(-1);

  const audioRef = useRef<MetronomeAudio | null>(null);
  const intervalRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const nextBeatTimeRef = useRef(0);
  const nextBeatIndexRef = useRef(0);
  const bpmRef = useRef(DEFAULT_BPM);
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
      setEighth(position % LOOP_EIGHTHS);
    }, POLL_MS);
  }, [beatSeconds, scheduleWindow]);

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
  for (const section of WEEK1_SECTIONS) {
    activeNotes[section.id] =
      beatPosition < 0 ? null : activeNoteIndex(section.measures, beatPosition);
  }

  return (
    <section className="rounded-card border border-rule bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title text-ink-950">第 1 周曲谱</h2>
          <p className="mt-1 text-meta text-ink-500">节拍器与谱面共用一个时钟</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="mt-5">
        <TabExercise
          sections={WEEK1_SECTIONS}
          activeNotes={running ? activeNotes : null}
          bpm={bpm}
          embedded
        />
      </div>
      <p role="status" className="sr-only">
        {running ? `正在以每分钟 ${bpm} 拍播放，谱面高亮当前拍位` : "练习节拍器已停止"}
      </p>
    </section>
  );
}
