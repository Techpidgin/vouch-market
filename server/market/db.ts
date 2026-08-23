import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  activityLogs,
  marketRequests,
  payoutRecords,
  sellerCommitments,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { ARCHIVE_AFTER_MS } from "./constants";
import { assertUnusedPaymentSignature, enforceAvailableFill, enforceWalletOwnership, nextRequestStatusAfterCompletions, nextRequestStatusAfterPayouts } from "./rules";
import { removeArchiveMetadata } from "./visibility";

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
}

export async function logActivity(input: {
  entityType: "request" | "seller_commitment" | "payout";
  entityPublicId: string;
  eventType: string;
  actorWallet?: string;
  actorAdminOpenId?: string;
  detail?: string;
}) {
  const db = await dbOrThrow();
  await db.insert(activityLogs).values(input);
}

export async function getPublicMarket() {
  const db = await dbOrThrow();
  const [requests, sellerOffers] = await Promise.all([
    db
      .select({
        publicId: marketRequests.publicId,
        targetHandle: marketRequests.targetHandle,
        vouchBand: marketRequests.vouchBand,
        requestedQuantity: marketRequests.requestedQuantity,
        filledQuantity: marketRequests.filledQuantity,
        pricePerVouch: marketRequests.pricePerVouch,
        totalUsdc: marketRequests.totalUsdc,
        status: marketRequests.status,
        archivedAt: marketRequests.archivedAt,
        createdAt: marketRequests.createdAt,
      })
      .from(marketRequests)
      .where(and(isNull(marketRequests.archivedAt), inArray(marketRequests.status, ["open", "filled", "awaiting_review"])))
      .orderBy(desc(marketRequests.createdAt)),
    db
      .select({
        publicId: sellerCommitments.publicId,
        profileHandle: sellerCommitments.profileHandle,
        vouchBand: sellerCommitments.vouchBand,
        quantity: sellerCommitments.quantity,
        pricePerVouch: sellerCommitments.pricePerVouch,
        status: sellerCommitments.status,
        archivedAt: sellerCommitments.archivedAt,
        createdAt: sellerCommitments.createdAt,
      })
      .from(sellerCommitments)
      .where(and(isNull(sellerCommitments.requestId), isNull(sellerCommitments.archivedAt), eq(sellerCommitments.status, "open")))
      .orderBy(desc(sellerCommitments.createdAt)),
  ]);

  const visibleRequests = removeArchiveMetadata(requests);
  const visibleSellerOffers = removeArchiveMetadata(sellerOffers);
  const prices = [...visibleRequests, ...visibleSellerOffers]
    .map(entry => Number(entry.pricePerVouch))
    .filter(price => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  const midpoint = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  return { requests: visibleRequests, sellerOffers: visibleSellerOffers, suggestedPricePerVouch: midpoint?.toFixed(4) ?? null };
}

export async function createRequest(input: {
  buyerWallet: string;
  targetHandle: string;
  vouchBand: "under_1k" | "1k_5k" | "5k_25k" | "25k_plus";
  requestedQuantity: number;
  pricePerVouch: number;
  totalUsdc: number;
}) {
  const db = await dbOrThrow();
  const publicId = `REQ-${nanoid(8).toUpperCase()}`;
  const now = new Date();
  await db.insert(marketRequests).values({
    ...input,
    publicId,
    pricePerVouch: input.pricePerVouch.toFixed(6),
    totalUsdc: input.totalUsdc.toFixed(6),
    archiveEligibleAt: new Date(now.getTime() + ARCHIVE_AFTER_MS),
  });
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "request_created", actorWallet: input.buyerWallet });
  return { publicId, totalUsdc: input.totalUsdc.toFixed(6) };
}

export async function activatePaidRequest(input: { publicId: string; signature: string; buyerWallet: string }) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq(marketRequests.publicId, input.publicId)).limit(1))[0];
  if (!request || request.buyerWallet !== input.buyerWallet || request.status !== "awaiting_payment") {
    throw new Error("This request cannot be activated");
  }
  const existingPayment = (await db.select().from(marketRequests).where(eq(marketRequests.paymentSignature, input.signature)).limit(1))[0];
  assertUnusedPaymentSignature(Boolean(existingPayment));
  return request;
}

export async function getPaymentDetails(publicId: string, buyerWallet: string) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq(marketRequests.publicId, publicId)).limit(1))[0];
  if (!request || request.buyerWallet !== buyerWallet || request.status !== "awaiting_payment") {
    throw new Error("No payment is due for this request and wallet");
  }
  return { publicId: request.publicId, totalUsdc: request.totalUsdc, targetHandle: request.targetHandle };
}

