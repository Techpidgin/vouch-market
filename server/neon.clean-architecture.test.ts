import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("clean Neon deployment architecture", () => {
  const root = process.cwd();
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };

  it("has no Upstash runtime packages or source modules", () => {
    expect(packageJson.dependencies?.["@upstash/redis"]).toBeUndefined();
    expect(packageJson.dependencies?.["@upstash/ratelimit"]).toBeUndefined();
    expect(existsSync(resolve(root, "server/market/compactState.ts"))).toBe(false);
    expect(existsSync(resolve(root, "server/security/rateLimit.ts"))).toBe(false);
  });

  it("keeps one traceable TypeScript tRPC function instead of a generated bundle", () => {
    const handlerPath = resolve(root, "api/trpc/[...path].ts");
    expect(existsSync(handlerPath)).toBe(true);
    expect(existsSync(resolve(root, "api/trpc/[...path].js"))).toBe(false);
    const handlerSource = readFileSync(handlerPath, "utf8");
    expect(handlerSource).toContain("createVouchApp");
    expect(handlerSource).toContain("return app(req as never, res as never)");
  });
});
