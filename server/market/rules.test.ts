import { describe, expect, it } from "vitest";
import { calculateMarketAmounts, decimalToUsdcMicro, MARKET_INSTRUMENTS, toUsdcMicro } from "./constants";
import { allocationKey, assertUnusedPaymentSignature, enforceAvailableFill, enforceDelistableOffer, enforcePointsPerUnit, enforceRetentionDays, enforceSingleUnitAllocation, enforceSourceNotRestricted, enforceVerifiableEarlyRemoval, enforceWalletOwnership, nextDirectPurchaseStatus, nextRequestStatusAfterCompletions, nextRequestStatusAfterPayouts, normalizeXHandle, retentionEndsAt, retentionWindowIsActive, transitionDirectPurchase } from "./rules";

describe("Vouch Market core rules", () => {
  it("prevents fills that exceed the remaining request quantity", () => {
    expect(() => enforceAvailableFill(12, 13)).toThrow("exceeds the remaining");
    expect(() => enforceAvailableFill(12, 12)).not.toThrow();
    expect(() => enforceAvailableFill(12, 0)).toThrow("positive whole number");
  });

  it("normalizes account pairs and limits every source-to-target allocation to one unit", () => {
    expect(normalizeXHandle("@Maker_One")).toBe("maker_one");
    expect(allocationKey({ sourceHandle: "@Maker_One", targetHandle: "Target_One", projectSlug: "commonsmade", instrument: "vouch" })).toBe("commonsmade:vouch:maker_one:target_one");
    expect(() => enforceSingleUnitAllocation(2)).toThrow("exactly one unit");
    expect(() => allocationKey({ sourceHandle: "same_account", targetHandle: "@same_account", projectSlug: "commonsmade", instrument: "slash" })).toThrow("cannot allocate");
  });

  it("requires each seller-declared vouch or slash unit to carry a positive whole-number point value", () => {
    expect(() => enforcePointsPerUnit(12_000)).not.toThrow();
    expect(() => enforcePointsPerUnit(0)).toThrow("positive whole number");
    expect(() => enforcePointsPerUnit(12.5)).toThrow("positive whole number");
  });

  it("allows only clear seller-selected retention periods and starts the clock when the seller marks proof done", () => {
    const completedAt = new Date("2026-08-26T10:00:00.000Z");
    expect(() => enforceRetentionDays(30)).not.toThrow();
    expect(() => enforceRetentionDays(21)).toThrow("Choose a retention period");
    expect(retentionEndsAt(completedAt, 14).toISOString()).toBe("2026-09-09T10:00:00.000Z");
  });

  it("treats a proof as eligible for an early-removal violation only before its retention expiry", () => {
    const completedAt = new Date("2026-08-26T10:00:00.000Z");
    const expiresAt = retentionEndsAt(completedAt, 7);
    expect(retentionWindowIsActive(expiresAt, new Date("2026-09-02T09:59:59.999Z"))).toBe(true);
    expect(retentionWindowIsActive(expiresAt, new Date("2026-09-02T10:00:00.000Z"))).toBe(false);
    expect(() => enforceVerifiableEarlyRemoval({ sellerMarkedDoneAt: completedAt, retentionEndsAt: expiresAt, now: new Date("2026-09-02T09:59:59.999Z") })).not.toThrow();
    expect(() => enforceVerifiableEarlyRemoval({ sellerMarkedDoneAt: completedAt, retentionEndsAt: expiresAt, now: new Date("2026-09-02T10:00:00.000Z") })).toThrow("already expired");
  });

  it("blocks a verified restricted source from new marketplace activity", () => {
    expect(() => enforceSourceNotRestricted(false)).not.toThrow();
    expect(() => enforceSourceNotRestricted(true)).toThrow("restricted from new HANKA listings");
  });

  it("converts USDC exactly to six-decimal micro-units", () => {
    expect(toUsdcMicro(0.5)).toBe(500_000);
    expect(decimalToUsdcMicro("42.125001")).toBe(42_125_001);
    expect(() => decimalToUsdcMicro("0.5000001")).toThrow("up to six decimal places");
  });

  it("supports HANKA's social-proof instruments with exact-quantity fee calculations", () => {
    expect(MARKET_INSTRUMENTS.map(item => item.value)).toEqual(expect.arrayContaining(["vouch", "slash", "follow", "repost", "comment", "space_speaker"]));
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
