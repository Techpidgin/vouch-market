import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { createMarketProject, getOperations, recordPayoutDecision } from "../market/db";
import { verifyWalletChallenge } from "../market/walletProof";
import { runMarketArchive } from "../market/archive";

const wallet = z.string().trim().min(32).max(64);
const proof = z.object({ challengeId: z.string().min(8), signature: z.string().min(20) });

function assertConfiguredAdminWallet(candidate: string) {
  const configured = process.env.SOLANA_RECIPIENT_WALLET;
  if (!configured || candidate !== configured) throw new TRPCError({ code: "FORBIDDEN", message: "Connect the configured administrator wallet to continue" });
}

async function verifyAdminWallet(input: { wallet: string; proof: { challengeId: string; signature: string } }) {
  assertConfiguredAdminWallet(input.wallet);
  await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "admin_access" });
}

export const adminRouter = router({
  operations: adminProcedure
    .input(z.object({ wallet, proof }))
    .mutation(async ({ input }) => {
      await verifyAdminWallet(input);
      return getOperations();
    }),
  createProject: adminProcedure
    .input(z.object({ wallet, proof, slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(2).max(64), name: z.string().trim().min(2).max(120), description: z.string().trim().max(800).optional() }))
    .mutation(async ({ input }) => {
      await verifyAdminWallet(input);
      return createMarketProject({ slug: input.slug, name: input.name, description: input.description });
    }),
  archiveEligible: adminProcedure
    .input(z.object({ wallet, proof }))
    .mutation(async ({ input }) => {
      await verifyAdminWallet(input);
      return runMarketArchive();
    }),
  recordPayout: adminProcedure
    .input(z.object({ commitmentPublicId: z.string().regex(/^(FILL|ASK)-/), status: z.enum(["sent", "withheld"]), externalReference: z.string().trim().max(160).optional(), adminNote: z.string().trim().max(1000).optional(), wallet, proof }))
    .mutation(async ({ ctx, input }) => {
      try {
        await verifyAdminWallet(input);
        await recordPayoutDecision({ ...input, adminOpenId: ctx.user.openId });
        return { ok: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Payout record could not be saved" });
      }
    }),
});
