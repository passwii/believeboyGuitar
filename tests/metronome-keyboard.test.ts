import { describe, expect, it, vi } from "vitest";
import {
  bindMetronomeSpaceShortcut,
  type MetronomeKeyboardHost,
} from "@/lib/metronome-keyboard";

type SpaceEventOverrides = Partial<Omit<KeyboardEvent, "target">> & {
  target?: { closest: (selector: string) => unknown } | null;
};

function createEvent(overrides: SpaceEventOverrides = {}) {
  return {
    key: " ",
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent;
}

function createHost() {
  let listener: ((event: KeyboardEvent) => void) | null = null;
  let removed = 0;
  const host: MetronomeKeyboardHost = {
    addEventListener(_type, next) {
      listener = next;
    },
    removeEventListener(_type, current) {
      if (listener === current) listener = null;
      removed += 1;
    },
  };

  return {
    host,
    get removed() {
      return removed;
    },
    dispatch(event: KeyboardEvent) {
      listener?.(event);
    },
  };
}

describe("shared metronome Space shortcut", () => {
  it("toggles once and prevents page scrolling for an unmodified Space key", () => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);
    const event = createEvent();

    target.dispatch(event);

    expect(toggle).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("supports the legacy Spacebar key value", () => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);

    target.dispatch(createEvent({ key: "Spacebar" }));

    expect(toggle).toHaveBeenCalledOnce();
  });

  it("does not handle other keys", () => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);
    const event = createEvent({ key: "Enter" });

    target.dispatch(event);

    expect(toggle).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    ["already handled", { defaultPrevented: true }],
    ["IME composition", { isComposing: true }],
    ["Shift", { shiftKey: true }],
    ["Control", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
  ] as const)("ignores %s events", (_name, overrides) => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);
    const event = createEvent(overrides);

    target.dispatch(event);

    expect(toggle).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("prevents scroll for a held Space without toggling repeatedly", () => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);
    const event = createEvent({ repeat: true });

    target.dispatch(event);

    expect(toggle).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it.each([
    ["native button", "button"],
    ["custom BPM slider", '[role="slider"]'],
  ])("leaves a focused %s alone", (_name, targetSelector) => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);
    const event = createEvent({
      target: {
        closest: (selector) => (selector.includes(targetSelector) ? {} : null),
      },
    });

    target.dispatch(event);

    expect(toggle).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("still works when focus is on the fretboard group", () => {
    const target = createHost();
    const toggle = vi.fn();
    bindMetronomeSpaceShortcut(target.host, toggle);

    target.dispatch(createEvent({ target: { closest: () => null } }));

    expect(toggle).toHaveBeenCalledOnce();
  });

  it("removes its key listener when disposed", () => {
    const target = createHost();
    const toggle = vi.fn();
    const dispose = bindMetronomeSpaceShortcut(target.host, toggle);

    dispose();
    target.dispatch(createEvent());

    expect(toggle).not.toHaveBeenCalled();
    expect(target.removed).toBe(1);
  });
});
