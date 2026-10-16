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

function markColor(button: string): string {
  const className = button.match(/<span class="([^"]+)">[①②③④⑤⑥⑦]<\/span>/)?.[1];
  if (!className) throw new Error("Degree mark not rendered");
  const token = className.match(/\btext-(ink-\d+|white)\b/)?.[1];
  if (!token) throw new Error(`Degree mark has no text color: ${className}`);
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
  it("keeps all unselected pattern chip marks readable on white", () => {
    const chips = patternButtons(rendered(null).split("七把位速查")[0]);
    expect(chips).toHaveLength(7);
    for (const button of chips) {
      expect(button).toContain('aria-pressed="false"');
      expect(button).toContain("bg-white");
      expect(contrast(markColor(button), "white")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the selected pattern chip mark readable on ink-950", () => {
    const button = patternButtons(rendered(1).split("七把位速查")[0])[0];
    expect(button).toContain('aria-pressed="true"');
    expect(button).toContain("bg-ink-950");
    expect(contrast(markColor(button), "ink-950")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps quick-reference marks readable on white and accent-50 rows", () => {
    for (const selectedDegree of [null, 1]) {
      const html = rendered(selectedDegree);
      const table = html.slice(html.indexOf("七把位速查"));
      const rows = [...table.matchAll(/<tr class="([^"]+)">([\s\S]*?)<\/tr>/g)]
        .filter(([, , content]) => patternButtons(content).length > 0);
      expect(rows).toHaveLength(7);
      expect(rows[0][1].includes("bg-accent-50")).toBe(selectedDegree === 1);
      for (const [, rowClass, content] of rows) {
        const button = patternButtons(content)[0];
        const background = rowClass.includes("bg-accent-50") ? "accent-50" : "white";
        expect(button).toContain(`aria-pressed="${background === "accent-50"}"`);
        expect(contrast(markColor(button), background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
