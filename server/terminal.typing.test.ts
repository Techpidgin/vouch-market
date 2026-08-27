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

  it("reveals complete command tokens without hiding any trailing text", () => {
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(homeSource).toContain('"connect EVM / Arc"');
    expect(homeSource).toContain('"fund Bounty / USDC"');
    expect(homeSource).toContain('"claim source / proof"');
    expect(homeSource).toContain("const words = line.split");
    expect(homeSource).toContain("words.slice(0, wordIndex + 1).join");
    expect(homeSource).toContain("if (wordIndex < words.length - 1)");
    expect(css).toContain("text-overflow: clip");
    expect(css).toContain("grid-template-columns: 1.25rem minmax(0, 1fr)");
    expect(css).not.toContain(".terminal-code-row code { overflow: hidden; text-overflow: ellipsis");
  });
});