export async function recordVerifiedPayment(publicId: string, signature: string) {
  const db = await dbOrThrow();
  await db
    .update(marketRequests)
    .set({ paymentSignature: signature, paymentVerifiedAt: new Date(), status: "open" })
    .where(eq(marketRequests.publicId, publicId));
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "payment_verified" });
}

export async function createSellerOffer(input: {
  sellerWallet: string;
  profileHandle: string;
  vouchBand: "under_1k" | "1k_5k" | "5k_25k" | "25k_plus";
  quantity: number;
  pricePerVouch: number;
}) {
  const db = await dbOrThrow();
  const publicId = `ASK-${nanoid(8).toUpperCase()}`;
  await db.insert(sellerCommitments).values({
    ...input,
    publicId,
    pricePerVouch: input.pricePerVouch.toFixed(6),
    archiveEligibleAt: new Date(Date.now() + ARCHIVE_AFTER_MS),
  });
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "seller_offer_created", actorWallet: input.sellerWallet });
  return { publicId };
}

export async function fillRequest(input: { requestPublicId: string; sellerWallet: string; profileHandle: string; quantity: number }) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq(marketRequests.publicId, input.requestPublicId)).limit(1))[0];
  if (!request || request.status !== "open") throw new Error("This request is not open for fills");
  enforceAvailableFill(request.requestedQuantity - request.filledQuantity, input.quantity);

  const publicId = `FILL-${nanoid(8).toUpperCase()}`;
  await db.transaction(async tx => {
    const [updateResult] = await tx
      .update(marketRequests)
      .set({
        filledQuantity: sql`${marketRequests.filledQuantity} + ${input.quantity}`,
        status: request.filledQuantity + input.quantity === request.requestedQuantity ? "filled" : "open",
      })
      .where(
        and(
          eq(marketRequests.id, request.id),
          eq(marketRequests.status, "open"),
          sql`${marketRequests.filledQuantity} + ${input.quantity} <= ${marketRequests.requestedQuantity}`,
        ),
      );
    if (!updateResult.affectedRows) throw new Error("The request changed before this fill was recorded");
    await tx.insert(sellerCommitments).values({
      publicId,
      requestId: request.id,
      sellerWallet: input.sellerWallet,
      profileHandle: input.profileHandle,
      vouchBand: request.vouchBand,
      quantity: input.quantity,
      pricePerVouch: request.pricePerVouch,
      status: "matched",
      archiveEligibleAt: new Date(Date.now() + ARCHIVE_AFTER_MS),
    });
  });
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "request_filled", actorWallet: input.sellerWallet, detail: input.requestPublicId });
  return { publicId };
}

async function requestReadyForReview(requestId: number) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq(marketRequests.id, requestId)).limit(1))[0];
  if (!request) return;
  const commitments = await db.select().from(sellerCommitments).where(eq(sellerCommitments.requestId, requestId));
  if (nextRequestStatusAfterCompletions({
    requestedQuantity: request.requestedQuantity,
    filledQuantity: request.filledQuantity,
    buyerMarkedDone: Boolean(request.buyerMarkedDoneAt),
    sellerMarkedDone: commitments.map(item => Boolean(item.sellerMarkedDoneAt)),
  }) === "awaiting_review") {
    await db.update(marketRequests).set({ status: "awaiting_review" }).where(eq(marketRequests.id, requestId));
    await db.update(sellerCommitments).set({ status: "under_review" }).where(eq(sellerCommitments.requestId, requestId));
    await logActivity({ entityType: "request", entityPublicId: request.publicId, eventType: "all_participants_marked_done" });
  }
}

export async function markBuyerDone(publicId: string, wallet: string) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq(marketRequests.publicId, publicId)).limit(1))[0];
  if (!request || request.status !== "filled") throw new Error("This request cannot be marked complete yet");
  enforceWalletOwnership(request.buyerWallet, wallet);
  await db.update(marketRequests).set({ buyerMarkedDoneAt: new Date() }).where(eq(marketRequests.id, request.id));
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "buyer_marked_done", actorWallet: wallet });
  await requestReadyForReview(request.id);
}

