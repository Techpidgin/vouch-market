import { describe, expect, it } from "vitest";
import { decimalToUsdcMicro, toUsdcMicro } from "./constants";
import { assertUnusedPaymentSignature, enforceAvailableFill, enforceUnder1kMinimum, enforceWalletOwnership, nextRequestStatusAfterCompletions, nextRequestStatusAfterPayouts } from "./rules";

describe("Vouch Market core rules", () => {
  it("enforces the 0.50 USDC floor for under-1k requests", () => {
    expect(() => enforceUnder1kMinimum("under_1k", 0.49)).toThrow("at least 0.50 USDC");
    expect(() => enforceUnder1kMinimum("under_1k", 0.5)).not.toThrow();
    expect(() => enforceUnder1kMinimum("1k_5k", 0.01)).not.toThrow();
  });

  it("prevents fills that exceed the remaining request quantity", () => {
    expect(() => enforceAvailableFill(12, 13)).toThrow("exceeds the remaining");
    expect(() => enforceAvailableFill(12, 12)).not.toThrow();
    expect(() => enforceAvailableFill(12, 0)).toThrow("positive whole number");
  });

  it("converts USDC exactly to six-decimal micro-units", () => {
    expect(toUsdcMicro(0.5)).toBe(500_000);
    expect(decimalToUsdcMicro("42.125001")).toBe(42_125_001);
  });

  it("rejects an already claimed payment signature", () => {
    expect(() => assertUnusedPaymentSignature(true)).toThrow("already been used");
    expect(() => assertUnusedPaymentSignature(false)).not.toThrow();
  });

  it("enforces wallet ownership for done and cancellation actions", () => {
    expect(() => enforceWalletOwnership("buyer-wallet", "seller-wallet")).toThrow("not authorized");
    expect(() => enforceWalletOwnership("buyer-wallet", "buyer-wallet")).not.toThrow();
  });

  it("moves a full request into review only after buyer and all sellers confirm", () => {
    expect(nextRequestStatusAfterCompletions({ requestedQuantity: 10, filledQuantity: 10, buyerMarkedDone: true, sellerMarkedDone: [true, true] })).toBe("awaiting_review");
    expect(nextRequestStatusAfterCompletions({ requestedQuantity: 10, filledQuantity: 10, buyerMarkedDone: false, sellerMarkedDone: [true] })).toBe("filled");
    expect(nextRequestStatusAfterCompletions({ requestedQuantity: 10, filledQuantity: 9, buyerMarkedDone: true, sellerMarkedDone: [true] })).toBe("filled");
  });

  it("resolves review status from manual payout decisions", () => {
    expect(nextRequestStatusAfterPayouts(["paid", "paid"])).toBe("completed");
    expect(nextRequestStatusAfterPayouts(["paid", "disputed"])).toBe("disputed");
    expect(nextRequestStatusAfterPayouts(["paid", "under_review"])).toBe("awaiting_review");
  });
});
