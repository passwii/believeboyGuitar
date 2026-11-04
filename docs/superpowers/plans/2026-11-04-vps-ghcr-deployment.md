# VPS + GHCR 自动部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 由 GitHub Actions 构建纯静态站点并推送 GHCR，VPS 只拉取运行镜像并由现有 Caddy 提供 `guitar.believeboy.com`。

**Architecture:** Actions 在 runner 上执行现有 npm 门禁，把 `out/` 和 Nginx 配置构建成极简镜像；VPS 通过 Docker Compose 拉取 commit SHA 镜像，容器只绑定回环端口，Caddy 负责域名与 TLS。

**Tech Stack:** Next.js 16 静态导出、Node.js 24、GitHub Actions、GHCR、Docker Compose、Nginx、Caddy、Vitest

## Global Constraints

- `content/manifest.ts` 是练习与资料目录的唯一事实来源。
- `content/lessons/*.html` 的语义标签与 widget 规则不变。
- 曲谱只做简谱和既有 TAB，不引入五线谱。
- VPS 不执行 `npm`、`next build` 或任何应用构建。
- 容器只绑定 `127.0.0.1:${APP_PORT:-8080}:80`，公网流量必须经过现有 Caddy。
- GHCR 镜像名为 `ghcr.io/passwii/believeboyguitar`，发布标签包含 `sha-<full commit sha>` 与 `latest`。
- Actions 只负责主分支生产发布，不添加 pull request 常规 CI。
- 不把 SSH 私钥、GHCR token、域名配置或 VPS 信息写入镜像和仓库。
- 完成代码后必须运行 `npm run typecheck && npm test && npm run build`。

---

### Task 1: 部署配置守护测试

**Files:**
- Create: `tests/deployment.test.ts`
- Modify: `tests/development-docs.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: 对 `Dockerfile`、`.github/workflows/deploy.yml`、`deploy/nginx.conf`、`deploy/docker-compose.yml` 和 `docs/deployment.md` 的文本契约检查。

- [x] **Step 1: 新建部署守护测试**

```ts
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
    expect(dockerfile).toContain("COPY out/ /usr/share/nginx/html/");
    expect(dockerfile).not.toContain("FROM node");
    expect(dockerfile).not.toContain("npm ci");
  });
});

describe("GitHub Actions 生产发布", () => {
  const workflow = read(".github/workflows/deploy.yml");

  it("只从 main 自动发布，并支持手动触发", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
  });

  it("在 runner 上验证和构建，再把不可变标签推到 GHCR", () => {
    expect(workflow).toContain("npm run typecheck && npm test && npm run build");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("type=sha,format=long");
    expect(workflow).toContain("docker/build-push-action");
    expect(workflow.indexOf("Build and push")).toBeLessThan(
      workflow.indexOf("Deploy over SSH"),
    );
  });

  it("使用系统 ssh，并在部署后检查健康端点", () => {
    expect(workflow).toContain("ssh ");
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).toContain("/healthz");
    expect(workflow).toContain("docker compose pull web");
    expect(workflow).toContain("docker compose up -d --no-build web");
  });
});

