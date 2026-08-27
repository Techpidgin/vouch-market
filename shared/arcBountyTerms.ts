export const ARC_SOCIAL_INSTRUMENTS = [
  "vouch",
  "slash",
  "follow",
  "repost",
  "comment",
  "space_listener",
  "space_speaker",
  "space_contributor",
  "hanka_points",
] as const;

export type ArcSocialInstrument = (typeof ARC_SOCIAL_INSTRUMENTS)[number];

export type ArcSocialBountyTermsInput = {
  projectSlug: string;
  instrument: ArcSocialInstrument;
  targetHandle: string;
  proofDetail?: string | null;
  spaceMinutes?: number | null;
  retentionDays: number;
};

export function normalizeArcHandle(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function normalizeArcTermsText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * This exact canonical text is hashed into the onchain task termsHash. It binds
 * public social-proof metadata to the funded Arc Bounty without writing private
 * brief details or delivery evidence to the contract.
 */
export function buildArcSocialBountyTerms(input: ArcSocialBountyTermsInput) {
  const proofDetail = normalizeArcTermsText(input.proofDetail ?? "");
  const spaceMinutes = input.spaceMinutes ? `${input.spaceMinutes} minutes` : "n/a";
  return [
    "HANKA Arc Testnet social-proof Bounty",
    `Project: ${normalizeArcTermsText(input.projectSlug).toLowerCase()}`,
    `Proof: ${input.instrument}`,
    `Target: @${normalizeArcHandle(input.targetHandle)}`,
    `Scope: ${proofDetail || "standard proof action"}`,
    `Space duration: ${spaceMinutes}`,
    `Retention: ${input.retentionDays} days`,
    "One source completes one proof action for the named target.",
    "Reward is held by the HANKA Arc Testnet contract and releases only through its Bounty lifecycle.",
  ].join("\n");
}
