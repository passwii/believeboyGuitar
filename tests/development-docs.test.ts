import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 开发流程文档的守护测试。
 *
 * 背景：本仓库把「每次启动先同步代码」这类协作规则放在 DEVELOPMENT.md，
 * 由 AGENTS.md 指过去。文档最大的风险不是写错，而是某次重构顺手把它删了，
 * 或者 AGENTS.md 的指针断掉——两者都会让新会话在落后的基线上开工。
 *
 * 这组测试把「规则还在」和「指针还通」固化下来。
 */

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("DEVELOPMENT.md 存在且是开发流程入口", () => {
  it("文件存在", () => {
    expect(existsSync(path.join(root, "DEVELOPMENT.md"))).toBe(true);
  });

  it("开工提醒列出 main 与功能分支各自的同步命令", () => {
    const doc = read("DEVELOPMENT.md");
    expect(doc).toContain("每次启动先把本地代码更新到最新");
    expect(doc).toContain("git fetch origin --prune");
    expect(doc).toContain("git pull --ff-only origin main");
    expect(doc).toContain("git rebase origin/main");
  });

  it("写明冲突处理与不要硬覆盖", () => {
    const doc = read("DEVELOPMENT.md");
    expect(doc).toContain("git stash push -u");
    expect(doc).toContain("git stash pop");
    expect(doc).toContain("如果刚才执行过 stash");
    expect(doc).toMatch(/不要用[^\n]*`git reset --hard`[^\n]*硬覆盖/);
  });
});

describe("DEVELOPMENT.md 覆盖本仓库的关键开发约定", () => {
  const doc = read("DEVELOPMENT.md");

  it("明确 GitHub Actions 只用于生产部署，不添加 PR 常规 CI", () => {
    expect(doc).toContain("GitHub Actions 只用于生产部署");
    expect(doc).toContain(".github/workflows/deploy.yml");
    expect(doc).toContain("不添加面向 pull request 的常规 CI");
  });

  it("本地 npm 缓存目录不会被误提交", () => {
    expect(read(".gitignore")).toContain("/.npm-cache/");
  });

  it("写明本地验证命令", () => {
    expect(doc).toContain("npm run typecheck && npm test && npm run build");
  });

  it("写明唯一事实来源与正文约定", () => {
    expect(doc).toContain("content/manifest.ts");
    expect(doc).toContain("content/lessons/*.html");
    expect(doc).toContain("widget 登记");
    expect(doc).toContain("CLAUDE.md");
  });

  it("写明提交作者与分支约定", () => {
    expect(doc).toContain("今后的新提交统一使用 canonical commit author");
    expect(doc).toContain("DamonRock <jr.way123@gmail.com>");
    expect(doc).toContain("这是今后采用的协作规则；历史上存在直接提交到 `main`");
    expect(doc).toContain("agent/<agent>/<issue-key>");
  });

  it("仅分享预览时才发布 Tailscale，并给出可复制的 endpoint 命令", () => {
    expect(doc).toContain("只有任务需要对外分享本机预览时才发布服务");
    expect(doc).toContain("tailscale serve");
    expect(doc).toContain("ts.net");
    expect(doc).toContain("tailscale serve --bg --https=443 --set-path=/my-preview off");
    expect(doc).toContain("tailscale serve --bg --https=443 --set-path=/guitar-preview 3000");
    expect(doc).toContain("tailscale serve --bg --https=8443 3000");
    expect(doc).toContain("不要只换最后的本机服务端口");
    expect(doc).toContain("tailscale serve reset");
    expect(doc).toMatch(/不要用[^\n]*`tailscale serve reset`/);
  });
});

describe("AGENTS.md 指向 DEVELOPMENT.md", () => {
  it("AGENTS.md 和 README.md 都指向这份开发流程文档", () => {
    expect(read("AGENTS.md")).toContain("[DEVELOPMENT.md](./DEVELOPMENT.md)");
    expect(read("README.md")).toContain("[DEVELOPMENT.md](./DEVELOPMENT.md)");
  });

  it("AGENTS.md 与 README.md 的 Markdown 链接指向真实文件", () => {
    for (const file of ["AGENTS.md", "README.md"]) {
      const source = read(file);
      const match = source.match(/\[DEVELOPMENT\.md\]\(\.\/DEVELOPMENT\.md\)/);
      expect(match, `${file} 里没有可解析的 DEVELOPMENT.md 链接`).not.toBeNull();
      expect(existsSync(path.join(root, "DEVELOPMENT.md"))).toBe(true);
    }
  });

  it("AGENTS.md 不再包含 Next.js 托管块", () => {
    const agents = read("AGENTS.md");
    expect(agents).not.toContain("nextjs-agent-rules");
    expect(agents).not.toContain("node_modules/next/dist/docs/");
    expect(agents).toContain("每次启动先把本地代码更新到最新");
    expect(agents).toContain("[DEVELOPMENT.md](./DEVELOPMENT.md)");
  });

  it("文档描述的是 Astro 静态构建而不是 Next.js 导出", () => {
    for (const file of ["README.md", "CLAUDE.md", "DEVELOPMENT.md"]) {
      const doc = read(file);
      expect(doc, `${file} 仍在描述 Next.js`).not.toContain("Next.js App Router");
      expect(doc, `${file} 仍在引用 app/globals.css`).not.toContain("app/globals.css");
    }
    expect(read("README.md")).toContain("Astro 6 静态站点");
    expect(read("DEVELOPMENT.md")).toContain("dist/");
    expect(read("CLAUDE.md")).toContain('srcDir: "./astro"');
    expect(existsSync(path.join(root, "docs/cloudflare-pages.md"))).toBe(true);
  });
});
