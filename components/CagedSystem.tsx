"use client";

import { useMemo, useState } from "react";
import { Fretboard, type FretboardNote } from "@/components/Fretboard";
import {
  CAGED_FRET_COUNT,
  CAGED_SHAPES_BY_POSITION,
  type CagedShape,
} from "@/lib/guitar";

/**
 * CAGED 五个形状在指板上的连接。
 *
 * 五个形状的位置不是写死的：`lib/guitar.ts` 从标准调弦和根音算出来，
 * 这里只负责画。切形状时，高亮该形状按到的音，其余音位变暗。
 *
 * 交互与「一弦三音」那张图保持一致：不给几十个音位加 tab 焦点，
 * 靠形状按钮 + 下方速查表拿到完整信息。
 */

const STRING_HEADERS = [6, 5, 4, 3, 2, 1];

export function CagedSystem() {
  const [activeName, setActiveName] = useState<string | null>(null);

  const activeShape = useMemo(
    () => CAGED_SHAPES_BY_POSITION.find((shape) => shape.name === activeName) ?? null,
    [activeName],
  );

  const activeKeys = useMemo(() => {
    if (!activeShape) return null;
    return new Set(activeShape.notes.map((note) => `${note.stringIndex}-${note.fret}`));
  }, [activeShape]);

  // 指板上所有被 CAGED 循环按到的音：五个形状的并集
  const notes: FretboardNote[] = useMemo(() => {
    const union = new Map<string, FretboardNote>();

    for (const shape of CAGED_SHAPES_BY_POSITION) {
      for (const note of shape.notes) {
        const key = `${note.stringIndex}-${note.fret}`;
        const existing = union.get(key);
        // 根音优先：同一音位被多个形状按到时，标成根音
        union.set(key, {
          key,
          stringIndex: note.stringIndex,
          stringNumber: note.stringNumber,
          fret: note.fret,
          pitchClass: ((note.midi % 12) + 12) % 12,
          label: note.name,
          isRoot: (existing?.isRoot ?? false) || note.isRoot,
          dimmed: false,
          emphasized: false,
          title: `${note.stringNumber} 弦 ${note.fret} 品 · ${note.name}`,
        });
      }
    }

    return [...union.values()]
      .map((note) => ({
        ...note,
        dimmed: activeKeys !== null && !activeKeys.has(note.key),
      }))
      .sort((a, b) => a.stringIndex - b.stringIndex || a.fret - b.fret);
  }, [activeKeys]);

  const ariaLabel = activeShape
    ? `CAGED 的 ${activeShape.name} 形状指板图，根音在 ${activeShape.rootStringNumber} 弦，覆盖 ${activeShape.minFret} 到 ${activeShape.maxFret} 品`
    : `CAGED 五个形状在指板上的位置，根音在 C`;

  return (
    <>
      <section
        aria-labelledby="caged-heading"
        className="rounded-card border border-rule bg-surface p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 id="caged-heading" className="text-title text-ink-950">
            五个形状的连接
          </h2>
          <span className="text-meta text-ink-500">根音 C</span>
        </div>

        <div role="group" aria-label="按形状筛选" className="mt-4 flex flex-wrap gap-1.5">
          <ShapeChip
            active={activeName === null}
            label="显示全部五个形状"
            onClick={() => setActiveName(null)}
          >
            全部
          </ShapeChip>
          {CAGED_SHAPES_BY_POSITION.map((shape) => (
            <ShapeChip
              key={shape.name}
              active={activeName === shape.name}
              label={`${shape.name} 形，${shape.origin}`}
              onClick={() =>
                setActiveName((current) => (current === shape.name ? null : shape.name))
              }
            >
              {shape.name} 形
            </ShapeChip>
          ))}
        </div>

        <div className="relative mt-5">
          <div className="overflow-x-auto overscroll-x-contain">
            <Fretboard
              fretCount={CAGED_FRET_COUNT}
              notes={notes}
              ariaLabel={ariaLabel}
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface to-transparent sm:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-surface to-transparent sm:hidden"
          />
        </div>

        <p className="mt-2 text-meta text-ink-500 sm:hidden">
          左右滑动查看第 1–{CAGED_FRET_COUNT} 品
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4 text-meta text-ink-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-pill bg-accent-600" aria-hidden="true" />
            根音 C
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-pill bg-ink-100" aria-hidden="true" />
            和弦音
          </span>
          <span>标准调弦 EADGBE · 低音弦画在图下方</span>
        </div>

        <ShapeDetail shape={activeShape} />
      </section>

      <ShapeTable
        activeName={activeName}
        onSelect={(name) =>
          setActiveName((current) => (current === name ? null : name))
        }
      />
    </>
  );
}

