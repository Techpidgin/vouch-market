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
  title: string;
  summary: string;
  deliverables: string[];
  projectSlug: string;
  instrument: ArcSocialInstrument;
  targetHandle: string;
  proofDetail?: string | null;
  spaceMinutes?: number | null;
  retentionDays: number;
  featuredToken?: string | null;
  location?: string | null;
  verificationMethod?: string | null;
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
  const title = normalizeArcTermsText(input.title);
  const summary = normalizeArcTermsText(input.summary);
  const deliverables = input.deliverables.map(normalizeArcTermsText).filter(Boolean);
  const proofDetail = normalizeArcTermsText(input.proofDetail ?? "");
  const spaceMinutes = input.spaceMinutes ? `${input.spaceMinutes} minutes` : "n/a";
  const featuredToken = normalizeArcTermsText(input.featuredToken ?? "") || "none";
  const location = normalizeArcTermsText(input.location ?? "") || "not specified";
  const verification = normalizeArcTermsText(input.verificationMethod ?? "") || "onchain delivery commitment";
  return [
    "HANKA Arc Testnet social-proof Bounty",
    `Title: ${title}`,
    `Summary: ${summary}`,
    `Deliverables: ${deliverables.map((item, index) => `${index + 1}. ${item}`).join(" | ")}`,
    `Project: ${normalizeArcTermsText(input.projectSlug).toLowerCase()}`,
    `Proof: ${input.instrument}`,
    `Target: @${normalizeArcHandle(input.targetHandle)}`,
    `Scope: ${proofDetail || "standard proof action"}`,
    `Space duration: ${spaceMinutes}`,
    `Retention: ${input.retentionDays} days`,
    "Winners: 1 (current Arc Testnet contract limit)",
    `Featured token: ${featuredToken}`,
    `Location: ${location}`,
    `Verification: ${verification}`,
    "Safety attestation: no illegal, exploitative, prohibited, or misrepresented work is requested.",
    "One source completes one proof action for the named target.",
    "Reward is held by the HANKA Arc Testnet contract and releases only through its Bounty lifecycle.",
  ].join("\n");
}
