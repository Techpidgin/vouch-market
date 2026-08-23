import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  activatePaidRequest,
  cancelUnpaidRequest,
  createRequest,
  createSellerOffer,
  fillRequest,
  getParticipantActivity,
  getPaymentDetails,
  getPublicMarket,
  markBuyerDone,
  markSellerDone,
  recordVerifiedPayment,
} from "../market/db";
import { verifyUsdcPayment } from "../market/solana";
import { USDC_MINT } from "../market/constants";
import { createWalletChallenge, verifyWalletChallenge } from "../market/walletProof";
import { enforceUnder1kMinimum } from "../market/rules";

const wallet = z.string().trim().min(32).max(64);
const band = z.enum(["under_1k", "1k_5k", "5k_25k", "25k_plus"]);
const proof = z.object({ challengeId: z.string().min(8), signature: z.string().min(20) });

function marketError(error: unknown): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The request could not be processed" });
}

export const marketRouter = router({
  board: publicProcedure.query(async () => getPublicMarket()),
  activity: publicProcedure.input(z.object({ wallet })).query(async ({ input }) => getParticipantActivity(input.wallet)),
  walletChallenge: publicProcedure
    .input(z.object({ wallet, action: z.enum(["seller_offer", "seller_fill", "buyer_done", "seller_done", "cancel_request"]) }))
    .mutation(async ({ input }) => {
      try {
        return await createWalletChallenge(input.wallet, input.action);
      } catch (error) {
        marketError(error);
      }
    }),
  createRequest: publicProcedure
    .input(z.object({ wallet, targetHandle: z.string().trim().min(1).max(80), vouchBand: band, quantity: z.number().int().positive().max(1_000_000), pricePerVouch: z.number().positive().max(10_000) }))
    .mutation(async ({ input }) => {
      try {
        enforceUnder1kMinimum(input.vouchBand, input.pricePerVouch);
        const created = await createRequest({ buyerWallet: input.wallet, targetHandle: input.targetHandle.replace(/^@/, ""), vouchBand: input.vouchBand, requestedQuantity: input.quantity, pricePerVouch: input.pricePerVouch, totalUsdc: input.quantity * input.pricePerVouch });
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
  verifyPayment: publicProcedure
    .input(z.object({ publicId: z.string().startsWith("REQ-"), wallet, signature: z.string().min(64).max(128) }))
    .mutation(async ({ input }) => {
      try {
        const request = await activatePaidRequest({ publicId: input.publicId, signature: input.signature, buyerWallet: input.wallet });
        await verifyUsdcPayment({ signature: input.signature, buyerWallet: input.wallet, expectedUsdc: request.totalUsdc, earliestAllowedAt: request.createdAt });
        await recordVerifiedPayment(input.publicId, input.signature);
        return { ok: true };
      } catch (error) {
        marketError(error);
      }
    }),
  createSellerOffer: publicProcedure
    .input(z.object({ wallet, profileHandle: z.string().trim().min(1).max(80), vouchBand: band, quantity: z.number().int().positive().max(1_000_000), pricePerVouch: z.number().positive().max(10_000), proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_offer" });
        return await createSellerOffer({ sellerWallet: input.wallet, profileHandle: input.profileHandle.replace(/^@/, ""), vouchBand: input.vouchBand, quantity: input.quantity, pricePerVouch: input.pricePerVouch });
      } catch (error) {
        marketError(error);
      }
    }),
  fillRequest: publicProcedure
    .input(z.object({ requestPublicId: z.string().startsWith("REQ-"), wallet, profileHandle: z.string().trim().min(1).max(80), quantity: z.number().int().positive(), proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_fill" });
        return await fillRequest({ requestPublicId: input.requestPublicId, sellerWallet: input.wallet, profileHandle: input.profileHandle.replace(/^@/, ""), quantity: input.quantity });
      } catch (error) {
        marketError(error);
      }
    }),
  markBuyerDone: publicProcedure
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
  markSellerDone: publicProcedure
    .input(z.object({ publicId: z.string().startsWith("FILL-"), wallet, proof }))
    .mutation(async ({ input }) => {
      try {
        await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_done" });
        await markSellerDone(input.publicId, input.wallet);
        return { ok: true };
      } catch (error) {
        marketError(error);
      }
    }),
  cancelRequest: publicProcedure
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
