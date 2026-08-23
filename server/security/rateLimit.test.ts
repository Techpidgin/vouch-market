import { describe, expect, it } from "vitest";
import { clientRateLimitKey } from "./rateLimit";

describe("public mutation rate-limit key", () => {
  it("prefers the first forwarded address and falls back to the request IP", () => {
    expect(clientRateLimitKey({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" }, "127.0.0.1")).toBe("ip:203.0.113.8");
    expect(clientRateLimitKey({}, "127.0.0.1")).toBe("ip:127.0.0.1");
  });
});
