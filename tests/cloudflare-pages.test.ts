import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function parseHeaders(source: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    if (!/^\s/.test(line)) {
      const pattern = line.trim();
      if (!pattern.startsWith("/")) {
        throw new Error(`_headers line ${index + 1} has an invalid path: ${pattern}`);
      }
      current = new Map();
      rules.set(pattern, current);
      continue;
    }

    if (!current) {
      throw new Error(`_headers line ${index + 1} has no path rule`);
    }

    const match = line.trim().match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      throw new Error(`_headers line ${index + 1} is not a valid header`);
    }
    current.set(match[1].toLowerCase(), match[2]);
  }

  return rules;
}

describe("Cloudflare Pages 上线前准备", () => {
  it("提供可重复的构建后静态导出校验入口", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["verify:export"]).toBe(
      "node scripts/verify-static-export.mjs",
    );
    expect(read("scripts/deploy-local.sh")).toContain("npm run verify:export");
    expect(read(".github/workflows/deploy.yml")).toContain("npm run verify:export");
  });

  it("把 PWA 与不可变构建资源的缓存契约写入 _headers", () => {
    const rules = parseHeaders(read("public/_headers"));

    expect(rules.get("/sw.js")?.get("cache-control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(rules.get("/manifest.webmanifest")?.get("cache-control")).toBe(
      "no-cache",
    );
    expect(rules.get("/_next/static/*")?.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("构建后校验覆盖关键路由、PWA 资源和 Pages 文件", () => {
    const script = read("scripts/verify-static-export.mjs");

    for (const expected of [
      "out/_headers",
      "/",
      "/practice",
      "/practice/${slug}",
      "/library",
      "/library/fretboard-scale",
      "/metronome",
      "/tools/metronome",
      "404.html",
      "sw.js",
      "manifest.webmanifest",
    ]) {
      expect(script).toContain(expected);
    }
  });

  it("文档明确这只是上线前准备，不是已经完成 Cloudflare 部署", () => {
    const doc = read("docs/cloudflare-pages.md");

    expect(doc).toContain("上线前准备，不代表已经部署到 Cloudflare");
    expect(doc).toContain("npm run verify:export");
    expect(doc).toContain("npx wrangler pages dev out");
    expect(read("docs/deployment.md")).toContain("cloudflare-pages.md");
  });

  it("忽略 Wrangler 本地模拟状态", () => {
    expect(read(".gitignore")).toContain(".wrangler/");
  });
});
