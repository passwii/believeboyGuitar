import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const cssDirectory = path.join(process.cwd(), "dist", "_astro");
const files = (await readdir(cssDirectory))
  .filter((file) => file.endsWith(".css"))
  .sort();

if (files.length === 0) {
  throw new Error(`No CSS assets found in ${cssDirectory}`);
}

const css = (
  await Promise.all(
    files.map((file) => readFile(path.join(cssDirectory, file), "utf8")),
  )
).join("\n");

const unprocessed = [
  ["Tailwind import", /@tailwind\s+utilities/],
  ["Tailwind theme", /@theme(?:\s+default)?\s*\{/],
].filter(([, pattern]) => pattern.test(css));

if (unprocessed.length > 0) {
  const directives = unprocessed.map(([name]) => name).join(", ");
  throw new Error(`Static CSS contains unprocessed Tailwind directives: ${directives}`);
}

const requiredSelectors = [
  ".shell",
  ".home-hero",
  ".flex",
  ".text-ink-950",
  ".bg-accent-700",
];
const missing = requiredSelectors.filter((selector) => !css.includes(selector));

if (missing.length > 0) {
  throw new Error(`Static CSS is missing expected selectors: ${missing.join(", ")}`);
}

console.log(
  `Verified ${files.length} compiled CSS asset(s) with Tailwind utilities.`,
);
