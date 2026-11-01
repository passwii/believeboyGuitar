"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  BPM_MAX,
  BPM_MIN,
  clampBpm,
  DEFAULT_METER,
} from "@/lib/metronome";
import { createMetronomeAudio, type MetronomeAudio } from "@/lib/metronome-audio";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;
const START_LEAD_S = 0.06;

export function PracticeMetronome() {
  const [bpm, setBpm] = useState(100);
  const [running, setRunning] = useState(false);
  const [announcement, setAnnouncement] = useState("节拍器已停止");

  const audioRef = useRef<MetronomeAudio | null>(null);
  const intervalRef = useRef<number | null>(null);
  const bpmRef = useRef(bpm);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const nextBeatTimeRef = useRef(0);
  const nextBeatIndexRef = useRef(0);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const beatSeconds = useCallback(() => 60 / bpmRef.current, []);

  const scheduleWindow = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const horizon = audio.currentTime + SCHEDULE_AHEAD_S;
    while (nextBeatTimeRef.current < horizon) {
      audio.schedule(nextBeatIndexRef.current, nextBeatTimeRef.current, DEFAULT_METER);
      nextBeatTimeRef.current += beatSeconds();
      nextBeatIndexRef.current =
        (nextBeatIndexRef.current + 1) % DEFAULT_METER.beatsPerBar;
    }
  }, [beatSeconds]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    runningRef.current = false;
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) audio.cancelFrom(audio.currentTime);
    setRunning(false);
    setAnnouncement("节拍器已停止");
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const generation = ++generationRef.current;

    try {
      const audio = audioRef.current ?? createMetronomeAudio();
      audioRef.current = audio;
      await audio.resume();
      if (generation !== generationRef.current || runningRef.current) return;

      runningRef.current = true;
      nextBeatTimeRef.current = audio.currentTime + START_LEAD_S;
      nextBeatIndexRef.current = 0;
      setRunning(true);
      setAnnouncement("节拍器已开始");
      scheduleWindow();
      intervalRef.current = window.setInterval(scheduleWindow, LOOKAHEAD_MS);
    } catch {
      if (generation !== generationRef.current) return;
      runningRef.current = false;
      setRunning(false);
      setAnnouncement("无法启动节拍器，请检查浏览器声音权限");
    }
  }, [scheduleWindow]);

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

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      runningRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) void audio.dispose();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key !== " " && event.key !== "Spacebar") return;

      const target = event.target;
      const interactive =
        target instanceof Element
          ? target.closest("input, textarea, select, button, a, [contenteditable='true']")
          : null;
      if (interactive) return;

      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  function changeBpm(amount: number) {
    setBpm((current) => clampBpm(current + amount));
  }

  return (
    <section className="practice-metronome" aria-labelledby="practice-metronome-title">
      <div className="practice-metronome__readout">
        <h2 id="practice-metronome-title" className="practice-metronome__title">
          节拍器
        </h2>
        <output className="practice-metronome__bpm" aria-label={`当前速度 ${bpm} BPM`}>
          {bpm} BPM
        </output>
      </div>

      <div className="practice-metronome__controls" role="group" aria-label="节拍器控制">
        <button
          type="button"
          aria-label="速度减一拍"
          onClick={() => changeBpm(-1)}
          disabled={bpm <= BPM_MIN}
          className="practice-metronome__button"
        >
          <Icon name="minus" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="速度加一拍"
          onClick={() => changeBpm(1)}
          disabled={bpm >= BPM_MAX}
          className="practice-metronome__button"
        >
          <Icon name="plus" className="size-4" />
        </button>
        <button
          type="button"
          aria-pressed={running}
          aria-keyshortcuts="Space"
          aria-label={running ? "暂停节拍器" : "开始节拍器"}
          onClick={toggle}
          className="practice-metronome__button practice-metronome__button--transport"
        >
          <Icon name={running ? "pause" : "play"} className="size-4" />
          {running ? "暂停" : "开始"}
        </button>
      </div>

      <p id="practice-metronome-help" className="practice-metronome__hint">
        空格播放/暂停 · 回车切换下一弦
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