describe("VPS 运行配置", () => {
  const compose = read("deploy/docker-compose.yml");

  it("只绑定回环端口并限制容器日志", () => {
    expect(compose).toContain(
      '"127.0.0.1:${APP_PORT:-8080}:80"',
    );
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

describe("Nginx 静态托管", () => {
  const nginx = read("deploy/nginx.conf");

  it("保护 PWA 更新与不可变资源缓存", () => {
    expect(nginx).toContain("location = /sw.js");
    expect(nginx).toContain("no-cache");
    expect(nginx).toContain("location /_next/static/");
    expect(nginx).toContain("immutable");
  });

  it("支持 Next.js 静态路由和健康检查", () => {
    expect(nginx).toContain("try_files $uri $uri/ $uri.html =404");
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
    ]) {
      expect(doc).toContain(text);
    }
  });
});
```

- [x] **Step 2: 更新开发文档守护测试，把旧“禁止 CI”断言改成生产部署例外**

把 `tests/development-docs.test.ts` 中：

```ts
it("明确本仓库不做 CI", () => {
  expect(doc).toContain("没有 GitHub Actions");
  expect(doc).toContain(".github/workflows/");
});
```

替换为：

```ts
it("明确 GitHub Actions 只用于生产部署，不添加 PR 常规 CI", () => {
  expect(doc).toContain("GitHub Actions 只用于生产部署");
  expect(doc).toContain(".github/workflows/deploy.yml");
  expect(doc).toContain("不添加面向 pull request 的常规 CI");
});
```

- [x] **Step 3: 运行测试，确认因文件缺失而失败**

Run: `npx vitest run tests/deployment.test.ts tests/development-docs.test.ts`

Expected: `deployment.test.ts` 因 `Dockerfile` 或 `.github/workflows/deploy.yml` 不存在失败；`development-docs.test.ts` 因旧文案断言失败。

- [x] **Step 4: 提交测试契约**

```bash
git add tests/deployment.test.ts tests/development-docs.test.ts
git commit --author="DamonRock <jr.way123@gmail.com>" -m "test(deploy): 固化 VPS GHCR 发布约束"
```

### Task 2: 极简 Nginx 运行镜像与 Compose

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `deploy/nginx.conf`
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile.example`
- Test: `tests/deployment.test.ts`

**Interfaces:**
- Consumes: `npm run build` 生成的 `out/`。
- Produces: 监听容器 `80` 的静态站点镜像；Compose 服务名 `web`，宿主端口由 `APP_PORT` 控制，镜像标签由 `IMAGE_TAG` 控制。

- [x] **Step 1: 创建运行镜像**

`Dockerfile`：

```dockerfile
FROM nginx:1.29-alpine

LABEL org.opencontainers.image.title="believeboy guitar"
LABEL org.opencontainers.image.description="Static guitar practice site"

RUN rm -rf /usr/share/nginx/html/*
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY out/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
```

`.dockerignore`：

```text
*
!out/
!out/**
!deploy/
!deploy/nginx.conf
```

- [x] **Step 2: 创建 Nginx 静态配置**

`deploy/nginx.conf`：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_types
  application/javascript
  application/json
  application/manifest+json
  application/xml
  image/svg+xml
  text/css
  text/javascript
  text/plain;

server {
  listen 80;
  listen [::]:80;
  server_name _;
  server_tokens off;
  charset utf-8;

  root /usr/share/nginx/html;
  index index.html;

  location = /healthz {
    access_log off;
    add_header Content-Type text/plain;
    return 200 "ok\n";
  }

  location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    try_files $uri =404;
  }

  location = /manifest.webmanifest {
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
  }

  location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }

  location / {
    add_header Cache-Control "no-cache" always;
    try_files $uri $uri.html $uri/ =404;
  }

  error_page 404 /404.html;

  location = /404.html {
    internal;
  }
}
```

- [x] **Step 3: 创建 Compose 与 Caddy 示例**

`deploy/docker-compose.yml`：

```yaml
services:
  web:
    image: ghcr.io/passwii/believeboyguitar:${IMAGE_TAG:-latest}
    container_name: believeboy-guitar
    restart: unless-stopped
    ports:
      - "127.0.0.1:${APP_PORT:-8080}:80"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1/healthz || exit 1"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

`deploy/Caddyfile.example`：

```caddyfile
guitar.believeboy.com {
  encode zstd gzip
  header {
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    -Server
  }
  reverse_proxy 127.0.0.1:8080
}
```

- [x] **Step 4: 跑测试和 Compose 配置校验**

Run: `npx vitest run tests/deployment.test.ts`

Expected: 运行镜像、Compose、Nginx 测试通过；仅 Actions 和部署文档测试仍失败。

Run: `docker compose -f deploy/docker-compose.yml config`

Expected: 输出去掉注释后的 Compose YAML，退出码 `0`。

- [x] **Step 5: 提交运行配置**

```bash
git add Dockerfile .dockerignore deploy/nginx.conf deploy/docker-compose.yml deploy/Caddyfile.example
git commit --author="DamonRock <jr.way123@gmail.com>" -m "build(deploy): 新增 Nginx 静态运行镜像"
```

### Task 3: GitHub Actions 构建、GHCR 与 SSH 发布

**Files:**
- Create: `.github/workflows/deploy.yml`
- Test: `tests/deployment.test.ts`

