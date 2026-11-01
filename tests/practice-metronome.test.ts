import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = path.join(process.cwd(), "components", "PracticeMetronome.tsx");
const source = existsSync(componentPath) ? readFileSync(componentPath, "utf8") : "";

describe("练习页节拍器", () => {
  it("提供速度步进与开始/暂停控制", () => {
    expect(source).toContain('aria-label="速度减一拍"');
    expect(source).toContain('aria-label="速度加一拍"');
    expect(source).toContain('aria-label={running ? "暂停节拍器" : "开始节拍器"}');
    expect(source).toContain("useState(100)");
  });

  it("沿用节拍器音频调度，并支持空格键切换播放", () => {
    expect(source).toContain("createMetronomeAudio");
    expect(source).toContain('event.key !== " " && event.key !== "Spacebar"');
    expect(source).toContain('window.addEventListener("keydown", onKeyDown)');
    expect(source).toContain("audio.schedule(");
  });

  it("音频启动等待期间再次按空格会取消待启动状态", () => {
    expect(source).toContain("const startingRef = useRef(false)");
    expect(source).toContain("if (runningRef.current || startingRef.current) stop();");
    expect(source).toContain("startingRef.current = true;");
    expect(source).toContain("startingRef.current = false;");
  });
});
