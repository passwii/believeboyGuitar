import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 部署链路的守护测试。
 *
 * 2026-11 起生产只有 Cloudflare Pages 一条路径：`main` push 由 Pages 的 Git 集成
 * 构建 `dist/` 并发布到 `guitar.believeboy.com`。VPS + GHCR 那套镜像发布链路已下线，
 * 这里既守护「Astro 产物校验仍然存在」，也守护「旧链路没有被重新引回来」。
 */

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Astro static build output", () => {
  it("guards the routes Pages serves from dist/", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const verifierPath = path.join(root, "scripts/verify-astro-output.mjs");
    expect(pkg.scripts.build).toContain("astro build");
    expect(pkg.scripts.build).toContain("verify-astro-output.mjs");
    expect(existsSync(verifierPath)).toBe(true);
    if (!existsSync(verifierPath)) return;
    const verifier = read("scripts/verify-astro-output.mjs");
    for (const file of ["dist/index.html", "dist/practice.html", "dist/library.html", "dist/metronome.html", "dist/404.html", "dist/manifest.webmanifest", "dist/sw.js"]) {
      expect(verifier).toContain(file);
    }
  });

  it("Tailwind 产物检查仍由 npm 入口暴露", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["verify:css"]).toBe("node scripts/verify-static-css.mjs");
    expect(existsSync(path.join(root, "scripts/verify-static-css.mjs"))).toBe(true);
  });
});

describe("Next retirement", () => {
  it("removes Next runtime packages and route configuration after Astro migration", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies).not.toHaveProperty("next");
    expect(pkg.devDependencies).not.toHaveProperty("eslint-config-next");
    for (const name of ["next.config.ts", "next-env.d.ts", "app"]) {
      expect(existsSync(path.join(root, name)), name).toBe(false);
    }
  });
});

describe("生产只有 Cloudflare Pages 一条部署链路", () => {
  it("VPS 镜像、Nginx、Compose 与 Caddy 示例都已移除", () => {
    for (const name of [
      "Dockerfile",
      ".dockerignore",
      "deploy",
      "deploy/nginx.conf",
      "deploy/docker-compose.yml",
      "deploy/Caddyfile.example",
      "scripts/deploy-local.sh",
      "scripts/deploy-remote.sh",
      "docs/deployment.md",
      "docs/deployment-runbook.md",
    ]) {
      expect(existsSync(path.join(root, name)), name).toBe(false);
    }
  });

  it("不再保留 GHCR 镜像发布流水线", () => {
    expect(existsSync(path.join(root, ".github/workflows/deploy.yml"))).toBe(false);
  });

  it("package.json 不再提供 VPS 发布入口", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts).not.toHaveProperty("deploy:local");
    expect(JSON.stringify(pkg)).not.toContain("ghcr.io/passwii/believeboyguitar");
  });
});

describe("Cloudflare Pages 发布手册", () => {
  it("记录 Pages Git 集成所需的构建配置与切换边界", () => {
    const docPath = path.join(root, "docs/cloudflare-pages.md");
    expect(existsSync(docPath)).toBe(true);
    if (!existsSync(docPath)) return;
    const doc = read("docs/cloudflare-pages.md");
    for (const text of [
      "Connect to Git",
      "npm run build",
      "构建输出目录",
      "NODE_VERSION=22",
      "404.html",
      "public/_headers",
      "不需要",
    ]) {
      expect(doc, "缺少：" + text).toContain(text);
    }
    expect(doc).toContain("guitar.believeboy.com");
    expect(doc).toContain("实际切换记录");
  });

  it("写清唯一链路与回滚方式", () => {
    const doc = read("docs/cloudflare-pages.md");
    expect(doc).toContain("Cloudflare Pages 是唯一的部署目标");
    expect(doc).toContain("Rollback");
  });

  it("README 与开发流程都指向 Cloudflare Pages 手册", () => {
    for (const file of ["README.md", "DEVELOPMENT.md"]) {
      expect(read(file)).toContain("docs/cloudflare-pages.md");
    }
  });
});
