import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  activateOfferPurchase: vi.fn(),
  activatePaidRequest: vi.fn(),
  createRequest: vi.fn(),
  createSellerOffer: vi.fn(),
  fillRequest: vi.fn(),
  initiateOfferPurchase: vi.fn(),
  markBuyerDone: vi.fn(),
  markOfferBuyerDone: vi.fn(),
  markSellerDone: vi.fn(),
  recordPayoutDecision: vi.fn(),
  recordVerifiedOfferPurchase: vi.fn(),
  recordVerifiedPayment: vi.fn(),
  reportEarlyRemoval: vi.fn(),
  verifyEarlyRemovalAndBanSource: vi.fn(),
  verifyUsdcPayment: vi.fn(),
  verifyWalletChallenge: vi.fn(),
  awardReferralPoints: vi.fn(),
}));

vi.mock("./market/db", () => ({
  activateOfferPurchase: mocks.activateOfferPurchase,
  activatePaidRequest: mocks.activatePaidRequest,
  cancelUnpaidRequest: vi.fn(),
  createMarketProject: vi.fn(),
  createRequest: mocks.createRequest,
  createSellerOffer: mocks.createSellerOffer,
  delistSellerOffer: vi.fn(),
  fillRequest: mocks.fillRequest,
  getOperations: vi.fn(),
  getOfferPaymentDetails: vi.fn(),
  getParticipantActivity: vi.fn(),
  getPaymentDetails: vi.fn(),
  getPublicMarket: vi.fn(),
  initiateOfferPurchase: mocks.initiateOfferPurchase,
  markBuyerDone: mocks.markBuyerDone,
  markOfferBuyerDone: mocks.markOfferBuyerDone,
  markSellerDone: mocks.markSellerDone,
  recordPayoutDecision: mocks.recordPayoutDecision,
  recordVerifiedOfferPurchase: mocks.recordVerifiedOfferPurchase,
  recordVerifiedPayment: mocks.recordVerifiedPayment,
  reportEarlyRemoval: mocks.reportEarlyRemoval,
  setLegacyOfferPoints: vi.fn(),
  verifyEarlyRemovalAndBanSource: mocks.verifyEarlyRemovalAndBanSource,
}));

vi.mock("./market/solana", () => ({ verifyUsdcPayment: mocks.verifyUsdcPayment }));
vi.mock("./market/walletProof", () => ({
  createWalletChallenge: vi.fn(),
  verifyWalletChallenge: mocks.verifyWalletChallenge,
}));
vi.mock("./market/referrals", () => ({
  awardReferralPoints: mocks.awardReferralPoints,
  getReferralDashboard: vi.fn(),
  getReferralLeaderboard: vi.fn(),
  joinReferral: vi.fn(),
}));

import { appRouter } from "./routers";

const sellerWallet = "6SaEG13gzLSkYnam6gRkM2NGRctVLL5JZ9vEi5MgGydd";
const buyerWallet = "9GNs93A6NuBBQvcC9tTgeKFByiZRfVCfWhEqCwSk6bdX";
const proof = { challengeId: "challenge-123", signature: "signature-that-is-long-enough" };
const transactionSignature = "a".repeat(88);

