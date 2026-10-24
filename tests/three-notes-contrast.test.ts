import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ selectedDegree: null as number | null }));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) =>
      initial === null && state.selectedDegree !== null
        ? [state.selectedDegree, () => {}]
        : react.useState(initial),
  };
});

import { ThreeNotesPerString } from "@/components/ThreeNotesPerString";
import { PATTERNS } from "@/lib/guitar";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function color(token: string): string {
  if (token === "white") return "#ffffff";
  const value = css.match(new RegExp(`--color-${token}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing color token: ${token}`);
  return value;
}

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(color(foreground)), luminance(color(background))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function backgroundColor(className: string): string {
  const token = className.match(/(?:^|\s)bg-(white|surface|accent-700|accent-50)(?:\s|$)/)?.[1];
  if (!token) throw new Error(`No solid background color: ${className}`);
  return token;
}

function buttonBackground(button: string): string {
  const className = button.match(/<button\b[^>]*class="([^"]+)"/)?.[1];
  if (!className) throw new Error(`Button class not rendered: ${button}`);
  return backgroundColor(className);
}

function markColor(button: string): string {
  const className = button.match(/<span class="([^"]+)">[①②③④⑤⑥⑦]<\/span>/)?.[1];
  if (!className) throw new Error("Degree mark not rendered");
  const token = className.match(/\btext-(ink-\d+|on-accent)\b/)?.[1];
  if (!token) throw new Error(`Degree mark has no text color: ${className}`);
  return token;
}

function modeColor(button: string, modeZh: string): string {
  const span = [...button.matchAll(/<span class="([^"]+)">([^<]+)<\/span>/g)]
    .find(([, , text]) => text === modeZh);
  if (!span) throw new Error(`Mode label not rendered: ${modeZh}`);
  const token = span[1].match(/\btext-(ink-\d+|on-accent)\b/)?.[1];
  if (!token) throw new Error(`Mode label has no text color: ${span[1]}`);
  return token;
}

function patternButtons(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map(([button]) => button)
    .filter((button) => /[①②③④⑤⑥⑦]/.test(button));
}

function rendered(selectedDegree: number | null): string {
  state.selectedDegree = selectedDegree;
  try {
    return renderToStaticMarkup(createElement(ThreeNotesPerString));
  } finally {
    state.selectedDegree = null;
  }
}

describe("three notes degree mark contrast", () => {
  it("keeps unselected pattern chip mode labels readable on their background", () => {
    const chips = patternButtons(rendered(null).split("七把位速查")[0]);
    expect(chips).toHaveLength(PATTERNS.length);
    chips.forEach((button, index) => {
      expect(button).toContain('aria-pressed="false"');
      expect(contrast(modeColor(button, PATTERNS[index].modeZh), buttonBackground(button)))
        .toBeGreaterThanOrEqual(4.5);
    });
  });

  it("keeps selected pattern chip mode labels readable on rust orange", () => {
    for (const pattern of PATTERNS) {
      const chips = patternButtons(rendered(pattern.degree).split("七把位速查")[0]);
      expect(chips).toHaveLength(PATTERNS.length);
      const button = chips[pattern.degree - 1];
      expect(button).toContain('aria-pressed="true"');
      expect(buttonBackground(button)).toBe("accent-700");
      expect(contrast(modeColor(button, pattern.modeZh), buttonBackground(button)))
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps all unselected pattern chip marks readable on their background", () => {
    const chips = patternButtons(rendered(null).split("七把位速查")[0]);
    expect(chips).toHaveLength(7);
    for (const button of chips) {
      expect(button).toContain('aria-pressed="false"');
      expect(contrast(markColor(button), buttonBackground(button)))
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the selected pattern chip mark readable on rust orange", () => {
    const button = patternButtons(rendered(1).split("七把位速查")[0])[0];
    expect(button).toContain('aria-pressed="true"');
    expect(buttonBackground(button)).toBe("accent-700");
    expect(contrast(markColor(button), buttonBackground(button)))
      .toBeGreaterThanOrEqual(4.5);
  });

  it("keeps quick-reference marks readable on their row or table background", () => {
    for (const selectedDegree of [null, 1]) {
      const html = rendered(selectedDegree);
      const table = html.slice(html.indexOf("七把位速查"));
      const tableBackground = backgroundColor(
        table.match(/<div class="([^"]+)">\s*<table/)?.[1] ?? "",
      );
      const rows = [...table.matchAll(/<tr class="([^"]+)">([\s\S]*?)<\/tr>/g)]
        .filter(([, , content]) => patternButtons(content).length > 0);
      expect(rows).toHaveLength(7);
      expect(rows[0][1].includes("bg-accent-50")).toBe(selectedDegree === 1);
      for (const [, rowClass, content] of rows) {
        const button = patternButtons(content)[0];
        const background = /(?:^|\s)bg-/.test(rowClass)
          ? backgroundColor(rowClass)
          : tableBackground;
        expect(button).toContain(`aria-pressed="${background === "accent-50"}"`);
        expect(contrast(markColor(button), background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
