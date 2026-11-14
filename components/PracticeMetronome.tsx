import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  BPM_MAX,
  BPM_MIN,
  BPM_STEP,
  clampBpm,
  DEFAULT_METER,
} from "@/lib/metronome";
import { createMetronomeAudio, type MetronomeAudio } from "@/lib/metronome-audio";
import { bindMetronomeSpaceShortcut } from "@/lib/metronome-keyboard";

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
  const startingRef = useRef(false);
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

  const pause = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
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
    if (runningRef.current || startingRef.current) return;
    startingRef.current = true;
    const generation = ++generationRef.current;

    try {
      const audio = audioRef.current ?? createMetronomeAudio();
      audioRef.current = audio;
      await audio.resume();
      if (generation !== generationRef.current || runningRef.current) return;

      startingRef.current = false;
      runningRef.current = true;
      nextBeatTimeRef.current = audio.currentTime + START_LEAD_S;
      nextBeatIndexRef.current = 0;
      setRunning(true);
      setAnnouncement("节拍器已开始");
      scheduleWindow();
      intervalRef.current = window.setInterval(scheduleWindow, LOOKAHEAD_MS);
    } catch {
      if (generation !== generationRef.current) return;
      startingRef.current = false;
      runningRef.current = false;
      setRunning(false);
      setAnnouncement("无法启动节拍器，请检查浏览器声音权限");
    }
  }, [scheduleWindow]);

  const toggle = useCallback(() => {
    if (runningRef.current || startingRef.current) pause();
    else void start();
  }, [pause, start]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pause]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      startingRef.current = false;
      runningRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) void audio.dispose();
    };
  }, []);

  useEffect(() => bindMetronomeSpaceShortcut(window, toggle), [toggle]);

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
          aria-label={`减速 ${BPM_STEP} BPM`}
          onClick={() => changeBpm(-BPM_STEP)}
          disabled={bpm <= BPM_MIN}
          className="practice-metronome__button"
        >
          <Icon name="minus" className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`加速 ${BPM_STEP} BPM`}
          onClick={() => changeBpm(BPM_STEP)}
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
        空格播放/暂停 · 回车切弦 · P 试听当前弦
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
