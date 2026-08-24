import { existsSync, readFileSync } from "node:fs";
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

  it("uses one source-traced API function and keeps API paths outside the SPA fallback", () => {
    expect(config.functions?.["api/trpc/[...path].ts"]?.maxDuration).toBe(30);
    expect(existsSync(resolve(process.cwd(), "api/trpc/[...path].ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "api/trpc/[...path].js"))).toBe(false);
    expect(config.rewrites).toContainEqual({
      source: "/:path((?!api(?:/|$)).*)",
      destination: "/index.html",
    });
  });
});
