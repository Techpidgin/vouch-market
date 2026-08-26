import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("terminal typing animation", () => {
  it("assigns the cursor to the active typing line only", () => {
    expect(homeSource).toContain("const [typingLine, setTypingLine]");
    expect(homeSource).toContain("setTypingLine(lineIndex)");
    expect(homeSource).toContain('index === typingLine ? "terminal-typing" : ""');
    expect(homeSource).not.toContain('typedLines[index].length < line.length ? "terminal-typing"');
  });
});
