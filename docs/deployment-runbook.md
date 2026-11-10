# 构建与部署运行手册

最后更新：2026-11-05

生产地址：https://guitar.believeboy.com

本文记录当前已经实际验证通过的构建、GHCR 发布、VPS 部署、检查和回滚流程。
文档中不保存 Token、私钥或其他机密值。

## 1. 当前生产参数

| 项目 | 当前值 |
| --- | --- |
| 域名 | `guitar.believeboy.com` |
| DNS | Cloudflare，DNS only；A 记录指向 VPS |
| HTTPS | VPS 上的 Caddy 自动签发和续期 |
| GHCR 镜像 | `ghcr.io/passwii/believeboyguitar` |
| 镜像平台 | `linux/amd64` |
| 镜像标签 | `sha-<full commit sha>`、`latest` |
| 本地 SSH 别名 | `guitar-vps` |
| 本地部署配置 | `~/.config/believeboy-guitar/deploy.env` |
| Mac GHCR Token 名称 | `local-working-ghcr` |
| VPS GHCR Token 名称 | `remote-production-ghcr` |
| VPS 部署目录 | `/opt/believeboy-guitar` |
| Compose 文件 | `/opt/believeboy-guitar/docker-compose.yml` |
| 容器名 | `believeboy-guitar` |
| 容器端口 | `127.0.0.1:8080 -> 80` |
| Caddy 上游 | `reverse_proxy 127.0.0.1:8080` |

当前生产首次成功发布记录：

```text
提交:   60c43f0d89852c608607680dc81db7b176f44674
镜像:   ghcr.io/passwii/believeboyguitar:sha-60c43f0d89852c608607680dc81db7b176f44674
日期:   2026-11-05
```

## 2. 架构

```text
Mac（主发布路径）
  git main
  → typecheck + test
  → astro build（输出 dist/）
  → docker buildx build --platform linux/amd64
  → push GHCR
  → scp docker-compose.yml
  → SSH 执行远程部署脚本

GHCR
  → sha-<commit> 不可变版本标签
  → latest 最新版本便利标签

VPS
  → docker compose pull
  → docker compose up -d --no-build web
  → curl http://127.0.0.1:8080/healthz

Caddy
  → guitar.believeboy.com
  → 127.0.0.1:8080
```

职责边界：

- Mac 负责所有校验、静态构建和镜像构建。
- GHCR 保存不可变镜像，供 VPS 拉取和回滚。
- VPS 不 clone Git 仓库。
- VPS 不安装 Node.js，不执行 `npm` 或 `astro build`。
- Caddy 负责公网入口、域名和 TLS。
- GitHub Actions 只作为手动备用路径。

## 3. 相关文件

| 文件 | 作用 |
| --- | --- |
| `scripts/deploy-local.sh` | 本地主发布入口 |
| `scripts/deploy-remote.sh` | Mac 与 Actions 共用的 VPS 部署逻辑 |
| `scripts/verify-static-css.mjs` | 构建后检查 Tailwind 是否已编译 |
| `scripts/verify-astro-output.mjs` | 构建后检查路由、PWA 与 `/_astro` 产物是否齐全 |
| `Dockerfile` | 生成只包含 Nginx 和 `dist/` 的运行镜像 |
| `.dockerignore` | 防止源码、依赖和本地资料进入镜像 |
| `postcss.config.mjs` | Astro/Vite 的 Tailwind 编译入口 |
| `deploy/nginx.conf` | 静态文件、缓存、路由回退和健康检查 |
| `deploy/docker-compose.yml` | VPS 单容器运行配置 |
| `deploy/Caddyfile.example` | Caddy 站点块示例 |
| `deploy/local.env.example` | 本地部署配置模板 |
| `.github/workflows/deploy.yml` | 手动备用发布流水线 |
| `docs/deployment.md` | 首次配置和排障说明 |

## 4. 构建明细

### 4.1 发布门禁

`scripts/deploy-local.sh` 会依次执行：

```bash
npm run typecheck
npm test
npm run build
npm run verify:css
```

当前基线：

```text
测试文件: 43
测试用例: 460
静态页面: 11 个（含 /manifest.webmanifest）
```

`astro build` 是唯一构建入口，本地与 Actions 备用路径完全一致，不再有
webpack / Turbopack 双分支。

Tailwind v4 通过 `postcss.config.mjs` 和 `@tailwindcss/postcss` 编译，Astro
（Vite）与 PostCSS 共用同一条 CSS 管线；Vite 只负责打包，不接管 Tailwind 指令。