export async function markSellerDone(publicId: string, wallet: string) {
  const db = await dbOrThrow();
  const commitment = (await db.select().from(sellerCommitments).where(eq(sellerCommitments.publicId, publicId)).limit(1))[0];
  if (!commitment || !commitment.requestId || commitment.status !== "matched") throw new Error("This fill cannot be marked complete yet");
  enforceWalletOwnership(commitment.sellerWallet, wallet);
  await db.update(sellerCommitments).set({ sellerMarkedDoneAt: new Date(), status: "done" }).where(eq(sellerCommitments.id, commitment.id));
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "seller_marked_done", actorWallet: wallet });
  await requestReadyForReview(commitment.requestId);
}

export async function cancelUnpaidRequest(publicId: string, wallet: string) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq(marketRequests.publicId, publicId)).limit(1))[0];
  if (!request || request.status !== "awaiting_payment" || request.paymentSignature) {
    throw new Error("Only an unpaid request can be cancelled");
  }
  enforceWalletOwnership(request.buyerWallet, wallet);
  await db.update(marketRequests).set({ status: "cancelled" }).where(eq(marketRequests.id, request.id));
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "unpaid_request_cancelled", actorWallet: wallet });
}

export async function getOperations() {
  const db = await dbOrThrow();
  const [requests, commitments, payouts, logs] = await Promise.all([
    db.select().from(marketRequests).orderBy(desc(marketRequests.createdAt)),
    db.select().from(sellerCommitments).orderBy(desc(sellerCommitments.createdAt)),
    db.select().from(payoutRecords).orderBy(desc(payoutRecords.createdAt)),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(80),
  ]);
  return { requests, commitments, payouts, logs };
}

export async function getParticipantActivity(wallet: string) {
  const db = await dbOrThrow();
  const [requests, fills] = await Promise.all([
    db
      .select({
        publicId: marketRequests.publicId,
        targetHandle: marketRequests.targetHandle,
        requestedQuantity: marketRequests.requestedQuantity,
        filledQuantity: marketRequests.filledQuantity,
        totalUsdc: marketRequests.totalUsdc,
        status: marketRequests.status,
        buyerMarkedDoneAt: marketRequests.buyerMarkedDoneAt,
      })
      .from(marketRequests)
      .where(eq(marketRequests.buyerWallet, wallet))
      .orderBy(desc(marketRequests.createdAt)),
    db
      .select({
        publicId: sellerCommitments.publicId,
        requestId: sellerCommitments.requestId,
        profileHandle: sellerCommitments.profileHandle,
        quantity: sellerCommitments.quantity,
        pricePerVouch: sellerCommitments.pricePerVouch,
        status: sellerCommitments.status,
        sellerMarkedDoneAt: sellerCommitments.sellerMarkedDoneAt,
      })
      .from(sellerCommitments)
      .where(eq(sellerCommitments.sellerWallet, wallet))
      .orderBy(desc(sellerCommitments.createdAt)),
  ]);
  return { requests, fills };
}

export async function recordPayoutDecision(input: {
  commitmentPublicId: string;
  status: "sent" | "withheld";
  externalReference?: string;
  adminNote?: string;
  adminOpenId: string;
}) {
  const db = await dbOrThrow();
  const commitment = (await db.select().from(sellerCommitments).where(eq(sellerCommitments.publicId, input.commitmentPublicId)).limit(1))[0];
  if (!commitment || !["under_review", "approved"].includes(commitment.status)) throw new Error("This seller fill is not ready for a payout decision");
  const amount = (Number(commitment.pricePerVouch) * commitment.quantity).toFixed(6);
  await db.insert(payoutRecords).values({
    sellerCommitmentId: commitment.id,
    recipientWallet: commitment.sellerWallet,
    amountUsdc: amount,
    status: input.status,
    externalReference: input.externalReference,
    adminNote: input.adminNote,
    decidedByOpenId: input.adminOpenId,
  });
  await db.update(sellerCommitments).set({ status: input.status === "sent" ? "paid" : "disputed" }).where(eq(sellerCommitments.id, commitment.id));
  if (commitment.requestId) {
    const siblingCommitments = await db.select().from(sellerCommitments).where(eq(sellerCommitments.requestId, commitment.requestId));
    const nextRequestStatus = nextRequestStatusAfterPayouts(siblingCommitments.map(item => {
      if (item.publicId === commitment.publicId) return input.status === "sent" ? "paid" : "disputed";
      return item.status === "paid" ? "paid" : item.status === "disputed" ? "disputed" : "under_review";
    }));
    await db.update(marketRequests).set({ status: nextRequestStatus }).where(eq(marketRequests.id, commitment.requestId));
  }
  await logActivity({ entityType: "payout", entityPublicId: commitment.publicId, eventType: `payout_${input.status}`, actorAdminOpenId: input.adminOpenId, detail: input.externalReference });
}
