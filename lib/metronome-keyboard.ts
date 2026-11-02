const INTERACTIVE_TARGETS = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "summary",
  "[contenteditable='true']",
  '[role="button"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="combobox"]',
].join(", ");

export type MetronomeKeyboardHost = {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const closest = (target as Element).closest;
  return typeof closest === "function" && Boolean(closest.call(target, INTERACTIVE_TARGETS));
}

/** Bind the shared Space shortcut while leaving native and custom controls in charge. */
export function bindMetronomeSpaceShortcut(
  host: MetronomeKeyboardHost,
  toggle: () => void,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.key !== " " && event.key !== "Spacebar") return;
    if (isInteractiveTarget(event.target)) return;

    event.preventDefault();
    if (event.repeat) return;
    toggle();
  };

  host.addEventListener("keydown", onKeyDown);
  return () => host.removeEventListener("keydown", onKeyDown);
}
