import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  verifyWalletChallenge: vi.fn(),
  getOperations: vi.fn(),
  setLegacyOfferPoints: vi.fn(),
}));

vi.mock("./market/walletProof", () => ({ verifyWalletChallenge: mocks.verifyWalletChallenge }));
vi.mock("./market/db", () => ({
  createMarketProject: vi.fn(),
  getOperations: mocks.getOperations,
  recordPayoutDecision: vi.fn(),
  setLegacyOfferPoints: mocks.setLegacyOfferPoints,
}));

import { appRouter } from "./routers";

const authorizedWallet = "6SaEG13gzLSkYnam6gRkM2NGRctVLL5JZ9vEi5MgGydd";
const walletProof = { challengeId: "challenge-123", signature: "signature-that-is-long-enough" };

function anonymousContext() {
  return {
    user: null,
    req: { headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

describe("wallet-only administrator operations access", () => {
  beforeEach(() => {
    mocks.verifyWalletChallenge.mockResolvedValue(undefined);
    mocks.getOperations.mockResolvedValue({ requests: [], commitments: [], payouts: [], logs: [] });
    mocks.setLegacyOfferPoints.mockResolvedValue({ publicId: "ASK-LEGACY", pointsPerUnit: 12000 });
  });

  it("opens operations for an authorized wallet without an OAuth user session", async () => {
    const result = await appRouter.createCaller(anonymousContext()).admin.operations({ wallet: authorizedWallet, proof: walletProof });

    expect(result).toEqual({ requests: [], commitments: [], payouts: [], logs: [] });
    expect(mocks.verifyWalletChallenge).toHaveBeenCalledWith({ ...walletProof, wallet: authorizedWallet, action: "admin_access" });
  });

  it("still rejects a wallet that is not on the administrator allowlist", async () => {
    await expect(appRouter.createCaller(anonymousContext()).admin.operations({ wallet: "11111111111111111111111111111111", proof: walletProof })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires the same signed administrator proof to repair a legacy offer point value", async () => {
    await expect(appRouter.createCaller(anonymousContext()).admin.setLegacyOfferPoints({ offerPublicId: "ASK-LEGACY", pointsPerUnit: 12000, wallet: authorizedWallet, proof: walletProof })).resolves.toEqual({ publicId: "ASK-LEGACY", pointsPerUnit: 12000 });
    expect(mocks.verifyWalletChallenge).toHaveBeenCalledWith({ ...walletProof, wallet: authorizedWallet, action: "admin_access" });
    expect(mocks.setLegacyOfferPoints).toHaveBeenCalledWith({ offerPublicId: "ASK-LEGACY", pointsPerUnit: 12000, wallet: authorizedWallet, proof: walletProof, adminWallet: authorizedWallet });
  });
});