`npm run verify:css` 会检查：

- `dist/_astro/` 至少存在一份 CSS
- CSS 中不再残留 `@theme` 或 `@tailwind utilities`
- 关键布局和工具类，例如 `.shell`、`.home-hero`、`.text-ink-950` 已生成

### 4.2 静态导出

Astro 配置（`astro.config.mjs`）：

```js
output: "static"
srcDir: "./astro"
build: { format: "file" }
trailingSlash: "never"
```

构建完成后，静态文件位于：

```text
dist/
```

其中包含：

- 扁平页面 HTML（`index.html`、`practice.html`、`practice/<slug>.html`）
- `/_astro/*`（带内容哈希的 CSS / JS）
- `sw.js`、`_headers`
- `manifest.webmanifest`
- 图标和静态资源
- `404.html`

`scripts/verify-astro-output.mjs` 会在构建后核对上述产物，并检查
`dist/practice/*.html` 与 `content/lessons/*.html` 数量一致。

### 4.3 运行镜像

镜像只使用：

```text
nginx:1.29-alpine
```

最终镜像不包含：

- Node.js
- npm
- `node_modules`
- Astro 源码（`astro/`）
- Git 仓库
- SSH 凭据
- GHCR Token

当前镜像占用：

| 指标 | 大小 |
| --- | --- |
| GHCR 压缩传输 | 约 25.3 MiB |
| VPS 解压后镜像 | 约 62.0 MiB / 65 MB |
| 容器可写层 | 约 1.06 kB |
| 运行时内存 | 约 9.3 MiB |
| 空闲 CPU | 0% |

`latest` 和对应 SHA 标签通常指向相同摘要，不会重复保存两份完整镜像。

## 5. 日常发布

### 5.1 发布前确认

```bash
cd /Users/damon/DamonProjects/believeboyGuitar
git switch main
git pull --ff-only origin main
```

确认当前提交：

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

`HEAD` 必须与 `origin/main` 完全一致。脚本会主动拒绝以下情况：

- tracked 文件有未提交修改
- 当前提交不在 `origin/main`
- 当前提交落后于最新 `origin/main`

未跟踪文件只警告，不阻止发布，因为它们不属于当前发布 commit。

### 5.2 执行发布

```bash
npm run deploy:local
```

脚本实际执行：

1. 读取 `~/.config/believeboy-guitar/deploy.env`
2. 检查 Git 状态与 `origin/main`
3. 必要时执行 `npm ci`
4. 执行类型检查和测试
5. 执行 Astro 静态构建
6. 通过 SSH 检查 VPS 架构
7. 构建 `linux/amd64` 镜像
8. 推送 SHA 标签和 `latest` 到 GHCR
9. 把 Compose 文件复制到 VPS
10. 在 VPS 拉取新镜像并替换容器
11. 每两秒检查一次 `/healthz`，最多 15 次

成功输出示例：

```text
Deployment healthy after 2 attempt(s).
Deployed https://guitar.believeboy.com from sha-<commit>
```

### 5.3 本地只构建、不部署

需要先检查构建结果但不发布时：

```bash
npm run typecheck
npm test
npm run build
```

只构建 Docker 镜像、不推送：

```bash
docker build --platform linux/amd64 -t believeboy-guitar:local .
```

只构建并推送、不部署时，使用脚本中的 `docker buildx build` 命令，但删除后续
`scp` 和 `ssh` 步骤。不要手工覆盖 GHCR 上的 SHA 标签。

## 6. 部署后检查

### 6.1 HTTP 检查

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://guitar.believeboy.com/
curl -fsS https://guitar.believeboy.com/healthz
curl -fsS -o /dev/null -w '%{http_code}\n' https://guitar.believeboy.com/practice/week-1-finger-independence
curl -fsS -o /dev/null -w '%{http_code}\n' https://guitar.believeboy.com/library
curl -sS -o /dev/null -w '%{http_code}\n' https://guitar.believeboy.com/not-a-real-route
```

预期：

```text
首页             200
/healthz         ok
练习详情         200
资料库           200
未知路由         404
```

### 6.2 Service Worker 缓存头

```bash
curl -fsSI https://guitar.believeboy.com/sw.js | tr -d '\r' | grep -i -E '^(HTTP/|cache-control:|content-type:)'
```

必须包含：

```text
cache-control: no-cache, no-store, must-revalidate
```

### 6.3 VPS 容器状态

```bash
ssh guitar-vps '
  cd /opt/believeboy-guitar
  docker compose ps
  docker inspect believeboy-guitar \
    --format "image={{.Config.Image}} health={{.State.Health.Status}}"
  ss -ltnp | grep ":8080 "
