import { describe, expect, it } from "vitest";
import { calculateMarketAmounts, decimalToUsdcMicro, toUsdcMicro, VOUCH_BANDS } from "./constants";
import { assertUnusedPaymentSignature, enforceAvailableFill, enforceDelistableOffer, enforceUnder1kMinimum, enforceWalletOwnership, nextDirectPurchaseStatus, nextRequestStatusAfterCompletions, nextRequestStatusAfterPayouts, transitionDirectPurchase } from "./rules";

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
    expect(() => decimalToUsdcMicro("0.5000001")).toThrow("up to six decimal places");
  });

  it("supports expanded point bands and calculates the 5% platform fee exactly", () => {
    expect(VOUCH_BANDS.map(item => item.value)).toContain("50k_plus");
    expect(VOUCH_BANDS.map(item => item.value)).toContain("25k_50k");
    expect(calculateMarketAmounts(100, 0.5)).toEqual({ grossUsdc: "50.000000", platformFeeUsdc: "2.500000", sellerNetUsdc: "47.500000" });
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

  it("waits for both buyer confirmation and seller completion on a direct purchase", () => {
    expect(nextDirectPurchaseStatus(false, true)).toBe("matched");
    expect(nextDirectPurchaseStatus(true, false)).toBe("matched");
    expect(nextDirectPurchaseStatus(true, true)).toBe("under_review");
  });

  it("allows only the listing owner to delist an uncommitted open offer", () => {
    expect(() => enforceDelistableOffer({ status: "open", requestId: null, sellerWallet: "seller", wallet: "buyer" })).toThrow("not authorized");
    expect(() => enforceDelistableOffer({ status: "matched", requestId: null, sellerWallet: "seller", wallet: "seller" })).toThrow("uncommitted open");
    expect(() => enforceDelistableOffer({ status: "open", requestId: null, sellerWallet: "seller", wallet: "seller" })).not.toThrow();
  });

  it("moves a direct offer purchase from reservation through verified payment and two-party completion", () => {
    const reserved = transitionDirectPurchase({ status: "open", buyerMarkedDone: false, sellerMarkedDone: false }, "reserve");
    const verified = transitionDirectPurchase(reserved, "payment_verified");
    const buyerConfirmed = transitionDirectPurchase(verified, "buyer_confirmed");
    const readyForReview = transitionDirectPurchase(buyerConfirmed, "seller_completed");
    expect(reserved.status).toBe("awaiting_payment");
    expect(verified.status).toBe("matched");
    expect(readyForReview).toMatchObject({ status: "under_review", buyerMarkedDone: true, sellerMarkedDone: true });
  });
});
