import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
    buildCommand?: string;
    outputDirectory?: string;
    functions?: Record<string, { maxDuration?: number; includeFiles?: string }>;
    rewrites?: Array<{ source: string; destination: string }>;
  };

  it("builds without database access and includes the fresh Neon migrations in the runtime function", () => {
    expect(config.buildCommand).toBe("pnpm run build:vercel:function && pnpm run build:vercel");
    expect(config.outputDirectory).toBe("dist/public");
    expect(config.functions?.["api/trpc/[...path].cjs"]?.includeFiles).toBe("drizzle/neon/**");
  });

  it("uses one bundled CommonJS API function and keeps API paths outside the SPA fallback", () => {
    expect(config.functions?.["api/trpc/[...path].cjs"]?.maxDuration).toBe(30);
    expect(existsSync(resolve(process.cwd(), "server/vercel/trpcHandler.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "api/trpc/[...path].ts"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "api/trpc/[...path].js"))).toBe(false);
    expect(config.rewrites).toContainEqual({
      source: "/:path((?!api(?:/|$)).*)",
      destination: "/index.html",
    });
  });
});
