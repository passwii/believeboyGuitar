"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { PracticeEntry } from "@/content/manifest";

export function PracticeEntryPicker({
  items,
  currentSlug,
}: {
  items: readonly PracticeEntry[];
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

  const currentLabel = current.label ?? current.title;

  return (
    <div ref={pickerRef} className="practice-picker">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`切换练习，当前 ${currentLabel}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="practice-picker__trigger"
      >
        <span>{currentLabel}</span>
        <Icon name="chevron-right" className="practice-picker__chevron size-3.5" />
      </button>

      <div id={menuId} hidden={!open} className="practice-picker__menu">
        <p className="practice-picker__label">选择练习</p>
        <nav aria-label="练习条目">
          <ul className="practice-picker__grid">
            {items.map((item) => {
              const isCurrent = item.slug === currentSlug;
              return (
                <li key={item.slug}>
                  <a
                    href={`/practice/${item.slug}`}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`practice-picker__link ${
                      isCurrent ? "practice-picker__link--current" : ""
                    }`}
                  >
                    {item.label ?? item.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
