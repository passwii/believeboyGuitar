# DEVELOPMENT.md — 开发工作流

> **重要：每次启动先把本地代码更新到最新。**
>
> 新建会话、接新任务、回到旧任务，第一步都是同步到最新的 `origin/main`。为了执行这一步，可以先读本文件本节；之后先运行 `git fetch origin --prune` 和 `git status --short`。有未提交改动时用 `git stash push -u` 保存，不要用 `git reset --hard` 硬覆盖。然后在 `main` 上运行 `git pull --ff-only origin main`，在功能分支上运行 `git rebase origin/main`。如果刚才执行过 stash，同步成功后再用 `git stash pop` 恢复这次暂存的改动并处理冲突；确认分支已包含最新 `origin/main` 后，再读其他项目文档、改代码、跑测试。拉取或 rebase 失败（网络、认证、冲突）先解决，再继续。

本文件是本仓库**开发流程与交付规则的入口**。内容与工程约束以 `CLAUDE.md` 为准，
视觉与交互契约以 `DESIGN.md` 为准；本文只讲开发流程，不重复定义内容规则。

- 内容与工程约束：[CLAUDE.md](./CLAUDE.md) ← **改代码前先读**
- 视觉与交互契约：[DESIGN.md](./DESIGN.md)（令牌、字号阶梯、触摸目标、组件表达）
- 背景与目录说明：[README.md](./README.md)
- 设计与实现方案：[docs/superpowers/](./docs/superpowers/)

仓库现实：纯前端 Next.js 静态导出，无后端、无数据库、无账号。唯一的部署产物是 `out/` 目录里的静态文件。

## 0. 规则优先级

1. **`CLAUDE.md`** —— 硬性约束、内容约定、刻意不做的范围。冲突时以它为准。
2. **本文件** —— 开发流程、Git 与提交规范、验证方式、交付自检。
3. `DESIGN.md` / `README.md` —— 事实与设计来源。
4. 文档没写到的，先问清楚再动手，不凭记忆行事。

## 1. 仓库结构

| 路径 | 内容 |
| --- | --- |
| `content/manifest.ts` | **唯一事实来源**：全部资料的元数据与主页目标 |
| `content/lessons/*.html` | 每篇正文，只写语义标签，不带样式与脚本 |
| `content/content.css` | 内容区排版样式（正文样式的唯一出口） |
| `content/widgets.ts` | 正文可嵌入的交互组件名清单 |
| `app/` | 页面外壳：首页、练习、资料库、节拍器 |
| `components/` | 导航、TAB、指板音阶、节拍器等组件 |
| `lib/` | 纯函数：周练目录、音位、TAB、节拍与内容一致性校验 |
| `tests/` | vitest 用例，含一批**文档守护测试**（令牌、清单、正文约定、模块边界） |
| `docs/superpowers/` | 设计与实现文档：`plans/` 实施方案、`specs/` 设计规格 |
| `scripts/` | 少量脚本（当前只有 `generate-icons.mjs`） |
| `inbox/`、`archive/`、`research/` | 原始资料与调研素材，**永不纳入版本库** |

## 2. 常用命令

```bash
npm ci                 # 首次或依赖变动后，按 package-lock.json 安装
npm run dev            # 默认端口 3000；对外分享预览见 §7
npm run typecheck      # tsc --noEmit
npm test               # vitest run，含清单/正文一致性校验
npm run build          # 静态导出到 out/
npm run lint           # eslint
```

> npm 缓存权限报错时，可临时指定仓库内缓存：
> `npm ci --cache ./.npm-cache`；安装成功后删除 `.npm-cache/`，不要提交。

## 3. 本地验证（**本仓库没有 CI**）

**没有 `.github/`，没有 GitHub Actions，不做 CI。** 这是个人自用仓库的刻意选择，
不要主动添加 `.github/workflows/` 或任何其他 CI 配置，也不要因为「缺少自动化守护」而建议加上。

合并门禁 = **本地手工跑绿**：

```bash
npm run typecheck && npm test && npm run build
```

- `npm test` 不只是单测：它检查 `content/manifest.ts` 与 `content/lessons/*.html` 是否一一对应、
  正文是否符合「只写语义标签」的约定、widget 名字是否登记、令牌有没有死掉。
  **改了 `content/` 下任何文件都必须跑一遍。**
- `npm run build` 会实际执行 Next.js 静态导出，验证预渲染与路由构建；它和 `npm run typecheck` 检查的范围不同。
- 改设计令牌或页面结构时，额外跑 `npm run lint`。
- 涉及指法、音阶图、和弦图的改动要**打开实际页面截图确认**，不能只看测试绿。

本地验证通过后，仍需完成页面检查与人工核对：见 §5、§6。

## 4. Git 与提交规范

- **本次及后续改动的分支约定**：新任务开 `agent/<agent>/<issue-key>`（如 `agent/seth/blf-1452`）；纯文档改动可用
  `docs/<slug>`。按本约定走 PR 合入，不直接 push `main`。这是今后采用的协作规则；历史上存在直接提交到 `main` 的提交。
