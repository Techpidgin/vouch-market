import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
    buildCommand?: string;
    outputDirectory?: string;
    functions?: Record<string, { maxDuration?: number }>;
    rewrites?: Array<{ source: string; destination: string }>;
  };

  it("migrates the fresh Neon schema before the production build", () => {
    expect(config.buildCommand).toBe("pnpm run db:migrate && pnpm run build:vercel");
    expect(config.outputDirectory).toBe("dist/public");
  });

  it("serves SPA deep links without rewriting the database-backed API", () => {
    expect(config.functions?.["api/trpc/[...path].ts"]?.maxDuration).toBe(30);
    expect(config.rewrites).toContainEqual({
      source: "/:path((?!api(?:/|$)).*)",
      destination: "/index.html",
    });
  });
});
