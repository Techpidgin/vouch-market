import { isAddress } from "viem";
import { z } from "zod";
import { ARC_SOCIAL_INSTRUMENTS } from "../../shared/arcBountyTerms";
import { assertArcSocialSourceAvailable, listArcSocialBountyMetadata, registerArcSocialBounty, registerArcSocialBountySource } from "../market/arcBounties";
import { publicProcedure, rateLimitedPublicProcedure, router } from "../_core/trpc";

const evmWallet = z.string().trim().refine(isAddress, "Connect a valid Arc EVM wallet.");
const escrowAddress = z.string().trim().refine(isAddress, "Arc escrow address is invalid.");
const taskId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const socialTerms = z.object({
  title: z.string().trim().min(3).max(50),
  summary: z.string().trim().min(8).max(500),
  deliverables: z.array(z.string().trim().min(3).max(100)).min(1).max(10),
  projectSlug: z.string().trim().min(2).max(64).default("commonsmade"),
  instrument: z.enum(ARC_SOCIAL_INSTRUMENTS),
  targetHandle: z.string().trim().min(1).max(16).regex(/^@?[A-Za-z0-9_]+$/, "Enter a valid X handle."),
  proofDetail: z.string().trim().max(240).optional(),
  spaceMinutes: z.number().int().positive().max(720).optional(),
  retentionDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60), z.literal(90)]),
  featuredToken: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  verificationMethod: z.enum(["onchain_delivery_commitment", "manual_evidence_reference"]).optional(),
});

function assertConfiguredEscrow(input: string) {
  const configured = process.env.VITE_ARC_TESTNET_ESCROW_ADDRESS?.trim();
  if (!configured || !isAddress(configured) || configured.toLowerCase() !== input.toLowerCase()) {
    throw new Error("This Arc Bounty contract is not the configured HANKA Testnet escrow.");
  }
}

export const arcBountyRouter = router({
  metadata: publicProcedure
    .input(z.object({ contractAddress: escrowAddress }))
    .query(async ({ input }) => {
      assertConfiguredEscrow(input.contractAddress);
      return listArcSocialBountyMetadata(input.contractAddress);
    }),
  register: rateLimitedPublicProcedure
    .input(z.object({ contractAddress: escrowAddress, taskId, requesterWallet: evmWallet }).merge(socialTerms))
    .mutation(async ({ input }) => {
      assertConfiguredEscrow(input.contractAddress);
      return registerArcSocialBounty(input);
    }),
  canClaim: rateLimitedPublicProcedure
    .input(z.object({ contractAddress: escrowAddress, taskId, takerWallet: evmWallet, sourceHandle: z.string().trim().min(1).max(16).regex(/^@?[A-Za-z0-9_]+$/, "Enter a valid X handle.") }))
    .mutation(async ({ input }) => {
      assertConfiguredEscrow(input.contractAddress);
      return assertArcSocialSourceAvailable(input);
    }),
  registerSource: rateLimitedPublicProcedure
    .input(z.object({
      contractAddress: escrowAddress,
      taskId,
      takerWallet: evmWallet,
      sourceHandle: z.string().trim().min(1).max(16).regex(/^@?[A-Za-z0-9_]+$/, "Enter a valid X handle."),
      pointsPerUnit: z.number().int().positive().max(1_000_000_000),
      followerCount: z.number().int().nonnegative().max(10_000_000_000).optional(),
      ethosScore: z.number().int().nonnegative().max(10_000_000_000).optional(),
      kaitoScore: z.number().int().nonnegative().max(10_000_000_000).optional(),
      kaitoAura: z.number().int().nonnegative().max(10_000_000_000).optional(),
    }))
    .mutation(async ({ input }) => {
      assertConfiguredEscrow(input.contractAddress);
      return registerArcSocialBountySource(input);
    }),
});
