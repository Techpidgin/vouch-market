import { describe, expect, it } from "vitest";
import { walletsMatch } from "../client/src/lib/walletIdentity";

describe("walletsMatch", () => {
  it("matches the same wallet without case or surrounding-space sensitivity", () => {
    expect(walletsMatch("  AbC123  ", "abc123")).toBe(true);
  });

  it("rejects absent and different wallet addresses", () => {
    expect(walletsMatch("owner-wallet", "other-wallet")).toBe(false);
    expect(walletsMatch("owner-wallet", null)).toBe(false);
  });
});
