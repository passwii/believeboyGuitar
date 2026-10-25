"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { BPM_DEFAULT, METERS, clampBpm, tempoName, type Meter } from "@/lib/metronome";
import { createMetronomeAudio, type MetronomeAudio } from "@/lib/metronome-audio";

/**
 * 首页的节拍器快捷条（2026-10-25，D3）。
 *
 * 首页的第一屏要能直接开始练，所以这里放一台最小可用的节拍器：
 * 速度 ±1、三种常用拍号、开始 / 暂停、拍点指示。完整控制仍在
 * /tools/metronome（音色、六种拍号、圆环旋钮、常亮）。
 *
 * 调度沿用和完整版相同的思路：25ms 的前瞻循环只负责把拍子排进音频时钟，
 * 不用 setInterval 直接发声（手机浏览器会漂移）。这里不做后台续航：
 * 页面隐藏就停，避免在别的页面里继续响。
 */
const QUICK_METERS = METERS.filter((meter) => ["4/4", "3/4", "6/8"].includes(meter.label));
const DEFAULT_METER = QUICK_METERS[0];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const START_LEAD_S = 0.06;

type PendingClick = { index: number; time: number };

export function QuickPractice() {
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [meter, setMeter] = useState<Meter>(DEFAULT_METER);
  const [running, setRunning] = useState(false);
  /** 当前拍索引；-1 表示未开始 */
  const [beat, setBeat] = useState(-1);

  const audioRef = useRef<MetronomeAudio | null>(null);
  const intervalRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const queueRef = useRef<PendingClick[]>([]);
  const nextIndexRef = useRef(0);
  const nextTimeRef = useRef(0);
  const bpmRef = useRef(BPM_DEFAULT);
  const meterRef = useRef<Meter>(DEFAULT_METER);
  const runningRef = useRef(false);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    meterRef.current = meter;
    if (!runningRef.current) return;
    // 换拍号等于换小节：撤掉还没响的拍，从新拍号第 1 拍重新起算
    const audio = audioRef.current;
    if (audio) audio.cancelFrom(audio.currentTime);
    queueRef.current = [];
    nextIndexRef.current = 0;
    nextTimeRef.current = (audio?.currentTime ?? 0) + START_LEAD_S;
  }, [meter]);

  const scheduleWindow = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const horizon = audio.currentTime + SCHEDULE_AHEAD_S;
    while (nextTimeRef.current < horizon) {
      const currentMeter = meterRef.current;
      audio.schedule(nextIndexRef.current, nextTimeRef.current, currentMeter);
      queueRef.current.push({ index: nextIndexRef.current, time: nextTimeRef.current });
      nextTimeRef.current += 60 / bpmRef.current;
      nextIndexRef.current = (nextIndexRef.current + 1) % currentMeter.beatsPerBar;
    }
  }, []);

  const paint = useCallback(function paintFrame() {
    const audio = audioRef.current;
    if (audio) {
      const now = audio.currentTime;
      let nextBeat = -1;
      while (queueRef.current.length > 0 && queueRef.current[0].time <= now) {
        nextBeat = queueRef.current.shift()!.index;
      }
      if (nextBeat >= 0) setBeat(nextBeat);
    }
    if (runningRef.current) frameRef.current = window.requestAnimationFrame(paintFrame);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) audio.cancelFrom(audio.currentTime);
    queueRef.current = [];
    setRunning(false);
    setBeat(-1);
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const audio = audioRef.current ?? createMetronomeAudio();
    audioRef.current = audio;
    await audio.resume();
    if (runningRef.current) return;
    nextIndexRef.current = 0;
    nextTimeRef.current = audio.currentTime + START_LEAD_S;
    queueRef.current = [];
    runningRef.current = true;
    setRunning(true);
    scheduleWindow();
    intervalRef.current = window.setInterval(scheduleWindow, LOOKAHEAD_MS);
    frameRef.current = window.requestAnimationFrame(paint);
  }, [paint, scheduleWindow]);

  const toggle = useCallback(() => {
    if (runningRef.current) stop();
    else void start();
  }, [start, stop]);

  // 离开页面就停：首页的快捷条不承担后台续航
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
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      void audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  const step = (delta: number) => setBpm((current) => clampBpm(current + delta));

  return (
    <section
      aria-labelledby="quick-practice-heading"
      className="rounded-card border border-rule bg-surface p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="quick-practice-heading" className="text-title text-ink-950">
          节拍器
        </h2>
        <Link
          href="/tools/metronome"
          className="flex min-h-11 items-center gap-1 text-label text-ink-500 transition-colors duration-150 hover:text-ink-950"
        >
          完整控制
          <Icon name="chevron-right" className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <p className="flex items-end gap-3">
          <span className="font-mono text-6xl font-semibold leading-none tracking-tight text-ink-950 tabular-nums">
            {bpm}
          </span>
          <span className="pb-1.5 text-meta text-ink-500">BPM · {tempoName(bpm)}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="速度减一拍"
            className="grid size-11 place-items-center rounded-control border border-control-edge/40 text-ink-700 transition-colors duration-150 hover:bg-surface-muted active:scale-95"
          >
            <Icon name="minus" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="速度加一拍"
            className="grid size-11 place-items-center rounded-control border border-control-edge/40 text-ink-700 transition-colors duration-150 hover:bg-surface-muted active:scale-95"
          >
            <Icon name="plus" className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="segment-track" role="group" aria-label="拍号">
          {QUICK_METERS.map((option) => {
            const selected = option.label === meter.label;
            return (
              <button
                key={option.label}
                type="button"
                className="segment"
                aria-pressed={selected}
                onClick={() => setMeter(option)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: meter.beatsPerBar }, (_, index) => {
            const active = index === beat;
            return (
              <span
                key={index}
                className={`size-2 rounded-full transition-transform duration-100 ${
                  active ? "bg-accent-700" : "bg-ink-200"
                } ${active && meter.accents.includes(index) ? "scale-150" : ""}`}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={running}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-control bg-accent-700 text-label font-semibold text-on-accent transition-[filter] duration-150 hover:brightness-110 active:scale-[0.99]"
      >
        <Icon name={running ? "pause" : "play"} className="size-5" />
        {running ? "暂停" : "开始"}
      </button>
      <p role="status" className="sr-only">
        {running
          ? `正在以每分钟 ${bpm} 拍播放，每小节 ${meter.beatsPerBar} 拍`
          : "节拍器已停止"}
      </p>
    </section>
  );
}