**Interfaces:**
- Consumes: `out/`、`Dockerfile`、`deploy/docker-compose.yml`。
- Produces: `ghcr.io/passwii/believeboyguitar:sha-<full commit sha>` 与 `:latest`；SSH 部署至 `DEPLOY_PATH`。

- [x] **Step 1: 创建工作流**

`.github/workflows/deploy.yml`：

```yaml
name: Deploy production

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: production-deploy
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

env:
  IMAGE_NAME: ghcr.io/passwii/believeboyguitar

jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    env:
      SSH_PORT: ${{ vars.SSH_PORT || '22' }}
      APP_PORT: ${{ vars.APP_PORT || '8080' }}
      DOCKER_PLATFORM: ${{ vars.DOCKER_PLATFORM || 'linux/amd64' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Verify and build static export
        run: npm run typecheck && npm test && npm run build

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=sha,format=long
            type=raw,value=latest,enable={{is_default_branch}}
          labels: |
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile
          platforms: ${{ env.DOCKER_PLATFORM }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Configure SSH
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_KNOWN_HOSTS: ${{ secrets.SSH_KNOWN_HOSTS }}
        run: |
          set -euo pipefail
          test -n "$SSH_PRIVATE_KEY"
          test -n "$SSH_KNOWN_HOSTS"
          install -m 700 -d "$HOME/.ssh"
          printf '%s\n' "$SSH_PRIVATE_KEY" > "$HOME/.ssh/believeboy-guitar"
          chmod 600 "$HOME/.ssh/believeboy-guitar"
          printf '%s\n' "$SSH_KNOWN_HOSTS" > "$HOME/.ssh/known_hosts"
          chmod 600 "$HOME/.ssh/known_hosts"

      - name: Sync compose file
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}
        run: |
          set -euo pipefail
          scp -P "$SSH_PORT" -i "$HOME/.ssh/believeboy-guitar" \
            -o IdentitiesOnly=yes \
            -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
            -o StrictHostKeyChecking=yes \
            deploy/docker-compose.yml \
            "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/docker-compose.yml"

      - name: Deploy over SSH
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}
          IMAGE_TAG: sha-${{ github.sha }}
        run: |
          set -euo pipefail
          ssh -p "$SSH_PORT" -i "$HOME/.ssh/believeboy-guitar" \
            -o IdentitiesOnly=yes \
            -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
            -o StrictHostKeyChecking=yes \
            "$SSH_USER@$SSH_HOST" \
            "IMAGE_TAG='$IMAGE_TAG' DEPLOY_PATH='$DEPLOY_PATH' APP_PORT='$APP_PORT' bash -s" <<'REMOTE_SCRIPT'
          set -euo pipefail
          cd "$DEPLOY_PATH"
          docker compose pull web
          docker compose up -d --no-build web

          for attempt in $(seq 1 15); do
            if curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null; then
              echo "Deployment healthy after ${attempt} attempt(s)."
              exit 0
            fi
            sleep 2
          done

          docker compose ps
          docker compose logs --tail=100 web
          exit 1
          REMOTE_SCRIPT
```

- [x] **Step 2: 校验工作流文本契约**

Run: `npx vitest run tests/deployment.test.ts`

Expected: 全部通过。

- [x] **Step 3: 检查 GitHub Actions YAML 语法**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`

Expected: 无输出，退出码 `0`。若本机无法运行 Docker，则记录该限制，并以 GitHub 首次工作流解析结果作为最终校验。

- [x] **Step 4: 提交工作流**

```bash
git add .github/workflows/deploy.yml
git commit --author="DamonRock <jr.way123@gmail.com>" -m "ci(deploy): 构建并发布 GHCR 镜像到 VPS"
```

### Task 4: 部署手册与开发规则

**Files:**
- Create: `docs/deployment.md`
- Modify: `CLAUDE.md`
- Modify: `DEVELOPMENT.md`
- Modify: `README.md`
- Test: `tests/development-docs.test.ts`
- Test: `tests/deployment.test.ts`

**Interfaces:**
- Consumes: Task 2 的 Compose/Caddy 配置与 Task 3 的 Secrets 名称。
- Produces: 首次部署、日常发布、DNS、Caddy、GHCR、排障和回滚步骤。

- [x] **Step 1: 编写部署手册**

`docs/deployment.md` 必须包含以下完整章节和命令：

```markdown
# VPS + GHCR 部署

