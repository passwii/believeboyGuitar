import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");
const fail = (message) => {
  throw new Error(message);
};

async function readRequired(relativePath) {
  try {
    return await readFile(path.join(outDir, relativePath));
  } catch {
    fail(`Missing static export file: out/${relativePath}`);
  }
}

async function findRouteFile(route) {
  const pathname = route === "/" ? "" : route.slice(1);
  const candidates =
    route === "/"
      ? ["index.html"]
      : [`${pathname}.html`, `${pathname}/index.html`];

  for (const candidate of candidates) {
    try {
      await readFile(path.join(outDir, candidate));
      return candidate;
    } catch {
      // Try the other clean-URL representation used by Next static export.
    }
  }

  fail(`Missing route ${route}; expected ${candidates.map((item) => `out/${item}`).join(" or ")}`);
}

function parseHeaderRules(source) {
  const rules = new Map();
  let current;

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    if (!/^\s/.test(line)) {
      const pattern = line.trim();
      if (!pattern.startsWith("/")) {
        fail(`public/_headers line ${index + 1} has an invalid path: ${pattern}`);
      }
      if (rules.has(pattern)) {
        fail(`public/_headers defines ${pattern} more than once`);
      }
      current = new Map();
      rules.set(pattern, current);
      continue;
    }

    if (!current) {
      fail(`public/_headers line ${index + 1} has no path rule`);
    }

    const match = line.trim().match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      fail(`public/_headers line ${index + 1} is not a valid header`);
    }
    current.set(match[1].toLowerCase(), match[2]);
  }

  return rules;
}

async function verifyHeaders() {
  const source = await readFile(path.join(root, "public", "_headers"), "utf8");
  const output = await readRequired("_headers");

  if (!source.trim()) fail("public/_headers must not be empty");
  if (!Buffer.from(source).equals(output)) {
    fail("out/_headers differs from public/_headers");
  }

  const rules = parseHeaderRules(source);
  if (rules.size > 100) {
    fail(`public/_headers has ${rules.size} rules; Cloudflare Pages allows at most 100`);
  }

  const required = new Map([
    ["/sw.js", "no-cache, no-store, must-revalidate"],
    ["/manifest.webmanifest", "no-cache"],
    ["/_next/static/*", "public, max-age=31536000, immutable"],
  ]);

  for (const [pattern, expected] of required) {
    const actual = rules.get(pattern)?.get("cache-control");
    if (actual !== expected) {
      fail(
        `public/_headers ${pattern} Cache-Control must be "${expected}", got ${JSON.stringify(actual)}`,
      );
    }
  }
}

async function verifyRoutes(practiceSlugs) {
  const routes = [
    "/",
    "/practice",
    ...practiceSlugs.map((slug) => `/practice/${slug}`),
    "/library",
    "/library/fretboard-scale",
    "/metronome",
    "/tools/metronome",
  ];
  const routeFiles = [];

  for (const route of routes) {
    routeFiles.push([route, await findRouteFile(route)]);
  }

  return routeFiles;
}

async function verifyPwa() {
  const manifestBytes = await readRequired("manifest.webmanifest");
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    fail("out/manifest.webmanifest is not valid JSON");
  }

  if (manifest.start_url !== "/") {
    fail(`out/manifest.webmanifest start_url must be "/", got ${JSON.stringify(manifest.start_url)}`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail("out/manifest.webmanifest must declare PWA icons");
  }

  const swSource = await readFile(path.join(root, "public", "sw.js"));
  const swOutput = await readRequired("sw.js");
  if (!swSource.equals(swOutput)) {
    fail("out/sw.js differs from public/sw.js");
  }
}

async function verifyStaticAssets() {
  let entries;
  try {
    entries = await readdir(path.join(outDir, "_next", "static"), {
      withFileTypes: true,
    });
  } catch {
    fail("Missing static export directory: out/_next/static");
  }

  if (entries.length === 0) {
    fail("out/_next/static is empty");
  }
}

async function main() {
  const lessonDirectory = path.join(root, "content", "lessons");
  const practiceSlugs = (await readdir(lessonDirectory))
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();

  if (practiceSlugs.length === 0) {
    fail("No lesson HTML files found under content/lessons");
  }

  await readRequired("404.html");
  await verifyStaticAssets();
  await verifyHeaders();
  await verifyPwa();
  const routeFiles = await verifyRoutes(practiceSlugs);

  console.log(
    `Verified Cloudflare Pages static export: ${routeFiles.length} routes, ` +
      "out/404.html, out/_headers, out/sw.js, out/manifest.webmanifest, and _next/static.",
  );
  for (const [route, file] of routeFiles) {
    console.log(`  ${route} -> out/${file}`);
  }
}

main().catch((error) => {
  console.error(`Static export verification failed: ${error.message}`);
  process.exitCode = 1;
});