'
```

预期：

- 容器状态为 `Up ... (healthy)`
- 镜像标签是本次 commit SHA
- 端口是 `127.0.0.1:8080`，不是 `0.0.0.0:8080`

## 7. 查看日志

### 7.1 容器日志

```bash
ssh guitar-vps 'cd /opt/believeboy-guitar && docker compose logs --tail=200 web'
```

持续查看：

```bash
ssh guitar-vps 'cd /opt/believeboy-guitar && docker compose logs -f web'
```

### 7.2 Caddy 日志

```bash
ssh guitar-vps 'journalctl -u caddy -n 200 --no-pager'
```

持续查看：

```bash
ssh guitar-vps 'journalctl -u caddy -f'
```

### 7.3 容器资源

```bash
ssh guitar-vps 'docker stats --no-stream believeboy-guitar'
```

## 8. 回滚

### 8.1 自动回滚

`deploy-remote.sh` 会记录替换前的容器镜像。如果新容器启动或健康检查失败，并且
旧容器使用的是 `sha-*` 标签，脚本会自动切回上一 SHA 镜像并再次检查健康端点。

自动回滚不覆盖以下情况：

- 首次部署时没有上一 SHA
- 旧容器使用的是 `latest` 而不是 SHA
- 镜像拉取阶段就失败，此时旧容器本来仍在运行

### 8.2 查看 VPS 上已有版本

```bash
ssh guitar-vps '
  docker image ls ghcr.io/passwii/believeboyguitar \
    --format "{{.Tag}} {{.CreatedAt}} {{.Size}}"
'
```

### 8.3 手动回滚

选择一个之前的 `sha-*` 标签：

```bash
ssh guitar-vps '
  cd /opt/believeboy-guitar
  IMAGE_TAG=sha-<previous-full-commit-sha> docker compose pull web
  IMAGE_TAG=sha-<previous-full-commit-sha> docker compose up -d --no-build web
  curl -fsS http://127.0.0.1:8080/healthz
'
```

不要删除正在用于回滚的 SHA 标签。

## 9. GitHub Actions 手动备用

工作流：

```text
.github/workflows/deploy.yml
```

触发方式：

```text
GitHub Actions → Deploy production → Run workflow → main
```

该工作流不会随 `main` push 自动运行。

前提是待发布提交已经进入 GitHub 上的 `main`。工作流看不到 Mac 上未提交或未推送
的内容；如果 Mac 不可用，先在 GitHub 网页合并已经推送的 Pull Request。

浏览器入口：

```text
https://github.com/passwii/believeboyGuitar/actions/workflows/deploy.yml
```

打开后选择 **Deploy production** → **Run workflow** → Branch 选择 `main` →
再次点击 **Run workflow**。工作流没有输入参数。

也可以在任意已登录 GitHub CLI 的机器上执行：

```bash
gh auth status
gh workflow run deploy.yml --ref main --repo passwii/believeboyGuitar
gh run list --workflow deploy.yml --repo passwii/believeboyGuitar --limit 3
gh run watch <run-id> --repo passwii/believeboyGuitar --exit-status
```

失败时查看失败日志：

```bash
gh run view <run-id> --repo passwii/believeboyGuitar --log-failed
```

需要在 GitHub 仓库或 `production` Environment 配置：

| Secret | 内容 |
| --- | --- |
| `SSH_HOST` | VPS 主机名或 IP |
| `SSH_USER` | VPS 登录用户 |
| `SSH_PRIVATE_KEY` | 可登录 VPS 的私钥全文 |
| `SSH_KNOWN_HOSTS` | 已核对的主机公钥 |
| `DEPLOY_PATH` | `/opt/believeboy-guitar` |

可选 Variables：

| Variable | 默认值 |
| --- | --- |
| `SSH_PORT` | `22` |
| `APP_PORT` | `8080` |
| `DOCKER_PLATFORM` | `linux/amd64` |

当前状态：Secrets 和 Variables 已配置，手动备用发布已验证通过。首次推送曾因
GHCR 包权限不足失败，按 9.1 授予仓库访问权限后，同一工作流已成功完成构建、
推送、VPS 部署和健康检查。

### 9.1 GHCR 包 Actions 写权限

私有 GHCR 包首次由本地 PAT 创建时，仓库的 `GITHUB_TOKEN` 不会自动获得写权限。
即使工作流已经声明 `packages: write`，Actions 仍可能在推送阶段报错：

```text
denied: permission_denied: read_package
```

在 GitHub 网页配置：

1. 打开 `https://github.com/users/passwii/packages/container/believeboyguitar/settings`
2. 在 **Manage Actions access** 中选择 **Add Repository**
3. 添加 `passwii/believeboyGuitar`
4. 把仓库角色从默认的 **Read** 改为 **Write**

