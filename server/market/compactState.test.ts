import { describe, expect, it } from "vitest";
import { isUpstashConfigured } from "./compactState";

describe("compact Upstash state configuration", () => {
  it("requires both server-only REST values", () => {
    expect(isUpstashConfigured({})).toBe(false);
    expect(isUpstashConfigured({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io" })).toBe(false);
    expect(isUpstashConfigured({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "server-token" })).toBe(true);
  });

  it("accepts the server-only KV aliases injected by Vercel's Upstash integration", () => {
    expect(isUpstashConfigured({ KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "server-token" })).toBe(true);
  });
});
