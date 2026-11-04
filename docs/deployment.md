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

把生成的 `.pub` 内容加入 VPS 部署账号的 `~/.ssh/authorized_keys`。私钥内容保存到
GitHub Secret `SSH_PRIVATE_KEY`。

生成 `SSH_KNOWN_HOSTS`：

```bash
ssh-keyscan -H guitar.believeboy.com
```

使用非默认 SSH 端口时加上 `-p <port>`。核对 VPS 主机密钥指纹后，把完整输出保存到
GitHub Secret `SSH_KNOWN_HOSTS`。

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