生产域名：`guitar.believeboy.com`

## 架构

GitHub Actions 在 runner 上运行类型检查、测试和静态构建，再把 `out/` 与 Nginx
打包成 `ghcr.io/passwii/believeboyguitar`。VPS 只拉取镜像并运行容器，现有 Caddy
负责域名和 HTTPS。

## VPS 前提

- Docker Engine 与 Docker Compose v2。
- 已安装并运行 Caddy。
- 部署账号能执行 `docker compose`，推荐加入 `docker` 用户组。
- `curl` 可供健康检查使用。
- `80`、`443` 对公网开放；应用端口 `8080` 只监听回环地址。

## DNS 与 Caddy

1. 在 DNS 服务商给 `guitar.believeboy.com` 添加指向 VPS 的 `A` 记录；有 IPv6 时再添加 `AAAA`。
2. 等待解析生效：

   ```bash
   dig +short guitar.believeboy.com
   ```

3. 把 `deploy/Caddyfile.example` 中的站点块加入 VPS 现有 Caddyfile。
4. 校验并重载：

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   sudo systemctl reload caddy
   ```

Caddy 会自动申请和续期证书。应用容器不处理 TLS。

## 首次准备

```bash
sudo install -d -o "$USER" -g "$USER" -m 755 /opt/believeboy-guitar
cd /opt/believeboy-guitar
```

如果镜像保持私有，在 VPS 创建只读 GHCR token，并执行：

```bash
read -rsp "GHCR read token: " GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u passwii --password-stdin
unset GHCR_TOKEN
```

token 只授予 `read:packages`。不要把 token 写入 Compose、脚本或 shell 历史。

## SSH 部署凭据

在可信机器生成只用于 GitHub Actions 的密钥：

```bash
ssh-keygen -t ed25519 -C "github-actions-guitar" -f ~/.ssh/believeboy-guitar_deploy
```

把 `.pub` 内容加入 VPS 部署账号的 `~/.ssh/authorized_keys`。私钥内容保存到
GitHub Secret `SSH_PRIVATE_KEY`。

生成 `SSH_KNOWN_HOSTS`：

```bash
ssh-keyscan -H guitar.believeboy.com
```

核对 VPS 主机密钥指纹后，把完整输出保存到 GitHub Secret `SSH_KNOWN_HOSTS`。

## GitHub Secrets

在仓库或 `production` Environment 配置：

| Secret | 内容 |
| --- | --- |
| `SSH_HOST` | VPS 主机名或 IP |
| `SSH_USER` | 部署账号 |
| `SSH_PRIVATE_KEY` | 专用 SSH 私钥全文 |
| `SSH_KNOWN_HOSTS` | 已核对的 `ssh-keyscan -H` 输出 |
| `DEPLOY_PATH` | `/opt/believeboy-guitar` |

可选 Repository Variables：

| Variable | 默认值 | 用途 |
| --- | --- | --- |
| `SSH_PORT` | `22` | SSH 端口 |
| `APP_PORT` | `8080` | VPS 回环端口，必须与 Caddy 一致 |
| `DOCKER_PLATFORM` | `linux/amd64` | VPS 不是 x86_64 时改成 `linux/arm64` |

## 发布

合并到 `main` 后，`.github/workflows/deploy.yml` 自动执行。也可在 Actions 页面手动
运行 `Deploy production`。流水线依次：

1. 运行 `npm ci`。
2. 运行 `npm run typecheck && npm test && npm run build`。
3. 推送 `sha-<full commit sha>` 与 `latest` 镜像。
4. 同步 Compose 文件到 `DEPLOY_PATH`。
5. 拉取 SHA 镜像、重启 `web`、检查 `/healthz`。

## 部署后检查

```bash
cd /opt/believeboy-guitar
docker compose ps
docker compose logs --tail=100 web
curl -fsS http://127.0.0.1:8080/healthz
curl -fsSI https://guitar.believeboy.com/
```

浏览器确认首页、`/practice`、`/library`、`/metronome` 和 PWA 资源正常。

## 回滚

在 Actions 历史中找到上一个成功版本的 commit SHA，在 VPS 上执行：

```bash
cd /opt/believeboy-guitar
IMAGE_TAG=sha-<previous-full-commit-sha> docker compose pull web
IMAGE_TAG=sha-<previous-full-commit-sha> docker compose up -d --no-build web
curl -fsS http://127.0.0.1:8080/healthz
```

不要删除旧 SHA 镜像标签；回滚依赖它们仍存在于 GHCR。

## 排障

- `denied` 或 `manifest unknown`：在 VPS 重新登录 GHCR，确认 token 有 `read:packages`，并确认镜像名小写。
- `permission denied` 访问 Docker：确认部署账号在 `docker` 组，并重新登录使其生效。
- `Host key verification failed`：重新核对主机指纹并更新 `SSH_KNOWN_HOSTS`。
- 健康检查失败：执行 `docker compose logs --tail=200 web` 和 `docker inspect believeboy-guitar`。
- 证书失败：确认 DNS 已生效、`80`/`443` 可达，并查看 `journalctl -u caddy`。
```

