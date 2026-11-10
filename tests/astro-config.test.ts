import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const configPath = root + "/astro.config.mjs";
const packageJson = JSON.parse(readFileSync(root + "/package.json", "utf8"));

describe("Astro static build configuration", () => {
  it("declares static file routes and React integration", () => {
    expect(existsSync(configPath)).toBe(true);
    if (!existsSync(configPath)) return;

    const config = readFileSync(configPath, "utf8");
    expect(config).toContain('output: "static"');
    expect(config).toContain('srcDir: "./astro"');
    expect(config).toContain('format: "file"');
    expect(config).toContain('trailingSlash: "never"');
    expect(config).toContain("@astrojs/react");
  });

  it("provides separate Astro dev, build, and check commands", () => {
    expect(packageJson.scripts["astro:dev"]).toBe("astro dev");
    expect(packageJson.scripts["astro:build"]).toBe("astro build");
    expect(packageJson.scripts["astro:check"]).toBe("astro check");
  });
});
