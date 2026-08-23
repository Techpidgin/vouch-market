import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getOperations, recordPayoutDecision } from "../market/db";

export const adminRouter = router({
  operations: adminProcedure.query(async () => getOperations()),
  recordPayout: adminProcedure
    .input(z.object({ commitmentPublicId: z.string().startsWith("FILL-"), status: z.enum(["sent", "withheld"]), externalReference: z.string().trim().max(160).optional(), adminNote: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await recordPayoutDecision({ ...input, adminOpenId: ctx.user.openId });
        return { ok: true };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Payout record could not be saved" });
      }
    }),
});