function ShapeChip({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-meta transition-colors duration-150 ${
        active
          ? "border-transparent bg-accent-700 text-white"
          : "border-rule bg-surface text-ink-700 hover:border-control-edge hover:text-ink-950"
      }`}
    >
      {children}
    </button>
  );
}

function ShapeDetail({ shape }: { shape: CagedShape | null }) {
  if (!shape) {
    return (
      <p className="mt-4 border-t border-rule pt-4 text-meta leading-relaxed text-ink-500">
        图上标出的是五个形状按到的所有音。点选上方任一形状，只留下那一个形状的
        按法——注意相邻两个形状在指板上是首尾相接的，根音落在同一条 C 上。
      </p>
    );
  }

  const items = [
    ["根音位置", `${shape.rootStringNumber} 弦 ${shape.baseFret + 3} 品起`],
    ["品域", `${shape.minFret}–${shape.maxFret} 品`],
    ["根音", shape.rootNote],
    ["来源", shape.origin],
  ] as const;

  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-4 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-micro uppercase text-ink-500">{label}</dt>
          <dd className="mt-1 text-label text-ink-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ShapeTable({
  activeName,
  onSelect,
}: {
  activeName: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <section aria-labelledby="caged-table-heading" className="mt-8">
      <h2 id="caged-table-heading" className="text-title text-ink-950">
        五形状速查
      </h2>
      <p className="mt-1 text-meta leading-relaxed text-ink-500">
        每格是那个形状按到的音：数字是品位，字母是音名。
      </p>

      <div className="mt-3 overflow-hidden rounded-card border border-rule bg-surface">
        {/* 表格自己横向滚动（display: block），不靠外层容器：
            display: table 的表格宽度由内容决定，放进 overflow-x-auto 里仍会撑破页面。 */}
        <table className="block w-full max-w-full overflow-x-auto overscroll-x-contain border-collapse text-label">
          <caption className="sr-only">
            CAGED 五个形状在 C 大调下的按法：每格是该形状按到的品位与音名
          </caption>
          <thead>
            <tr className="border-b border-rule text-micro uppercase text-ink-500">
              <th scope="col" className="w-[120px] px-3 py-2.5 text-left font-medium">
                形状
              </th>
              {STRING_HEADERS.map((stringNumber) => (
                <th
                  key={stringNumber}
                  scope="col"
                  className="px-2 py-2.5 text-center font-medium"
                >
                  {stringNumber} 弦
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAGED_SHAPES_BY_POSITION.map((shape) => {
              const active = activeName === shape.name;
              return (
                <tr
                  key={shape.name}
                  className={`border-b border-rule last:border-0 ${active ? "bg-accent-50" : ""}`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(shape.name)}
                      className="row-button whitespace-nowrap hover:bg-accent-50"
                    >
                      <span className="font-semibold text-ink-950">{shape.name} 形</span>
                      <span className="text-micro text-ink-500">{shape.baseFret} 起</span>
                    </button>
                  </th>

                  {STRING_HEADERS.map((stringNumber) => {
                    const note = shape.notes.find(
                      (item) => item.stringNumber === stringNumber,
                    );
                    return (
                      <td key={stringNumber} className="px-2 py-1.5 text-center">
                        {note ? (
                          <span className="flex flex-col items-center leading-tight">
                            <span
                              className={`font-mono text-micro ${
                                note.isRoot
                                  ? "font-semibold text-accent-700"
                                  : "text-ink-700"
                              }`}
                            >
                              {note.fret}
                            </span>
                            <span
                              className={`text-micro ${
                                note.isRoot
                                  ? "font-medium text-accent-700"
                                  : "text-ink-500"
                              }`}
                            >
                              {note.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-micro text-ink-300" aria-hidden="true">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
