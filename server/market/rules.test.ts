import { describe, expect, it } from "vitest";
import { calculateMarketAmounts, decimalToUsdcMicro, MARKET_INSTRUMENTS, toUsdcMicro } from "./constants";
import { assertUnusedPaymentSignature, enforceAvailableFill, enforceDelistableOffer, enforceWalletOwnership, nextDirectPurchaseStatus, nextRequestStatusAfterCompletions, nextRequestStatusAfterPayouts, transitionDirectPurchase } from "./rules";

describe("Vouch Market core rules", () => {
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

  it("supports vouch and slash instruments with exact-quantity fee calculations", () => {
    expect(MARKET_INSTRUMENTS.map(item => item.value)).toEqual(["vouch", "slash"]);
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