function anonymousContext() {
  return {
    user: null,
    req: { headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("wallet-first marketplace workflow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyWalletChallenge.mockResolvedValue(undefined);
    mocks.verifyUsdcPayment.mockResolvedValue(undefined);
    mocks.createSellerOffer.mockResolvedValue({ publicId: "ASK-LIVE", unitsPosted: 2 });
    mocks.initiateOfferPurchase.mockResolvedValue({ publicId: "ASK-ALLOC", totalUsdc: "0.520000" });
    mocks.activateOfferPurchase.mockResolvedValue({ grossUsdc: "0.520000", createdAt: new Date("2026-08-24T07:00:00.000Z") });
    mocks.createRequest.mockResolvedValue({ publicId: "REQ-LIVE", totalUsdc: "1.040000" });
    mocks.activatePaidRequest.mockResolvedValue({ totalUsdc: "1.040000", createdAt: new Date("2026-08-24T07:00:00.000Z") });
    mocks.fillRequest.mockResolvedValue({ publicId: "FILL-LIVE" });
    mocks.recordPayoutDecision.mockResolvedValue(undefined);
    mocks.reportEarlyRemoval.mockResolvedValue({ publicId: "ASK-ALLOC", reportedAt: new Date("2026-08-25T07:00:00.000Z") });
    mocks.verifyEarlyRemovalAndBanSource.mockResolvedValue({ sourceHandle: "source_one", bannedAt: new Date("2026-08-25T07:05:00.000Z") });
  });

  it("traces a source listing through one target allocation, verified payment, two-party completion, and administrator payout review", async () => {
    const caller = appRouter.createCaller(anonymousContext());

    await caller.market.createSellerOffer({ wallet: sellerWallet, profileHandle: "source_one", projectSlug: "commonsmade", instrument: "vouch", quantity: 2, pointsPerUnit: 12000, retentionDays: 30, pricePerVouch: 0.52, proof });
    await caller.market.initiateOfferPurchase({ publicId: "ASK-LIVE", wallet: buyerWallet, targetHandle: "target_one", proof });
    await caller.market.verifyOfferPayment({ publicId: "ASK-ALLOC", wallet: buyerWallet, signature: transactionSignature });
    await caller.market.markSellerDone({ publicId: "ASK-ALLOC", wallet: sellerWallet, proof });
    await caller.market.markOfferBuyerDone({ publicId: "ASK-ALLOC", wallet: buyerWallet, proof });
    await caller.admin.recordPayout({ commitmentPublicId: "ASK-ALLOC", status: "sent", wallet: sellerWallet, proof });

    expect(mocks.createSellerOffer).toHaveBeenCalledWith(expect.objectContaining({ profileHandle: "source_one", pointsPerUnit: 12000, quantity: 2, retentionDays: 30 }));
    expect(mocks.initiateOfferPurchase).toHaveBeenCalledWith({ offerPublicId: "ASK-LIVE", buyerWallet, targetHandle: "target_one" });
    expect(mocks.verifyUsdcPayment).toHaveBeenCalledWith(expect.objectContaining({ signature: transactionSignature, buyerWallet, expectedUsdc: "0.520000" }));
    expect(mocks.recordVerifiedOfferPurchase).toHaveBeenCalledWith("ASK-ALLOC", transactionSignature, buyerWallet);
    expect(mocks.markSellerDone).toHaveBeenCalledWith("ASK-ALLOC", sellerWallet);
    expect(mocks.markOfferBuyerDone).toHaveBeenCalledWith("ASK-ALLOC", buyerWallet);
    expect(mocks.recordPayoutDecision).toHaveBeenCalledWith(expect.objectContaining({ commitmentPublicId: "ASK-ALLOC", status: "sent", adminOpenId: `wallet:${sellerWallet}` }));
  });

  it("traces a buyer request through signed payment, a one-unit point-declared source fill, completion, and administrator payout review", async () => {
    const caller = appRouter.createCaller(anonymousContext());

    await caller.market.createRequest({ wallet: buyerWallet, targetHandle: "target_two", projectSlug: "commonsmade", instrument: "slash", quantity: 1, pricePerVouch: 1.04, proof });
    await caller.market.verifyPayment({ publicId: "REQ-LIVE", wallet: buyerWallet, signature: transactionSignature });
    await caller.market.fillRequest({ requestPublicId: "REQ-LIVE", wallet: sellerWallet, profileHandle: "source_two", quantity: 1, pointsPerUnit: 8500, retentionDays: 14, proof });
    await caller.market.markBuyerDone({ publicId: "REQ-LIVE", wallet: buyerWallet, proof });
    await caller.market.markSellerDone({ publicId: "FILL-LIVE", wallet: sellerWallet, proof });
    await caller.admin.recordPayout({ commitmentPublicId: "FILL-LIVE", status: "sent", wallet: sellerWallet, proof });

    expect(mocks.createRequest).toHaveBeenCalledWith(expect.objectContaining({ buyerWallet, targetHandle: "target_two", instrument: "slash", requestedQuantity: 1 }));
    expect(mocks.verifyUsdcPayment).toHaveBeenCalledWith(expect.objectContaining({ signature: transactionSignature, buyerWallet, expectedUsdc: "1.040000" }));
    expect(mocks.fillRequest).toHaveBeenCalledWith({ requestPublicId: "REQ-LIVE", sellerWallet, profileHandle: "source_two", quantity: 1, pointsPerUnit: 8500, retentionDays: 14 });
    expect(mocks.markBuyerDone).toHaveBeenCalledWith("REQ-LIVE", buyerWallet);
    expect(mocks.markSellerDone).toHaveBeenCalledWith("FILL-LIVE", sellerWallet);
    expect(mocks.recordPayoutDecision).toHaveBeenCalledWith(expect.objectContaining({ commitmentPublicId: "FILL-LIVE", status: "sent", adminOpenId: `wallet:${sellerWallet}` }));
  });
});
