import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketRequests, sellerCommitments } from "../../drizzle/schema";

const state = vi.hoisted(() => ({
  inserts: [] as Array<{ table: unknown; values: unknown }>,
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

function updateResult(table: unknown, values: Record<string, unknown>) {
  let recorded = false;
  const record = () => {
    if (!recorded) {
      state.updates.push({ table, values });
      recorded = true;
    }
  };
  return {
    returning: async () => {
      record();
      return [{ id: 1 }];
    },
    then: <TResult1 = unknown[], TResult2 = never>(onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) => {
      record();
      return Promise.resolve([]).then(onfulfilled, onrejected);
    },
  };
}

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    insert: (table: unknown) => ({
      values: async (values: unknown) => {
        state.inserts.push({ table, values });
        return [];
      },
    }),
    select: () => query(state.selectResponses.shift() ?? []),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => updateResult(table, values),
      }),
    }),
    transaction: async (callback: (tx: { insert: (table: unknown) => { values: (values: unknown) => Promise<unknown[]> }; update: (table: unknown) => { set: (values: Record<string, unknown>) => { where: () => { returning: () => Promise<Array<{ id: number }>> } } } }) => Promise<unknown>) => callback({
      insert: (table: unknown) => ({ values: async (values: unknown) => { state.inserts.push({ table, values }); return []; } }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => updateResult(table, values),
        }),
      }),
    }),
  })),
}));