- **提交信息**：中文 Conventional Commits，一件事一条：

  ```text
  feat(web): 站点重设计落地——B+C 混搭、工具间 /tools 与学习目标第一屏 (#13)
  fix(tab): 符杠贴着音符，符干连到品位数字 (#9)
  docs(agents): 新增开发工作流规则，明确每次启动先同步代码
  ```

- 关联 issue 写 `BLF-xxxx`（正文或 PR 描述均可）；GitHub squash merge 后的主线提交会带 `(#N)`。
- **今后的新提交统一使用 canonical commit author**：`DamonRock <jr.way123@gmail.com>`。历史提交中也有其他 author；本机 `git config` 可能仍是 `damon`，提交时按这条新约定显式指定 author。
- 合入用 **squash merge**，合并后删除分支。
- 一个 PR 只做一件事；不夹带无关格式化、重排、依赖升级。
- 不入库：`.env*`、`node_modules/`、`.next/`、`out/`、`inbox/`、`archive/`、`research/`。

## 5. 高风险区提醒（完整约束以 `CLAUDE.md` 为准）

- 修改周练、资料入口或主页数据时，先更新 `content/manifest.ts`；不要在别处硬编码目录。
- 新增正文或交互 widget 时，遵守 `CLAUDE.md` 的语义标签、widget 登记和人工确认流程。
- 音位由调弦与乐理推导；指法、音阶图、和弦图等易错内容必须由使用者核对。
- 不主动添加 `CLAUDE.md`「刻意不做」中列出的功能或 CI 配置。

## 6. 交付前自检

- [ ] 开工前已把本地代码同步到最新 `origin/main`（顶部提醒）
- [ ] 按 §3 跑了 `npm run typecheck && npm test && npm run build`，在回复里给出**命令 + 真实数字**
- [ ] 改了 `content/` 的，`npm test` 确实跑过（清单与正文必须一一对应）
- [ ] 新增的测试文件真的被执行了（出现在 vitest 输出里），没有 `.only`、跳过用例、恒真断言
- [ ] 没有调试残留：`console.log`、`debugger`、临时 TODO
- [ ] 视觉改动已打开实际页面看过，不只靠测试绿
- [ ] commit 信息与分支符合 §4，作者是 `DamonRock <jr.way123@gmail.com>`
- [ ] 仓库里没有 `.github/workflows/`（本仓库不做 CI）
- [ ] 发给用户的本机链接是 Tailscale 地址而不是 `localhost`，且已自己打开验证（§7）

## 7. 本机预览与链接发布（Tailscale）

当任务需要向用户分享**本机运行内容**的链接（预览页、截图页、`npm run dev` 的页面）时，
一律给 Tailscale 链接，**永远不给 `localhost` / `127.0.0.1`**：用户在多台电脑和手机上工作，
链接必须在其 tailnet 内可达。只有任务需要对外分享本机预览时才发布服务。

- 用 `tailscale serve` 把本地服务发布到 tailnet（例：`tailscale serve --bg 3000`）；
  `tailscale serve status` 查看已发布地址。首次使用需先在 tailnet 启用 Serve
  （未启用时命令只提示去 login.tailscale.com/f/serve 启用，不会写入任何配置）。
- 发布前**先跑 `tailscale serve status`**：Serve 是「establish or replace」语义，
  同一 Serve 监听端口和路径会被直接覆盖。`--https` 指 Tailscale 监听端口，命令最后的数字是本机服务端口。
  根路径已经被别的预览占着时，使用专属路径或另一个未占用的 Serve 监听端口。以下是可直接执行的例子：
  专属路径 `/guitar-preview` 转到本机 `3000` 端口：
  `tailscale serve --bg --https=443 --set-path=/guitar-preview 3000`；若 `443` 监听端口已被占用，
  可改用 `tailscale serve --bg --https=8443 3000`。不要只换最后的本机服务端口来规避同一 endpoint 冲突；只覆盖 / 收回自己发布的那一项。
- 收回时**只收回自己发布的那一项**：先跑 `tailscale serve status`，再对原 endpoint 加 `off`。例如，
  若用 `tailscale serve --bg --https=443 --set-path=/my-preview 3000` 发布，
  就用 `tailscale serve --bg --https=443 --set-path=/my-preview off` 收回该路径。
  具体语法见 [Tailscale Serve CLI 文档](https://tailscale.com/docs/reference/tailscale-cli/serve#disable-tailscale-serve)。
  **不要用 `tailscale serve reset`**——它清空的是整台机器当前的 Serve 配置，
  会把本机其他预览一起下线；只有 `tailscale serve status` 确认本机没有其他配置时才可 reset。
- 发布后**自己先打开该链接**，确认可访问、页面正常，再把链接发给用户；
  打不开就先修好或说明原因，不发未验证的链接。
- 给完整地址（`https://<machine>.<tailnet>.ts.net/...`），不要只给端口或相对路径。