- [x] **Step 2: 更新项目规则**

在 `CLAUDE.md` 的“刻意不做”末尾，把禁止任何 CI 的段落替换为：

```markdown
**GitHub Actions 只用于生产部署，不做 PR 常规 CI。**
生产发布流水线固定在 `.github/workflows/deploy.yml`：在 runner 上完成
`npm run typecheck && npm test && npm run build`，推送 GHCR，再由 VPS 拉取运行镜像。
这是部署要求，不改变“个人自用、验证以本地为主”的原则；不要扩展成 pull request CI。
```

在 `DEVELOPMENT.md` 的本地验证章节，把“没有 `.github/`，没有 GitHub Actions，不做 CI”
替换为：

```markdown
**GitHub Actions 只用于生产部署。** `.github/workflows/deploy.yml` 在 `main`
上执行现有门禁并部署 GHCR 镜像；它不承担 pull request 常规 CI。合并前仍以本地
手工跑绿为准，不添加面向 pull request 的常规 CI。
```

同时更新交付自检中“仓库里没有 `.github/workflows/`”一项为：

```markdown
- [ ] 部署配置改动已检查 `.github/workflows/deploy.yml`，没有把 PR 常规 CI 混入生产流水线
```

在 `README.md` 的开发流程链接旁增加部署手册链接：

```markdown
生产部署、Caddy 与 GHCR 配置见 [docs/deployment.md](./docs/deployment.md)。
```

- [x] **Step 3: 运行文档与部署测试**

Run: `npx vitest run tests/deployment.test.ts tests/development-docs.test.ts`

Expected: 全部通过。

- [x] **Step 4: 运行完整门禁**

Run: `npm run typecheck && npm test && npm run build`

Expected: 所有命令退出码 `0`，静态导出生成 `out/`。

- [x] **Step 5: 本地检查运行镜像**

Run: `docker build -t believeboy-guitar:local .`

Expected: 构建成功，日志只安装 Nginx 运行时并复制静态文件。

Run: `docker run --rm -d --name believeboy-guitar-local -p 127.0.0.1:18080:80 believeboy-guitar:local`

Expected: 容器启动；随后访问 `http://127.0.0.1:18080/healthz` 返回 `ok`。

Run: `docker rm -f believeboy-guitar-local`

Expected: 测试容器被清理。

- [ ] **Step 6: 提交文档与规则**

```bash
git add docs/deployment.md CLAUDE.md DEVELOPMENT.md README.md tests/development-docs.test.ts
git commit --author="DamonRock <jr.way123@gmail.com>" -m "docs(deploy): 补充 VPS GHCR 发布与回滚手册"
```

## 验证与交付

- 本地完整门禁通过后，检查 `git diff main...HEAD` 只包含部署相关文件。
- 将分支推送到 GitHub 并创建 PR；合并到 `main` 后才触发生产发布。
- 首次发布前需要用户在 GitHub、DNS、Caddy 和 VPS 上完成文档中的一次性配置。
- 首次真实发布成功后，再验证 HTTPS、PWA、容器健康检查和一次 SHA 回滚。
