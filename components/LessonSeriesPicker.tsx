"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { Lesson } from "@/content/manifest";

export function LessonSeriesPicker({
  items,
  currentSlug,
}: {
  items: readonly Lesson[];
  currentSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = items.find((item) => item.slug === currentSlug) ?? items[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!current || items.length < 2) return null;

  const currentLabel = current.series?.label ?? current.title;

  return (
    <div ref={pickerRef} className="week-picker">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`切换训练周次，当前 ${currentLabel}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="week-picker__trigger"
      >
        <span>{currentLabel}</span>
        <Icon name="chevron-right" className="week-picker__chevron size-3.5" />
      </button>

      <div id={menuId} hidden={!open} className="week-picker__menu">
        <p className="week-picker__label">选择周次</p>
        <nav aria-label="训练周次">
          <ul className="week-picker__grid">
            {items.map((item) => {
              const isCurrent = item.slug === currentSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/library/${item.slug}`}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`week-picker__link ${
                      isCurrent ? "week-picker__link--current" : ""
                    }`}
                  >
                    {item.series?.label ?? item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