当前还按用户要求授予了以下仓库对该包的 **Write** 权限：

- `passwii/believeboyDashboard`
- `passwii/digitalProjectManagement`

不要选择 **Admin**；镜像发布只需要 **Write**。配置完成后应看到所有目标仓库的
角色均为 **Write**，再重新运行失败的 `Deploy production` 工作流。

2026-11-05 验证记录：

```text
工作流: Deploy production
提交:   848ab031009ed822d54ea86b818efe7998904c27
结果:   success
部署镜像: ghcr.io/passwii/believeboyguitar:sha-848ab031009ed822d54ea86b818efe7998904c27
生产检查: 首页 200，/healthz ok，容器 running/healthy
```

## 10. 已知故障与处理

### 10.1 Docker Hub TLS 超时

报错：

```text
failed to fetch anonymous token
net/http: TLS handshake timeout
```

先手动拉取目标架构基础镜像：

```bash
docker pull --platform linux/amd64 nginx:1.29-alpine
```

拉取成功后重新执行：

```bash
npm run deploy:local
```

### 10.2 本地拒绝发布

如果提示 HEAD 不是最新 `origin/main`：

```bash
git switch main
git pull --ff-only origin main
```

如果提示 tracked 文件有修改：

```bash
git status --short
```

提交或暂存修改后重新发布。

### 10.3 GHCR 登录失败

Mac：

```bash
docker login ghcr.io -u passwii
```

VPS：

```bash
ssh -t guitar-vps 'docker login ghcr.io -u passwii'
```

Mac Token 需要 `write:packages`；VPS Token 只需要 `read:packages`。

### 10.4 GitHub Actions 推送 GHCR 被拒绝

报错：

```text
denied: permission_denied: read_package
```

这不是 SSH 或 VPS 问题，也不是 `GITHUB_TOKEN` 的 workflow 权限语法问题，而是
私有 GHCR 包没有把当前仓库加入 **Manage Actions access**。按 9.1 添加仓库并设为
**Write** 后，重新运行失败的工作流。

不要改用个人 PAT 绕过此配置，备用路径应继续使用仓库作用域的 `GITHUB_TOKEN`。

### 10.5 Caddy 返回 502

含义是 Caddy 正常，但 `127.0.0.1:8080` 没有可连接的应用。

检查：

```bash
ssh guitar-vps '
  cd /opt/believeboy-guitar
  docker compose ps
  docker compose logs --tail=200 web
'
```

### 10.6 页面路由错误

Nginx 的页面查找顺序必须是：

```text
$uri → $uri.html → $uri/
```

不能先匹配 `$uri/`：Astro 用 `build.format: "file"` 输出扁平 HTML，先匹配目录会把
`/practice/<slug>` 错误 301 到带斜杠的地址。

### 10.7 页面只有文字，没有样式

先检查构建产物：

```bash
npm run build
npm run verify:css
```

如果 CSS 文件返回 `200`，但内容中仍有 `@theme` 或 `@tailwind utilities`，说明
Tailwind 没有参与构建。确认项目根目录存在 `postcss.config.mjs`：

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

并且 `app/globals.css` 以 `@import "tailwindcss";` 开头。不要再使用仅在
Vite 内部插件配置作为唯一 Tailwind 处理方式。样式入口现在是
`astro/styles/global.css`，它由 `astro/layouts/BaseLayout.astro` 导入。

## 11. 安全与维护

- `local-working-ghcr` 只放在可信 Mac。
- `remote-production-ghcr` 只放在 VPS，权限仅 `read:packages`。
- Docker 凭据文件权限应为 `600`。
- 不把 Token 写入仓库、Compose、脚本或聊天记录。
- Token 建议 90 天轮换。
- VPS 当前 SSH 仍允许密码登录和 root 登录；首次部署稳定后，建议改为仅密钥登录。
- 定期检查旧镜像占用：

  ```bash
  ssh guitar-vps 'docker system df'
  ```

- 清理旧版本前确认保留至少一个可回滚 SHA 镜像。
