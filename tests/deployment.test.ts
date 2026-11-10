import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("生产运行镜像", () => {
  it("只包含静态导出与 Nginx，不在运行镜像里安装 Node.js", () => {
    const dockerfile = read("Dockerfile");
    expect(dockerfile).toMatch(/FROM nginx:[^\n]+alpine/);
    expect(dockerfile).toContain("COPY dist/ /usr/share/nginx/html/");
    expect(dockerfile).not.toContain("FROM node");
    expect(dockerfile).not.toContain("npm ci");
  });
});

describe("GitHub Actions 生产发布", () => {
  const workflow = read(".github/workflows/deploy.yml");

  it("只作为 main 的手动备用发布，不随 push 自动部署", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("push:\n    branches:");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
  });

  it("在 runner 上验证和构建，再调用共享远程部署脚本", () => {
    expect(workflow).toContain(
      "npm run typecheck && npm test && npm run build && npm run verify:css",
    );
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("type=sha,format=long");
    expect(workflow).toContain("docker/build-push-action");
    expect(workflow).toContain("ssh ");
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).toContain("scripts/deploy-remote.sh");
  });
});

describe("VPS 运行配置", () => {
  const compose = read("deploy/docker-compose.yml");

  it("只绑定回环端口并限制容器日志", () => {
    expect(compose).toContain('"127.0.0.1:${APP_PORT:-8080}:80"');
    expect(compose).toContain("restart: unless-stopped");
    expect(compose).toContain('max-size: "10m"');
    expect(compose).toContain('max-file: "3"');
  });

  it("按 SHA 标签选择镜像", () => {
    expect(compose).toContain(
      "image: ghcr.io/passwii/believeboyguitar:${IMAGE_TAG:-latest}",
    );
  });
});

describe("本地主发布", () => {
  it("发布前验证静态 CSS 已完成 Tailwind 编译", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const script = read("scripts/deploy-local.sh");

    expect(pkg.scripts["verify:css"]).toBe(
      "node scripts/verify-static-css.mjs",
    );
    expect(script).toContain("npm run verify:css");
  });

  it("提供 npm 入口并拒绝部署未进入 main 的提交", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const script = read("scripts/deploy-local.sh");

    expect(pkg.scripts["deploy:local"]).toBe("bash scripts/deploy-local.sh");
    expect(script).toContain("git merge-base --is-ancestor");
    expect(script).toContain("origin/main");
    expect(script).toContain("DEPLOY_HOST");
  });

  it("本地构建、推送不可变镜像并调用共享部署脚本", () => {
    const script = read("scripts/deploy-local.sh");
    expect(script).toContain("npm run build");
    expect(script).not.toContain("--webpack");
    expect(script).toContain("docker buildx build");
    expect(script).toContain("--push");
    expect(script).toContain("sha-$SHA");
    expect(script).toContain("scripts/deploy-remote.sh");
  });

  it("共享远程脚本执行健康检查并支持 SHA 回滚", () => {
    const script = read("scripts/deploy-remote.sh");
    expect(script).toContain("docker compose pull web");
    expect(script).toContain("docker compose up -d --no-build web");
    expect(script).toContain("/healthz");
    expect(script).toContain("Rolling back");
  });
});

describe("Nginx 静态托管", () => {
  const nginx = read("deploy/nginx.conf");

  it("保护 PWA 更新与不可变资源缓存", () => {
    expect(nginx).toContain("location = /sw.js");
    expect(nginx).toContain("no-cache");
    expect(nginx).toContain("location /_astro/");
    expect(nginx).toContain("immutable");
  });

  it("支持 Astro 扁平静态路由和健康检查", () => {
    expect(nginx).toContain("try_files $uri $uri.html $uri/ =404");
    expect(nginx).toContain("error_page 404 /404.html");
    expect(nginx).toContain("location = /healthz");
  });
});

describe("部署手册", () => {
  it("覆盖域名、Caddy、GHCR、Secrets 与回滚", () => {
    const doc = read("docs/deployment.md");
    expect(existsSync(path.join(root, "deploy/Caddyfile.example"))).toBe(true);
    for (const text of [
      "guitar.believeboy.com",
      "SSH_KNOWN_HOSTS",
      "read:packages",
      "docker login ghcr.io",
      "caddy validate",
      "IMAGE_TAG=sha-",
      "npm run deploy:local",
      "workflow_dispatch",
    ]) {
      expect(doc).toContain(text);
    }
  });

  it("说明 Mac 不可用时如何手动触发 GitHub Actions 备用发布", () => {
    const doc = read("docs/deployment.md");

    expect(doc).toContain(
      "https://github.com/passwii/believeboyGuitar/actions/workflows/deploy.yml",
    );
    expect(doc).toContain(
      "gh workflow run deploy.yml --ref main --repo passwii/believeboyGuitar",
    );
    expect(doc).toContain("gh run watch <run-id>");
    expect(doc).toContain("未提交或未推送");
  });
});

describe("Astro static build output", () => {
  it("guards the Pages and VPS routes in dist/", () => {
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
