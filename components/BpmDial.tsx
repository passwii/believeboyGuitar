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
 * 命中区只做在环体那一圈（`pointer-events: stroke`）：圆心是读数，点它不该改速度；
 * 页面滚动也不该被这块 240px 的圆盘吃掉——这正是 `touch-none` 只挂在环上的原因。
 *
 * 不在 pointerdown 里抢焦点：环体是 SVG 元素，浏览器本来就不会把焦点顺带给外层
 * 容器，强行 focus() 会让鼠标拖一次就出现一圈整环的焦点环，和圆环本身分不开。
 * 键盘用户从 Tab 进来，方向微调照常可用。
 */

const VIEW = 200;
const CENTER = VIEW / 2;
const RADIUS = 82;
const STROKE = 9;
/** 环体的可拖拽宽度：比视觉描边宽，手指好按住（约 44px） */
const HIT_STROKE = 44;

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
  const bpmAt = useCallback((event: PointerEvent<SVGCircleElement>): number | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // 引脚点算在 viewBox 坐标系里的比例位置，避免 SVG 缩放的换算误差
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return dialPointToBpm(dx, dy);
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGCircleElement>) => {
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
    (event: PointerEvent<SVGCircleElement>) => {
      if (!draggingRef.current) return;
      const next = bpmAt(event);
      if (next !== null && next !== value) onChange(next);
    },
    [bpmAt, onChange, value],
  );

  const endDrag = useCallback((event: PointerEvent<SVGCircleElement>) => {
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
        {/* 透明加宽的环体：既是拖拽命中区，也让上下滑动页面经过圆心时不被吃掉 */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="transparent"
          strokeWidth={HIT_STROKE}
          pointerEvents="stroke"
          className="touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </svg>

      {/* 读数压在圆环中心：不接管指针，落在圆心上时页面照常滚动 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-6xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="mt-2 text-sm text-ink-700">{tempoName(value)}</p>
      </div>
    </div>
  );
}
