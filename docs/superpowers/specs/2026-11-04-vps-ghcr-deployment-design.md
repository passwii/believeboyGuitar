# VPS + GHCR 自动部署设计规格

日期：2026-11-04

状态：用户已批准

范围：GitHub Actions 构建静态站点并发布到 GHCR，VPS 拉取镜像后由现有 Caddy 对外提供
`guitar.believeboy.com`

## 1. 目标

把当前纯静态 Next.js 站点从“每次登录 VPS 手工构建”改为由 GitHub Actions 完成校验和构建，
VPS 只拉取已经构建好的容器镜像并重启服务。

成功标准：

- 推送 `main` 或手动触发工作流后，GitHub Actions 完成类型检查、测试和静态构建。
- Actions 只把 `out/`、Nginx 配置和运行时依赖打进 GHCR 镜像，镜像内没有 Node.js、源码或 `node_modules`。
- VPS 不执行 `npm`、`next build`，只执行镜像拉取、容器替换和健康检查。
- 现有 Caddy 负责 `guitar.believeboy.com` 的域名和 HTTPS，应用容器只监听 VPS 回环地址。
- 每次发布都有不可变的 commit SHA 镜像标签，可按标签回滚。
- 首次部署、日常发布、DNS、Caddy、GitHub Secrets、GHCR 凭据和排障步骤有文档可循。

## 2. 范围

### 做

- 新增 GitHub Actions 生产部署流水线。
- 新增基于 Nginx 的极简静态运行镜像。
- 新增 VPS 使用的 Docker Compose 配置。
- 新增 Nginx 静态路由、缓存、压缩和健康检查配置。
- 新增 `docs/deployment.md` 运维文档。
- 更新开发文档中“禁止任何 GitHub Actions”的旧规则。
- 增加部署配置守护测试。

### 不做

- 不在 VPS 上编译 Next.js、小程序共享包或任何 npm 依赖。
- 不引入数据库、后端服务、账号、监控平台或日志聚合。
- 不只为了部署再增加一套反向代理；域名和 TLS 继续由现有 Caddy 管理。
- 不添加面向 pull request 的常规 CI 检查；流水线只负责主分支发布和手动发布。
- 不实现蓝绿发布、Kubernetes 或自动扩容。个人站点接受容器替换期间约数秒的短暂中断。
- 不把域名、SSH 密码、GHCR 令牌或 VPS 配置写入镜像和仓库。

## 3. 架构

```text
push main / workflow_dispatch
  ↓
GitHub Actions
  npm ci
  npm run typecheck
  npm test
  npm run build
  docker build（只复制 out/）
  docker push
  ↓
GHCR
  ghcr.io/passwii/believeboyguitar:sha-<commit>
  ghcr.io/passwii/believeboyguitar:latest
  ↓ SSH
VPS
  docker compose pull web
  docker compose up -d --no-build web
  http://127.0.0.1:8080/healthz
  ↓
Caddy
  guitar.believeboy.com → reverse_proxy 127.0.0.1:8080
```

运行时镜像只包含 Nginx 和 `out/`。Caddy、Docker、SSH 密钥和 GHCR 登录信息都留在 VPS
主机侧，不进入应用镜像。

## 4. 仓库文件

| 路径 | 作用 |
| --- | --- |
| `.github/workflows/deploy.yml` | 校验、构建、推送 GHCR、SSH 部署和健康检查 |
| `Dockerfile` | 把 `out/` 复制进精简 Nginx 镜像 |
| `.dockerignore` | 避免源码、依赖、缓存和本地资料进入镜像构建上下文 |
| `deploy/nginx.conf` | 静态文件服务、路由回退、缓存和健康检查端点 |
| `deploy/docker-compose.yml` | VPS 上的单容器服务、回环端口、重启策略和日志轮转 |
| `docs/deployment.md` | 首次开通、日常发布、Caddy、DNS 和回滚手册 |
| `tests/deployment.test.ts` | 守护关键部署约束 |

`content/`、`app/` 和 `public/` 的内容规则不变，部署功能不得绕过 `content/manifest.ts`
或引入第二份站点目录。

## 5. Git 与发布触发

- 发布分支为 `main`。
- 工作流在 `push` 到 `main` 时自动运行，并保留 `workflow_dispatch` 手动入口。
- 工作流使用 `concurrency` 串行化生产发布，不取消正在进行的部署。
- Actions 使用 `GITHUB_TOKEN` 向 GHCR 推送；权限只包含 `contents: read` 和
  `packages: write`。
- 镜像标签包含：
  - `sha-<full commit sha>`：唯一、不可变，用于回滚；
  - `latest`：只由默认分支生成，方便人工检查当前版本。
- 部署时 Compose 明确使用 commit SHA 标签，不只依赖 `latest`。

## 6. GitHub Secrets

仓库或 `production` Environment 需要以下 Secrets：

| Secret | 内容 |
| --- | --- |
| `SSH_HOST` | VPS 地址 |
| `SSH_USER` | 部署账号 |
| `SSH_PRIVATE_KEY` | 仅用于该 VPS 的私钥 |
| `SSH_KNOWN_HOSTS` | VPS 的 SSH host key |
| `DEPLOY_PATH` | 例如 `/opt/believeboy-guitar` |

