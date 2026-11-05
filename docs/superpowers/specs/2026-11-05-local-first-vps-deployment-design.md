# 本地主发布 + Actions 手动备用部署设计

日期：2026-11-05

状态：用户已批准

## 1. 目标

利用本地 Mac 的构建资源作为生产发布主路径，同时保留 GitHub Actions 作为异地手动
备用路径。两条路径必须产出同一种极简运行镜像，并复用同一套 VPS 部署与回滚逻辑。

## 2. 架构

```text
本地 Mac（主路径）
  main 最新提交
  → 校验工作区
  → typecheck + test + next build --webpack
  → docker buildx build --platform <VPS 架构> --push
  → GHCR: sha-<full commit sha> + latest
  → scp Compose 文件
  → SSH 执行共享远程脚本
  → pull + up + healthcheck

GitHub Actions（备用路径）
  workflow_dispatch
  → 相同校验和构建
  → 相同 GHCR 镜像
  → 相同远程脚本
```

VPS 不 clone Git 仓库，不安装 Node.js，不执行任何源码构建。VPS 只保存：

- `deploy/docker-compose.yml`
- Caddy 配置
- Docker 镜像与 GHCR 只读凭据

## 3. 职责边界

- `scripts/deploy-local.sh`：本地发布入口。负责 Git 状态检查、依赖检查、门禁、
  静态构建、VPS 架构检测、镜像推送、Compose 同步和调用远程脚本。
- `scripts/deploy-remote.sh`：VPS 上的共享部署逻辑。负责拉取、重启、健康检查和
  可用的 SHA 自动回滚。
- `.github/workflows/deploy.yml`：只保留 `workflow_dispatch`，负责备用构建、GHCR
  推送和调用同一远程脚本。
- `deploy/docker-compose.yml`：固定回环端口、日志轮转和健康检查。
- `deploy/nginx.conf`：静态文件、PWA 缓存、路由回退和 `/healthz`。
- `docs/deployment.md`：首次配置、日常发布、备用发布、排障和回滚手册。

## 4. 本地发布约束

- 只允许发布最新 `origin/main`，当前 HEAD 必须与它完全一致。
- 拒绝带未提交 tracked 改动的发布。
- 未跟踪文件不进入发布 commit，因此只警告、不阻断。
- `package-lock.json` 比现有依赖新或依赖缺失时执行 `npm ci`。
- 门禁固定为 `npm run typecheck && npm test`。
- 静态构建固定为 `npm run build -- --webpack`，避开当前 macOS 沙箱下 Turbopack
  绑定本地端口失败的问题，并与 Actions 保持一致。
- 镜像标签使用完整 commit SHA；`latest` 只作为查看便利，不用于回滚。

## 5. 本地配置

本地非敏感配置放在 `~/.config/believeboy-guitar/deploy.env`，权限 `0600`：

```dotenv
DEPLOY_HOST=guitar-vps
DEPLOY_PATH=/opt/believeboy-guitar
APP_PORT=8080
```

`DEPLOY_HOST` 是 SSH 别名，用户、端口和私钥继续由 `~/.ssh/config` 管理。GHCR
写权限由本机 `docker login ghcr.io` 保存；仓库内不保存 token。

## 6. 发布流程

1. 用户把改动合入 `main` 并同步本地。
2. 运行 `npm run deploy:local`。
3. 脚本 fetch `origin/main` 并确认 HEAD 精确相等。
4. 执行依赖、类型检查、测试和 webpack 静态构建。
5. 通过 SSH 获取 VPS `uname -m`，映射为 `linux/amd64` 或 `linux/arm64`。
6. 构建并推送镜像，然后仅同步 Compose 文件到 VPS。
7. 远程脚本保留上一 SHA 镜像信息，拉取新镜像并替换容器。
8. 每两秒检查一次 `/healthz`，最多十五次。
9. 健康检查失败时，若上一容器使用 SHA 标签，则自动回滚并再次检查。

## 7. Actions 备用流程

- 只允许在 Actions 页面手动运行，且 ref 必须是 `main`。
- 使用 `GITHUB_TOKEN` 推送 GHCR，不需要本地 PAT。
- 仍使用 SSH Secrets 连接 VPS。
- 与本地路径共用 `scripts/deploy-remote.sh`，避免两套健康检查和回滚逻辑漂移。

## 8. 失败处理

- 本地 Git 状态不合格：在构建前退出。
- 测试或构建失败：不推送镜像、不连接 VPS。
- 镜像推送失败：不执行远程部署。
- 拉取失败：旧容器保持运行。
- 容器启动或健康检查失败：收集状态和日志；存在上一 SHA 时自动回滚。
- 回滚失败：命令返回非零，保留日志供人工处理。

## 9. 验收

- VPS 不需要 Git 仓库、Node.js 或 `node_modules`。
- `npm run deploy:local` 可完成构建、GHCR 推送、部署和健康检查。
- 同一次提交在本地与 Actions 使用相同 SHA 标签规则和远程脚本。
- `main` push 不再自动触发生产部署。
- 本地脚本拒绝未合入最新 `origin/main` 的提交。
- 远程健康检查失败时能识别上一 SHA 并尝试回滚。
- 现有 441 个测试和生产静态构建继续通过。
