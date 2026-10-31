import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { practiceWeeks } from "@/content/manifest";
import { runContentCheck } from "@/lib/content-check";

const lessonsDir = path.join(process.cwd(), "content", "lessons");

describe("内容库一致性", () => {
  it("清单、正文文件与内容约定三者一致", () => {
    const files = readdirSync(lessonsDir).filter((name) => name.endsWith(".html"));

    const issues = runContentCheck({
      weeks: practiceWeeks,
      files,
      readHtml: (slug) => readFileSync(path.join(lessonsDir, `${slug}.html`), "utf8"),
    });

    expect(issues).toEqual([]);
  });
});
