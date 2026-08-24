import { describe, expect, it } from "vitest";
import { createDirectPurchaseIntent, createExactMarketIntent, createFillIntent } from "./instrumentLifecycle";

describe("exact vouch and slash market lifecycle", () => {
  it("accepts exact positive quantities for both vouch and slash market intents", () => {
    expect(createExactMarketIntent("vouch", 38)).toEqual({ instrument: "vouch", quantity: 38 });
    expect(createExactMarketIntent("slash", 12)).toEqual({ instrument: "slash", quantity: 12 });
  });

  it("rejects non-exact quantities before a market record is created", () => {
    expect(() => createExactMarketIntent("slash", 0)).toThrow("positive whole number");
    expect(() => createExactMarketIntent("vouch", 1.5)).toThrow("positive whole number");
  });

  it("preserves a slash instrument through fill and direct-purchase lifecycle intents", () => {
    const listing = createExactMarketIntent("slash", 24);
    expect(createFillIntent(listing, 10)).toEqual({ instrument: "slash", quantity: 10 });
    expect(createDirectPurchaseIntent(listing)).toEqual({ instrument: "slash", quantity: 24 });
    expect(() => createFillIntent(listing, 25)).toThrow("exceeds the exact available amount");
  });
});