`SSH_PORT` 作为可选 Repository Variable 使用，默认 `22`。

工作流使用系统 `ssh`，不依赖第三方 SSH Action。部署账号需要能执行 Docker Compose，
建议通过 `docker` 用户组或受限 sudo 获得权限；不得给 Actions 配置 VPS root 密码。

## 7. GHCR 与 VPS 凭据

- GHCR 镜像默认保持私有。
- Actions 推送使用工作流内的 `GITHUB_TOKEN`，不需要额外 PAT。
- VPS 上保存一个仅具备 `read:packages` 权限的 GitHub token，并执行一次
  `docker login ghcr.io`。
- token 不写进 Compose、仓库、镜像或 shell 历史；文档只给出从安全输入读取的步骤。
- 镜像名固定为小写：`ghcr.io/passwii/believeboyguitar`。

## 8. 容器与 Nginx

运行镜像使用官方精简 Nginx 镜像，容器内监听 `80`。

Compose 约束：

- 只绑定 `127.0.0.1:${APP_PORT:-8080}:80`，不直接暴露公网端口。
- `restart: unless-stopped`。
- Docker 日志限制为固定大小，避免长期占满 VPS 磁盘。
- 镜像通过 `${IMAGE_TAG:-latest}` 选择，部署命令显式传入 commit SHA。
- 容器健康检查访问 `/healthz`。

Nginx 约束：

- `/healthz` 返回纯文本 `ok`，不写访问日志。
- `/_next/static/*` 使用一年 `immutable` 缓存。
- `/sw.js` 使用 `no-cache`，确保 PWA 能发现新的 Service Worker。
- HTML 和 `manifest.webmanifest` 不做长缓存。
- 页面路由按 `$uri`、`$uri/`、`$uri.html` 顺序查找，再回退到 Next.js 导出的
  `/404.html`。
- 开启 gzip，只压缩 HTML、CSS、JavaScript、JSON、SVG 和文本。
- 不手写 CSP；现有 Next.js 内联资源需要单独验证后再做。

## 9. 部署流程

1. Actions 在 runner 上执行 `npm ci`。
2. 执行完整本地门禁：`npm run typecheck && npm test && npm run build`。
3. 用生成的 `out/` 构建运行镜像。
4. 推送 SHA 标签和 `latest` 标签到 GHCR。
5. 通过 SSH 把最新 Compose 文件同步到 `DEPLOY_PATH`，然后在 VPS 上拉取 SHA 镜像。
6. 执行 `docker compose up -d --no-build web`。
7. 在 VPS 本机重复请求 `/healthz`，失败时工作流失败并保留完整日志。
8. 健康检查通过后，工作流输出站点地址和镜像标签。

发布期间 Caddy 不重启。容器替换可能出现数秒中断，符合本阶段范围。

## 10. Caddy 与 DNS

- 在 DNS 服务商添加 `guitar.believeboy.com` 指向 VPS 的 `A` 记录；有 IPv6 时再添加
  `AAAA`。
- VPS 防火墙和云安全组放行 `80`、`443`；应用端口 `8080` 只允许本机访问。
- Caddy 站点配置使用域名块并把请求代理到 `127.0.0.1:8080`。
- 修改 Caddyfile 后先运行 `caddy validate`，再用 systemd 重新加载 Caddy。
- Caddy 负责自动申请和续期证书；应用容器不处理 TLS。

## 11. 错误处理与回滚

- 校验或构建失败：不推送镜像、不连接 VPS，旧版本继续运行。
- GHCR 推送失败：不执行 SSH 部署。
- 镜像拉取失败：不替换当前容器。
- 容器启动或健康检查失败：工作流失败；文档保留当前和生产容器日志的排查命令。
- 回滚使用上一个 commit SHA：

  ```bash
  IMAGE_TAG=sha-<previous-commit> docker compose up -d --no-build web
  ```

- 镜像只追加、不依赖覆盖 `latest` 回滚，因此回滚目标仍可从 GHCR 拉取。

## 12. 验收

- `npm run typecheck && npm test && npm run build` 全部通过。
- 工作流 YAML 通过 GitHub 解析，并在主分支或手动触发下成功推送镜像。
- VPS 上运行的镜像不包含 Node.js、`node_modules` 或源码。
- `docker compose ps` 显示容器 healthy，端口仅绑定 `127.0.0.1:8080`。
- 从 VPS 本机访问 `/healthz` 返回 `ok`。
- `https://guitar.believeboy.com/` 正常展示站点，HTTPS 证书有效。
- 浏览器可加载 `_next/static` 资源、Service Worker 和 manifest。
- 使用上一 SHA 镜像能恢复旧版本。

## 13. 已知风险

- 首次部署依赖用户提供正确的 DNS、Caddy、SSH、GHCR 和 Docker 权限。
- VPS 架构必须与镜像架构匹配；默认按 GitHub runner 的 `linux/amd64` 构建，若 VPS 是
  ARM64，需要在首次部署前调整平台。
- 单容器替换不是零停机；若以后对可用性要求提高，再引入双容器和 Caddy 上游切换。
- 现有开发文档和守护测试明确禁止 CI，实施时必须同步修改，否则测试会失败。
