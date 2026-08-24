import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketRequests, sellerCommitments } from "../../drizzle/schema";

const state = vi.hoisted(() => ({
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  selectResponses: [] as unknown[][],
}));

function query(result: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(result),
    then: <TResult1 = unknown[], TResult2 = never>(onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        state.inserts.push({ table, values });
        return [];
      },
    }),
    select: () => query(state.selectResponses.shift() ?? []),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push({ table, values });
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    transaction: async (callback: (tx: { insert: (table: unknown) => { values: (values: Record<string, unknown>) => Promise<unknown[]> }; update: (table: unknown) => { set: (values: Record<string, unknown>) => { where: () => Promise<Array<{ affectedRows: number }>> } } }) => Promise<unknown>) => callback({
      insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => { state.inserts.push({ table, values }); return []; } }),
      update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { state.updates.push({ table, values }); return [{ affectedRows: 1 }]; } }) }),
    }),
  })),
}));

vi.mock("./compactState", () => ({
  getCachedPublicBoard: async <T>(factory: () => Promise<T>) => factory(),
  invalidatePublicBoardCache: async () => undefined,
}));

import { createRequest, createSellerOffer, fillRequest, getOperations, initiateOfferPurchase, markOfferBuyerDone } from "./db";

describe("slash market service records", () => {
  beforeEach(() => {
    state.inserts = [];
    state.updates = [];
    state.selectResponses = [];
  });

  it("stores an exact slash buyer bid without a reputation-band dependency", async () => {
    await createRequest({
      buyerWallet: "buyer-wallet",
      targetHandle: "commonsmade",
      projectSlug: "commonsmade",
      instrument: "slash",
      requestedQuantity: 11,
      pricePerVouch: 0.75,
      totalUsdc: 8.25,
    });

    const request = state.inserts.find(entry => entry.table === marketRequests)?.values;
    expect(request).toMatchObject({ instrument: "slash", requestedQuantity: 11, targetHandle: "commonsmade" });
    expect(request).not.toHaveProperty("vouchBand");
  });

  it("stores an exact slash seller listing without a reputation-band dependency", async () => {
    await createSellerOffer({
      sellerWallet: "seller-wallet",
      profileHandle: "slash-account",
      projectSlug: "commonsmade",
      instrument: "slash",
      quantity: 24,
      pricePerVouch: 1.2,
    });

    const listing = state.inserts.find(entry => entry.table === sellerCommitments)?.values;
    expect(listing).toMatchObject({ instrument: "slash", quantity: 24, profileHandle: "slash-account" });
    expect(listing).not.toHaveProperty("vouchBand");
  });

  it("returns slash records to the private operations service alongside historical band context", async () => {
    state.selectResponses = [
      [{ publicId: "REQ-SLASH", instrument: "slash", requestedQuantity: 9, vouchBand: null }],
      [{ publicId: "ASK-SLASH", instrument: "slash", quantity: 6, vouchBand: "under_1k" }],
      [],
      [],
    ];

    const operations = await getOperations();
    expect(operations.requests[0]).toMatchObject({ publicId: "REQ-SLASH", instrument: "slash", vouchBand: null });
    expect(operations.commitments[0]).toMatchObject({ publicId: "ASK-SLASH", instrument: "slash", vouchBand: "under_1k" });
  });

  it("preserves a slash instrument when a seller fills an exact slash bid", async () => {
    state.selectResponses = [[{
      id: 3,
      publicId: "REQ-SLASH",
      status: "open",
      requestedQuantity: 12,
      filledQuantity: 2,
      instrument: "slash",
      projectSlug: "commonsmade",
      pricePerVouch: "0.750000",
    }]];

    await fillRequest({ requestPublicId: "REQ-SLASH", sellerWallet: "seller-wallet", profileHandle: "slash-seller", quantity: 4 });
    const fill = state.inserts.find(entry => entry.table === sellerCommitments && entry.values.profileHandle === "slash-seller")?.values;
    expect(fill).toMatchObject({ instrument: "slash", quantity: 4, projectSlug: "commonsmade" });
  });

  it("reserves and completes an exact slash direct purchase through the market service", async () => {
    state.selectResponses = [[{
      id: 7,
      publicId: "ASK-SLASH",
      requestId: null,
      status: "open",
      instrument: "slash",
      quantity: 6,
      pricePerVouch: "1.200000",
    }]];

    const purchase = await initiateOfferPurchase({ offerPublicId: "ASK-SLASH", buyerWallet: "buyer-wallet" });
    expect(purchase).toMatchObject({ publicId: "ASK-SLASH", totalUsdc: "7.200000" });
    expect(state.updates.some(entry => entry.table === sellerCommitments && entry.values.status === "awaiting_payment")).toBe(true);

    state.selectResponses = [[{
      id: 7,
      publicId: "ASK-SLASH",
      requestId: null,
      status: "matched",
      instrument: "slash",
      buyerWallet: "buyer-wallet",
      sellerMarkedDoneAt: new Date(),
    }]];
    await markOfferBuyerDone("ASK-SLASH", "buyer-wallet");
    expect(state.updates.some(entry => entry.table === sellerCommitments && entry.values.status === "under_review")).toBe(true);
  });
});
