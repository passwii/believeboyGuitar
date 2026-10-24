"use client";

import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from "react";
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
 * 这里只负责画弧、换算指针位置、以及键盘/指针事件。
 *
 * 交互是「指针落在环上就对齐到那个角度」：圆环没有一条可以随手按住的长轨道，
 * 绝对定位才是它自然的手感。
 *
 * 命中区只做在环体那一圈：圆心是读数，点它不该改速度，页面滚动也不该被这块
 * 240px 的圆盘吃掉。
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
const RADIUS = 82;
const STROKE = 9;

type Point = { x: number; y: number };

/** 圆环角度（12 点钟为 0°、顺时针为正）→ SVG 坐标 */
function polar(angleDeg: number, radius = RADIUS): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(rad),
    y: CENTER - radius * Math.cos(rad),
  };
}

/** 圆环角度区间 → SVG 圆弧路径（顺时针） */
function arcPath(fromDeg: number, toDeg: number, radius = RADIUS): string {
  const from = polar(fromDeg, radius);
  const to = polar(toDeg, radius);
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return [
    `M ${from.x.toFixed(2)} ${from.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
  ].join(" ");
}

const TRACK_PATH = arcPath(DIAL_START_DEG, DIAL_START_DEG + DIAL_SWEEP_DEG);
/** 端点数字放在环外侧，既不被旋钮压住，也不挤进中间的速度术语（靠 overflow-visible 出界） */
const MIN_LABEL = polar(DIAL_START_DEG, 112);
const MAX_LABEL = polar(DIAL_START_DEG + DIAL_SWEEP_DEG, 112);

type BpmDialProps = {
  value: number;
  onChange: (next: number) => void;
};

export function BpmDial({ value, onChange }: BpmDialProps) {
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
  const knob = polar(angle);
  const progressPath = angle > DIAL_START_DEG ? arcPath(DIAL_START_DEG, angle) : null;

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
      className="relative size-60 cursor-pointer rounded-full sm:size-64"
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="size-full overflow-visible"
        aria-hidden="true"
      >
        <path
          d={TRACK_PATH}
          className="fill-none stroke-ink-200"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {progressPath ? (
          <path
            d={progressPath}
            className="fill-none stroke-accent-700"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        ) : null}
        <circle
          cx={knob.x}
          cy={knob.y}
          r={STROKE}
          className="fill-surface stroke-accent-700"
          strokeWidth={3}
        />
        {/* 端点数字画在环外侧，靠 overflow-visible 出界 */}
        <text
          x={MIN_LABEL.x}
          y={MIN_LABEL.y}
          textAnchor="middle"
          fontSize={11}
          className="fill-ink-500 tabular-nums"
        >
          {BPM_MIN}
        </text>
        <text
          x={MAX_LABEL.x}
          y={MAX_LABEL.y}
          textAnchor="middle"
          fontSize={11}
          className="fill-ink-500 tabular-nums"
        >
          {BPM_MAX}
        </text>
      </svg>

      {/*
        环体命中层是 **HTML** 元素，不是 SVG 里的 circle（BLF-1448）。

        `touch-action` 只在 SVG 根元素上可靠生效，挂在 `<circle>` 这类子元素上会被
        浏览器忽略：旧写法给环体写了 `touch-none`，实测在环上竖拖 180px 页面照样
        滚了约 230px，速度也跟着变——一次操作两个结果。
        挪到 SVG 根上能挡住滚动，但会把圆心一起锁死，读数区就不能用来翻页了。

        所以拆成两层 HTML：这一层是整圆、`touch-action: none`，负责接收拖拽；
        上面的圆心盘盖住中间 60%，它没有 `touch-action: none`，拖它页面照常滚。
        60% 这个数沿用旧命中区的内边界（82 - 44/2 = 60，盘面 200 宽即 60%），
        圆心留白和以前一样大，只是现在由 HTML 元素承担 touch-action。
      */}
      <div
        className="absolute inset-0 rounded-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />

      {/* 圆心：盖住环体的中间部分，不接管拖拽也不带 touch-action:none */}
      <div className="absolute left-1/2 top-1/2 size-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      {/* 读数压在圆心：纯视觉，不接管指针 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-6xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="mt-2 text-sm text-ink-700">{tempoName(value)}</p>
      </div>
    </div>
  );
}
