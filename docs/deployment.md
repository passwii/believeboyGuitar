# VPS + GHCR 部署

生产域名：`guitar.believeboy.com`

日常构建、发布、检查和回滚的详细操作见
[deployment-runbook.md](./deployment-runbook.md)。

## 架构

本地部署是主路径，GitHub Actions 是手动备用路径。两条路径都生成同一个极简
Nginx 镜像，并调用同一份远程部署脚本。

```text
本地 Mac（主路径）
  git main → typecheck → test → static build
  → docker buildx --push
  ↓
GHCR: ghcr.io/passwii/believeboyguitar:sha-<commit>
  ↓ SSH
VPS: docker compose pull → restart → /healthz
  ↓
Caddy: guitar.believeboy.com → 127.0.0.1:8080

GitHub Actions（备用路径）
  workflow_dispatch → 相同校验与镜像 → 相同远程部署脚本
```

VPS 不 clone Git 仓库，不安装 Node.js，也不执行 `npm`、`next build` 或源码构建。
VPS 只保存 Compose 文件、Caddy 配置、GHCR 只读凭据和 Docker 镜像。

## VPS 前提

- Docker Engine 与 Docker Compose v2。
- 已安装并运行 Caddy。
- 部署账号能执行 `docker compose`，推荐加入 `docker` 用户组。
- `curl` 可供健康检查使用。
- `80`、`443` 对公网开放；应用端口 `8080` 只监听回环地址。
- VPS 架构为 `x86_64` 或 `arm64`；本地脚本会通过 `uname -m` 自动选择镜像平台。

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

Caddy 自动申请和续期证书；应用容器不处理 TLS。

## 首次准备 VPS

```bash
sudo install -d -o "$USER" -g "$USER" -m 755 /opt/believeboy-guitar
```

镜像保持私有时，在 VPS 创建只具备 `read:packages` 的 GitHub token，并登录：

```bash
read -rsp "GHCR read token: " GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u passwii --password-stdin
unset GHCR_TOKEN
```

凭据由 Docker 保存。不要把 token 写入 Compose、仓库或 shell 历史。

## 首次准备本地 Mac

### 1. 配置 SSH 别名

在 `~/.ssh/config` 增加或确认已有目标，例如：

```sshconfig
Host guitar-vps
  HostName <VPS 地址>
  User <部署账号>
  Port 22
  IdentityFile ~/.ssh/<部署私钥>
  IdentitiesOnly yes
```

验证：

```bash
ssh guitar-vps true
```

### 2. 登录 GHCR 写入权限

本地需要能推送镜像的 GitHub token，授予 `read:packages` 和 `write:packages`：

```bash
read -rsp "GHCR write token: " GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u passwii --password-stdin
unset GHCR_TOKEN
```

### 3. 创建本地部署配置

```bash
mkdir -p ~/.config/believeboy-guitar
cp deploy/local.env.example ~/.config/believeboy-guitar/deploy.env
chmod 600 ~/.config/believeboy-guitar/deploy.env
$EDITOR ~/.config/believeboy-guitar/deploy.env
```

默认配置：

```dotenv
DEPLOY_HOST=guitar-vps
DEPLOY_PATH=/opt/believeboy-guitar
APP_PORT=8080
```

`DEPLOY_HOST` 必须是 SSH 别名。需要覆盖 VPS 架构检测时，再设置
`DEPLOY_PLATFORM=linux/amd64` 或 `linux/arm64`。

## 日常发布

先把代码合入 `main` 并同步本地：

```bash
git switch main
git pull --ff-only origin main
```

然后执行：

```bash
npm run deploy:local
```

脚本按以下顺序执行：

1. 拒绝带未提交 tracked 改动的发布。
2. 拉取 `origin/main`，要求当前 HEAD 必须精确等于最新 `origin/main`。
3. 必要时执行 `npm ci`。
4. 执行 `npm run typecheck && npm test`。
5. 执行 `npm run build -- --webpack`，静态导出到 `out/`。
6. 执行 `npm run verify:css`，拒绝发布未编译的 Tailwind CSS。
7. 根据 VPS 架构执行 `docker buildx build --platform ... --push`。
8. 推送 `sha-<full commit sha>` 和 `latest` 标签到 GHCR。
9. 通过 `scp` 同步 `deploy/docker-compose.yml`，不拉取整个仓库。
10. 通过 SSH 执行 `scripts/deploy-remote.sh`：拉取、重启、健康检查。
11. 健康检查失败且存在上一 SHA 镜像时，自动尝试回滚。

本地产生未跟踪文件时脚本会警告，但不会阻止发布；未跟踪文件不属于当前 commit。

## GitHub Actions 备用发布

`.github/workflows/deploy.yml` 不再随 `main` push 自动运行，只能在 Actions 页面
手动运行 `Deploy production`，且只能从 `main` 触发。

仓库或 `production` Environment 配置：

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

生成 `SSH_KNOWN_HOSTS`：

```bash
ssh-keyscan -H guitar.believeboy.com
```

使用非默认 SSH 端口时加上 `-p <port>`。核对 VPS 主机密钥指纹后，把完整输出保存
到对应的 GitHub Secret。

首次使用 Actions 推送私有 GHCR 包前，还必须打开：

```text
https://github.com/users/passwii/packages/container/believeboyguitar/settings
```

在 **Manage Actions access** 中添加 `passwii/believeboyGuitar`，并把角色设为
**Write**。默认的 **Read** 只能拉取镜像，不能推送。若推送时报
`denied: permission_denied: read_package`，优先检查这里，而不是改用个人 PAT。

## 部署后检查

```bash
cd /opt/believeboy-guitar
docker compose ps
docker compose logs --tail=100 web
curl -fsS http://127.0.0.1:8080/healthz
curl -fsSI https://guitar.believeboy.com/
```

浏览器确认首页、`/practice`、`/library`、`/metronome` 和 PWA 资源正常。

## 手动回滚

自动回滚只在上一容器使用 `sha-*` 标签时生效。手动回滚命令：

```bash
cd /opt/believeboy-guitar
IMAGE_TAG=sha-<previous-full-commit-sha> docker compose pull web
IMAGE_TAG=sha-<previous-full-commit-sha> docker compose up -d --no-build web
curl -fsS http://127.0.0.1:8080/healthz
```

不要删除旧 SHA 镜像标签；回滚依赖它们仍存在于 GHCR。

## 排障

- 本地脚本拒绝发布：检查 tracked 改动、当前分支和 `origin/main` 是否一致。
- `denied` 或 `manifest unknown`：确认本地有 GHCR 写权限，VPS 有 `read:packages`，镜像名小写；Actions 推送还要确认 GHCR 包的 **Manage Actions access** 已把当前仓库设为 **Write**。
- `permission denied` 访问 Docker：确认部署账号在 `docker` 组，并重新登录使其生效。
- `Host key verification failed`：核对主机指纹并更新本地 SSH 配置；Actions 则更新 `SSH_KNOWN_HOSTS`。
- 健康检查失败：执行 `docker compose logs --tail=200 web` 和 `docker inspect believeboy-guitar`。
- 证书失败：确认 DNS 已生效、`80`/`443` 可达，并查看 `journalctl -u caddy`。
- 本地构建遇到 Turbopack `Operation not permitted`：部署脚本已固定使用 `next build --webpack`，与 Actions 备用构建保持一致。
- 页面只有文字没有样式：运行 `npm run verify:css`；确认 `postcss.config.mjs` 使用 `@tailwindcss/postcss`，且不要只通过 `turbopack.rules` 编译 Tailwind。
