import { access, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "dist/index.html",
  "dist/practice.html",
  "dist/library.html",
  "dist/library/fretboard-scale.html",
  "dist/metronome.html",
  "dist/tools/metronome.html",
  "dist/404.html",
  "dist/manifest.webmanifest",
  "dist/sw.js",
  "dist/_headers",
  "dist/icons/icon-192.png",
  "dist/icons/icon-512.png",
  "dist/icons/icon-maskable-512.png",
];

const failures = [];
for (const file of requiredFiles) {
  try {
    await access(path.join(root, file));
  } catch {
    failures.push("missing " + file);
  }
}

const lessonDirectory = path.join(root, "content", "lessons");
const practiceOutput = path.join(root, "dist", "practice");
const lessonFiles = (await readdir(lessonDirectory))
  .filter((file) => file.endsWith(".html"))
  .sort();
let practiceFiles = [];
try {
  practiceFiles = (await readdir(practiceOutput))
    .filter((file) => file.endsWith(".html"))
    .sort();
} catch {
  failures.push("missing dist/practice/");
}

const missingLessons = lessonFiles.filter((file) => !practiceFiles.includes(file));
const unexpectedLessons = practiceFiles.filter((file) => !lessonFiles.includes(file));
if (missingLessons.length) failures.push("missing practice routes: " + missingLessons.join(", "));
if (unexpectedLessons.length) failures.push("unexpected practice routes: " + unexpectedLessons.join(", "));

let astroAssets = [];
try {
  astroAssets = await readdir(path.join(root, "dist", "_astro"));
} catch {
  failures.push("missing dist/_astro/");
}
if (!astroAssets.some((file) => file.endsWith(".css"))) failures.push("missing Astro CSS assets");
if (!astroAssets.some((file) => file.endsWith(".js"))) failures.push("missing Astro JavaScript assets");

if (failures.length) {
  throw new Error("Astro build output verification failed:\n- " + failures.join("\n- "));
}

console.log("Verified Astro static output: " + requiredFiles.length + " shell assets, " + practiceFiles.length + " practice routes, " + astroAssets.length + " hashed assets.");
