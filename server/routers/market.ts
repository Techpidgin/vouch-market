import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { publicProcedure, rateLimitedPublicProcedure, router } from "../_core/trpc";
import {
  activatePaidRequest,
  activateOfferPurchase,
  cancelUnpaidRequest,
  createRequest,
  createSellerOffer,
  createSupportMessage,
  delistSellerOffer,
  fillRequest,
  getParticipantActivity,
  getOfferPaymentDetails,
  getPaymentDetails,
  getPublicMarket,
  initiateOfferPurchase,
  markBuyerDone,
  markOfferBuyerDone,
  markSellerDone,
  recordVerifiedOfferPurchase,
  recordVerifiedPayment,
} from "../market/db";
import { verifyUsdcPayment } from "../market/solana";
import { USDC_MINT } from "../market/constants";
import { createWalletChallenge, verifyWalletChallenge } from "../market/walletProof";

const wallet = z.string().trim().min(32).max(64).refine(value => {
  try { new PublicKey(value); return true; } catch { return false; }
}, "Enter a valid Solana wallet address");
const instrument = z.enum(["vouch", "slash", "follow", "repost", "comment", "space_listener", "space_speaker", "space_contributor"]);
const proofScope = z.string().trim().max(240).optional();
const spaceMinutes = z.number().int().positive().max(720).optional();
const proof = z.object({ challengeId: z.string().min(8), signature: z.string().min(20) });
const xHandle = z.string().trim().min(1).max(16).regex(/^@?[A-Za-z0-9_]+$/, "Enter a valid X handle");

function marketError(error: unknown): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The request could not be processed" });
}

