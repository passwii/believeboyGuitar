"use client";

import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "@/components/icons";
import {
  BPM_MAX,
  BPM_MIN,
  DIAL_START_DEG,
  DIAL_SWEEP_DEG,
  bpmToDialAngle,
  clampBpm,
  dialPointToBpm,
  tempoName,
} from "@/lib/metronome";

/**
 * 圆环速度控件。
 *
 * 几何与角度换算都在 `lib/metronome.ts`（纯函数、可在 node 下单测），
 * 这里只负责画刻度、换算指针位置、以及键盘/指针事件。
 *
 * 交互是「指针落在环上就对齐到那个角度」：圆环没有一条可以随手按住的长轨道，
 * 绝对定位才是它自然的手感。
 *
 * 命中区只做在环体那一圈：圆心是读数，点它不该改速度，页面滚动也不该被这块
 * 圆盘吃掉。
 *
 * 防滚动是这块控件最容易写错的地方（BLF-1448）。`touch-action: none` 必须落在
 * **HTML** 元素上：写在 SVG 的 `<circle>` 子元素上会被浏览器忽略（实测在环上
 * 竖拖 180px，页面照滚约 230px，速度还跟着变）；写到 SVG 根上确实能挡滚动，
 * 但会连圆心一起锁死，读数区就不能用来翻页了。
 *
 * 现在的结构是三层 HTML：
 * 1. 整圆的拖拽层（`touch-action: none`）——挡滚动、改速度；
 * 2. 盖在中间的圆心盘（不带 touch-action）——拖它页面照常滚；
 * 3. 读数（`pointer-events-none`）——纯视觉。
 *
 * 不在 pointerdown 里抢焦点：拖拽层是 div，浏览器本来就不会把焦点顺带给外层
 * 容器，强行 focus() 会让鼠标拖一次就出现一圈整环的焦点环，和圆环本身分不开。
 * 键盘用户从 Tab 进来，方向微调照常可用。
 */

const VIEW = 200;
const CENTER = VIEW / 2;
const DIAL_RADIUS = 88;
const TICK_COUNT = 64;

type Point = { x: number; y: number };

/** 圆环角度（12 点钟为 0°、顺时针为正）→ SVG 坐标 */
function polar(angleDeg: number, radius = DIAL_RADIUS): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    // 固定两位小数，避免 Node 与浏览器的浮点序列化差异触发 hydration mismatch。
    x: Number((CENTER + radius * Math.sin(rad)).toFixed(2)),
    y: Number((CENTER - radius * Math.cos(rad)).toFixed(2)),
  };
}

const TICKS = Array.from({ length: TICK_COUNT }, (_, index) => {
  const ratio = index / (TICK_COUNT - 1);
  const angle = DIAL_START_DEG + ratio * DIAL_SWEEP_DEG;
  const inner = polar(angle, 83);
  const outer = polar(angle, index % 8 === 0 ? 97 : 93);
  return { ratio, inner, outer, major: index % 8 === 0 };
});

type BpmDialProps = {
  value: number;
  onChange: (next: number) => void;
  /** 手机单屏版：更大的刻度盘，BPM 标签与微调按钮收进圆心。 */
  instrument?: boolean;
};