import { createRequest, createSellerOffer, fillRequest, getOperations, initiateOfferPurchase, markOfferBuyerDone, setLegacyOfferPoints } from "./db";

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

  it("stores exact slash seller supply as one compact source-account offer", async () => {
    await createSellerOffer({
      sellerWallet: "seller-wallet",
      profileHandle: "slash_account",
      projectSlug: "commonsmade",
      instrument: "slash",
      quantity: 24,
      pointsPerUnit: 12000,
      pricePerVouch: 1.2,
    });

    const listing = state.inserts.find(entry => entry.table === sellerCommitments)?.values as Record<string, unknown>;
    expect(listing).toMatchObject({ instrument: "slash", quantity: 24, pointsPerUnit: 12000, profileHandle: "slash_account", sourceHandle: "slash_account" });
    expect(listing).not.toHaveProperty("vouchBand");
  });

  it("returns slash records to the private operations service alongside historical band context", async () => {
    state.selectResponses = [
      [{ publicId: "REQ-SLASH", instrument: "slash", requestedQuantity: 9, vouchBand: null }],
      [{ publicId: "ASK-SLASH", instrument: "slash", quantity: 6, pointsPerUnit: 12000, vouchBand: "under_1k", status: "open", requestId: null, parentOfferId: null }],
      [],
      [],
    ];

    const operations = await getOperations();
    expect(operations.requests[0]).toMatchObject({ publicId: "REQ-SLASH", instrument: "slash", vouchBand: null });
    expect(operations.commitments[0]).toMatchObject({ publicId: "ASK-SLASH", instrument: "slash", pointsPerUnit: 12000, vouchBand: "under_1k" });
    expect(operations.metrics).toMatchObject({ openSourceOffers: 1, availableUnits: 6, activeAllocations: 0, listingsMissingPoints: 0 });
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
      targetHandle: "buyer_target",
      pricePerVouch: "0.750000",
    }], []];

    await fillRequest({ requestPublicId: "REQ-SLASH", sellerWallet: "seller-wallet", profileHandle: "slash_seller", quantity: 1, pointsPerUnit: 12000 });
    const fill = state.inserts.find(entry => entry.table === sellerCommitments && entry.values.profileHandle === "slash_seller")?.values;
    expect(fill).toMatchObject({ instrument: "slash", quantity: 1, pointsPerUnit: 12000, sourceHandle: "slash_seller", targetHandle: "buyer_target", allocationKey: "commonsmade:slash:slash_seller:buyer_target", projectSlug: "commonsmade" });
  });

  it("reserves and completes an exact slash direct purchase through the market service", async () => {
    state.selectResponses = [[], [{
      id: 7,
      publicId: "ASK-SLASH",
      requestId: null,
      status: "open",
      instrument: "slash",
      quantity: 3,
      sourceHandle: "slash_source",
      profileHandle: "slash_source",
      projectSlug: "commonsmade",
      pointsPerUnit: 12000,
      pricePerVouch: "1.200000",
    }], []];

    const purchase = await initiateOfferPurchase({ offerPublicId: "ASK-SLASH", buyerWallet: "buyer-wallet", targetHandle: "buyer_target" });
    expect(purchase).toMatchObject({ totalUsdc: "1.200000" });
    expect(purchase.publicId).not.toBe("ASK-SLASH");
    expect(state.inserts.some(entry => entry.table === sellerCommitments && (entry.values as Record<string, unknown>).parentOfferId === 7 && (entry.values as Record<string, unknown>).pointsPerUnit === 12000 && (entry.values as Record<string, unknown>).status === "awaiting_payment")).toBe(true);
    expect(state.updates.some(entry => entry.table === sellerCommitments && entry.values.status === "open" && "quantity" in entry.values)).toBe(true);

    state.selectResponses = [[{
      id: 7,
      publicId: purchase.publicId,
      requestId: null,
      status: "matched",
      instrument: "slash",
      buyerWallet: "buyer-wallet",
      sellerMarkedDoneAt: new Date(),
    }]];
    await markOfferBuyerDone(purchase.publicId, "buyer-wallet");
    expect(state.updates.some(entry => entry.table === sellerCommitments && entry.values.status === "under_review")).toBe(true);
  });

  it("rejects a duplicate source-to-target slash allocation before it is inserted", async () => {
    state.selectResponses = [[{
      id: 3,
      publicId: "REQ-SLASH",
      status: "open",
      requestedQuantity: 2,
      filledQuantity: 0,
      instrument: "slash",
      projectSlug: "commonsmade",
      targetHandle: "buyer_target",
      pricePerVouch: "0.750000",
    }], [{ publicId: "FILL-OLD", allocationKey: "commonsmade:slash:slash_seller:buyer_target" }]];

    await expect(fillRequest({ requestPublicId: "REQ-SLASH", sellerWallet: "seller-wallet", profileHandle: "slash_seller", quantity: 1, pointsPerUnit: 12000 })).rejects.toThrow("already allocated");
  });

  it("allows one buyer wallet to reserve the same source offer for different target handles", async () => {
    const offer = {
      id: 8,
      publicId: "ASK-SLASH",
      requestId: null,
      status: "open",
      instrument: "slash",
      quantity: 2,
      sourceHandle: "slash_source",
      profileHandle: "slash_source",
      projectSlug: "commonsmade",
      pointsPerUnit: 12000,
      pricePerVouch: "1.200000",
    };
    state.selectResponses = [[], [offer], [], [], [offer], []];

    await initiateOfferPurchase({ offerPublicId: "ASK-SLASH", buyerWallet: "same-wallet", targetHandle: "target_one" });
    await initiateOfferPurchase({ offerPublicId: "ASK-SLASH", buyerWallet: "same-wallet", targetHandle: "target_two" });

    const targets = state.inserts
      .filter(entry => entry.table === sellerCommitments && (entry.values as Record<string, unknown>).parentOfferId === 8)
      .map(entry => (entry.values as Record<string, unknown>).targetHandle);
    expect(targets).toEqual(["target_one", "target_two"]);
  });

  it("records an administrator-supplied point value only for an open legacy source offer", async () => {
    state.selectResponses = [[{
      id: 12,
      publicId: "ASK-LEGACY",
      requestId: null,
      parentOfferId: null,
      status: "open",
      pointsPerUnit: null,
    }]];

    await expect(setLegacyOfferPoints({ offerPublicId: "ASK-LEGACY", pointsPerUnit: 12000, adminWallet: "admin-wallet" })).resolves.toEqual({ publicId: "ASK-LEGACY", pointsPerUnit: 12000 });
    expect(state.updates).toContainEqual({ table: sellerCommitments, values: { pointsPerUnit: 12000 } });
  });
});
