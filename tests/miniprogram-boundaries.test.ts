import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function importsReactOrNext(path: string): boolean {
  const sourceFile = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let found = false;

  function isFrameworkSpecifier(node: ts.Expression | undefined): boolean {
    return (
      node !== undefined &&
      ts.isStringLiteralLike(node) &&
      /^(react|next)(\/|$)/.test(node.text)
    );
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      isFrameworkSpecifier(node.moduleSpecifier)
    ) {
      found = true;
    }

    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      isFrameworkSpecifier(node.arguments[0])
    ) {
      found = true;
    }

    if (!found) ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

async function capturePageConfig(loadPage: () => Promise<unknown>): Promise<Record<string, any>> {
  vi.resetModules();
  let definition: Record<string, any> | undefined;
  vi.stubGlobal("Page", (page: Record<string, any>) => {
    definition = page;
  });
  vi.stubGlobal("wx", {});

  try {
    await loadPage();
    if (!definition) throw new Error("Page config was not registered");
    return definition;
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
}

describe("mini program boundaries", () => {
  it("keeps the wx identifier out of guitar-core", () => {
    for (const path of files("packages/guitar-core/src")) {
      expect(readFileSync(path, "utf8")).not.toMatch(/\bwx\b/);
    }
  });

  it("keeps static imports, require calls, and dynamic imports of React and Next out of the mini program", () => {
    for (const path of files("miniprogram")) {
      if (!/\.ts$/.test(path)) continue;
      expect(importsReactOrNext(path), path).toBe(false);
    }
  });

  it("stops the metronome when its page is hidden", async () => {
    const page = await capturePageConfig(() =>
      import("../miniprogram/pages/metronome/index"),
    );
    const stop = vi.fn();

    page.onHide.call({ stop });

    expect(stop).toHaveBeenCalledOnce();
  });

  it("stops tuner recording when its page is hidden", async () => {
    const page = await capturePageConfig(() => import("../miniprogram/pages/tuner/index"));
    const stopTuning = vi.fn();

    page.onHide.call({ stopTuning });

    expect(stopTuning).toHaveBeenCalledOnce();
  });
});