export const marketRouter = router({
  board: publicProcedure.query(async () => getPublicMarket()),
  activity: rateLimitedPublicProcedure
    .input(z.object({ wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "activity_view" });
        return getParticipantActivity(input.wallet);
      } catch (error) { marketError(error); }
    }),
  walletChallenge: rateLimitedPublicProcedure
    .input(z.object({ wallet, action: z.enum(["buyer_request", "seller_offer", "seller_fill", "buyer_done", "seller_done", "cancel_request", "seller_delist", "offer_buy", "offer_buyer_done", "activity_view", "support_message", "admin_access"]) }))
    .mutation(async ({ input }) => {
      try {
        return await createWalletChallenge(input.wallet, input.action);
      } catch (error) {
        marketError(error);
      }
    }),
  supportMessage: rateLimitedPublicProcedure
    .input(z.object({ wallet, subject: z.string().trim().max(120).optional(), message: z.string().trim().min(4).max(2_000), proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "support_message" });
        return await createSupportMessage({ wallet: input.wallet, subject: input.subject || "Customer support", message: input.message });
      } catch (error) {
        marketError(error);
      }
    }),
  createRequest: rateLimitedPublicProcedure
    .input(z.object({ wallet, targetHandle: xHandle, projectSlug: z.string().trim().min(2).max(64).default("commonsmade"), instrument: instrument.default("vouch"), proofDetail: proofScope, spaceMinutes, quantity: z.number().int().positive().max(1_000_000), pricePerVouch: z.number().positive().max(10_000), proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "buyer_request" });
        const created = await createRequest({ buyerWallet: input.wallet, targetHandle: input.targetHandle.replace(/^@/, ""), projectSlug: input.projectSlug, instrument: input.instrument, proofDetail: input.proofDetail, spaceMinutes: input.spaceMinutes, requestedQuantity: input.quantity, pricePerVouch: input.pricePerVouch, totalUsdc: input.quantity * input.pricePerVouch });
        return { ...created, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
      } catch (error) {
        marketError(error);
      }
    }),
  paymentDetails: publicProcedure
    .input(z.object({ publicId: z.string().startsWith("REQ-"), wallet }))
    .query(async ({ input }) => {
      try {
        const details = await getPaymentDetails(input.publicId, input.wallet);
        return { ...details, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
      } catch (error) {
        marketError(error);
      }
    }),
  verifyPayment: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("REQ-"), wallet, signature: z.string().min(64).max(128) }))
    .mutation(async ({ input }) => {
      try {
        const request = await activatePaidRequest({ publicId: input.publicId, signature: input.signature, buyerWallet: input.wallet });
        await verifyUsdcPayment({ signature: input.signature, buyerWallet: input.wallet, expectedUsdc: request.totalUsdc, earliestAllowedAt: request.createdAt });
        await recordVerifiedPayment(input.publicId, input.signature, input.wallet);
        return { ok: true };
      } catch (error) {
        marketError(error);
      }
    }),
  createSellerOffer: rateLimitedPublicProcedure
    .input(z.object({ wallet, profileHandle: xHandle, projectSlug: z.string().trim().min(2).max(64).default("commonsmade"), instrument: instrument.default("vouch"), proofDetail: proofScope, spaceMinutes, quantity: z.number().int().positive().max(1_000_000), pointsPerUnit: z.number().int().positive().max(1_000_000_000), pricePerVouch: z.number().positive().max(10_000), proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_offer" });
        return await createSellerOffer({ sellerWallet: input.wallet, profileHandle: input.profileHandle.replace(/^@/, ""), projectSlug: input.projectSlug, instrument: input.instrument, proofDetail: input.proofDetail, spaceMinutes: input.spaceMinutes, quantity: input.quantity, pointsPerUnit: input.pointsPerUnit, pricePerVouch: input.pricePerVouch });
      } catch (error) {
        marketError(error);
      }
    }),
  fillRequest: rateLimitedPublicProcedure
    .input(z.object({ requestPublicId: z.string().startsWith("REQ-"), wallet, profileHandle: xHandle, quantity: z.number().int().positive(), pointsPerUnit: z.number().int().positive().max(1_000_000_000), proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_fill" });
        return await fillRequest({ requestPublicId: input.requestPublicId, sellerWallet: input.wallet, profileHandle: input.profileHandle.replace(/^@/, ""), quantity: input.quantity, pointsPerUnit: input.pointsPerUnit });
      } catch (error) {
        marketError(error);
      }
    }),
  initiateOfferPurchase: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("ASK-"), wallet, targetHandle: xHandle, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "offer_buy" });
        const created = await initiateOfferPurchase({ offerPublicId: input.publicId, buyerWallet: input.wallet, targetHandle: input.targetHandle });
        return { ...created, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
      } catch (error) { marketError(error); }
    }),
  offerPaymentDetails: publicProcedure
    .input(z.object({ publicId: z.string().startsWith("ASK-"), wallet }))
    .query(async ({ input }) => {
      try {
        const details = await getOfferPaymentDetails(input.publicId, input.wallet);
        return { ...details, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
      } catch (error) { marketError(error); }
    }),
  verifyOfferPayment: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("ASK-"), wallet, signature: z.string().min(64).max(128) }))
    .mutation(async ({ input }) => {
      try {
        const offer = await activateOfferPurchase({ publicId: input.publicId, signature: input.signature, buyerWallet: input.wallet });
        await verifyUsdcPayment({ signature: input.signature, buyerWallet: input.wallet, expectedUsdc: offer.grossUsdc!, earliestAllowedAt: offer.createdAt });
        await recordVerifiedOfferPurchase(input.publicId, input.signature, input.wallet);
        return { ok: true };
      } catch (error) { marketError(error); }
    }),
  delistSellerOffer: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("ASK-"), wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_delist" });
        await delistSellerOffer(input.publicId, input.wallet);
        return { ok: true };
      } catch (error) { marketError(error); }
    }),
  markBuyerDone: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("REQ-"), wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "buyer_done" });
        await markBuyerDone(input.publicId, input.wallet);
        return { ok: true };
      } catch (error) {
        marketError(error);
      }
    }),
  markSellerDone: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().regex(/^(FILL|ASK)-/), wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_done" });
        await markSellerDone(input.publicId, input.wallet);
        return { ok: true };
      } catch (error) {
        marketError(error);
      }
    }),
  markOfferBuyerDone: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("ASK-"), wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "offer_buyer_done" });
        await markOfferBuyerDone(input.publicId, input.wallet);
        return { ok: true };
      } catch (error) { marketError(error); }
    }),
  cancelRequest: rateLimitedPublicProcedure
    .input(z.object({ publicId: z.string().startsWith("REQ-"), wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "cancel_request" });
        await cancelUnpaidRequest(input.publicId, input.wallet);
        return { ok: true };
      } catch (error) {
        marketError(error);
      }
    }),
});