export function BpmDial({ value, onChange, instrument = false }: BpmDialProps) {
  const draggingRef = useRef(false);
  /** 指针相对 SVG 中心的位置 → BPM */
  const bpmAt = useCallback((event: PointerEvent<HTMLDivElement>): number | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // 引脚点算在 viewBox 坐标系里的比例位置，避免 SVG 缩放的换算误差
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return dialPointToBpm(dx, dy);
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // 只响应主键；右键菜单、双指缩放都不该改速度
      if (event.button !== 0) return;

      const next = bpmAt(event);
      if (next === null) return;

      draggingRef.current = true;
      // 捕获指针：手指滑出环体（甚至滑出屏幕）也继续跟手
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      if (next !== value) onChange(next);
    },
    [bpmAt, onChange, value],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const next = bpmAt(event);
      if (next !== null && next !== value) onChange(next);
    },
    [bpmAt, onChange, value],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 10 : 1;
      let next: number;
      switch (event.key) {
        case "ArrowUp":
        case "ArrowRight":
          next = value + step;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          next = value - step;
          break;
        case "PageUp":
          next = value + 10;
          break;
        case "PageDown":
          next = value - 10;
          break;
        case "Home":
          next = BPM_MIN;
          break;
        case "End":
          next = BPM_MAX;
          break;
        default:
          return;
      }

      event.preventDefault();
      const clamped = clampBpm(next);
      if (clamped !== value) onChange(clamped);
    },
    [onChange, value],
  );

  const angle = bpmToDialAngle(value);
  const knob = polar(angle, DIAL_RADIUS);
  const activeRatio = (value - BPM_MIN) / (BPM_MAX - BPM_MIN);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="速度"
      aria-valuemin={BPM_MIN}
      aria-valuemax={BPM_MAX}
      aria-valuenow={value}
      aria-valuetext={`每分钟 ${value} 拍`}
      onKeyDown={onKeyDown}
      className={`bpm-dial relative cursor-pointer rounded-full ${
        instrument ? "metronome-dial" : "size-60 sm:size-64"
      }`}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="size-full overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={98}
          className="fill-none stroke-ink-100"
          strokeWidth={1}
        />
        {TICKS.map((tick, index) => (
          <line
            key={index}
            x1={tick.inner.x}
            y1={tick.inner.y}
            x2={tick.outer.x}
            y2={tick.outer.y}
            className={tick.ratio <= activeRatio + 0.001 ? "stroke-accent-700" : "stroke-ink-200"}
            strokeWidth={tick.major ? 2.4 : 1.5}
            strokeLinecap="round"
          />
        ))}
        <circle
          cx={knob.x}
          cy={knob.y}
          r={5}
          className="fill-ink-950 stroke-surface"
          strokeWidth={3}
        />
      </svg>

      {/*
        环体命中层是 **HTML** 元素，不是 SVG 里的 circle（BLF-1448）。

        `touch-action` 只在 SVG 根元素上可靠生效，挂在 `<circle>` 这类子元素上会被
        浏览器忽略：旧写法给环体写了 `touch-none`，实测在环上竖拖 180px 页面照样
        滚了约 230px，速度也跟着变——一次操作两个结果。
        挪到 SVG 根上能挡住滚动，但会把圆心一起锁死，读数区就不能用来翻页了。

        所以拆成两层 HTML：这一层是整圆、`touch-action: none`，负责接收拖拽；
        上面的圆心盘盖住中间 76%，它没有 `touch-action: none`，拖它页面照常滚。
      */}
      <div
        className="absolute inset-0 rounded-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />

      {/* 圆心：盖住环体的中间部分，不接管拖拽也不带 touch-action:none。
          桌面保留原来的 60% 环带；手机单屏版放大读数，环带收到 76% 内圈。 */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-rule bg-surface ${
          instrument ? "size-[76%]" : "size-[60%]"
        }`}
      />

      {instrument ? (
        <>
          <button
            type="button"
            aria-label="减速 1 BPM"
            disabled={value <= BPM_MIN}
            onClick={() => onChange(clampBpm(value - 1))}
            className="absolute left-[8%] top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-control-edge/20 bg-surface-muted/70 text-ink-700 disabled:text-ink-300"
          >
            <Icon name="minus" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="加速 1 BPM"
            disabled={value >= BPM_MAX}
            onClick={() => onChange(clampBpm(value + 1))}
            className="absolute right-[8%] top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-control-edge/20 bg-surface-muted/70 text-ink-700 disabled:text-ink-300"
          >
            <Icon name="plus" className="size-4" />
          </button>
        </>
      ) : null}

      {/* 读数压在圆心：纯视觉，不接管指针 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {instrument ? (
          <p className="mb-1 font-mono text-micro font-semibold text-ink-500">BPM</p>
        ) : null}
        <p
          className={`font-mono font-semibold tabular-nums leading-none ${
            instrument ? "text-7xl" : "text-6xl"
          }`}
        >
          {value}
        </p>
        <p
          className={`mt-2 text-label ${
            instrument ? "text-accent-700" : "text-ink-700"
          }`}
        >
          {tempoName(value)}
        </p>
      </div>
    </div>
  );
}
