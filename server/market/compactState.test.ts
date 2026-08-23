import { describe, expect, it } from "vitest";
import { isUpstashConfigured } from "./compactState";

describe("compact Upstash state configuration", () => {
  it("requires both server-only REST values", () => {
    expect(isUpstashConfigured({})).toBe(false);
    expect(isUpstashConfigured({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io" })).toBe(false);
    expect(isUpstashConfigured({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "server-token" })).toBe(true);
  });
});
