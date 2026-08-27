import { describe, expect, it } from "vitest";
import { buildArcSocialBountyTerms, normalizeArcHandle } from "../shared/arcBountyTerms";

describe("Arc social-Bounty terms", () => {
  it("normalizes the public target and makes social-proof obligations part of the committed terms", () => {
    const terms = buildArcSocialBountyTerms({
      projectSlug: " CommonsMade ",
      instrument: "vouch",
      targetHandle: "@Target_Handle",
      proofDetail: "  Complete  a  vouch   from the named source. ",
      retentionDays: 30,
    });
    expect(normalizeArcHandle("@Target_Handle")).toBe("target_handle");
    expect(terms).toContain("Project: commonsmade");
    expect(terms).toContain("Proof: vouch");
    expect(terms).toContain("Target: @target_handle");
    expect(terms).toContain("Scope: Complete a vouch from the named source.");
    expect(terms).toContain("Retention: 30 days");
    expect(terms).toContain("Reward is held by the HANKA Arc Testnet contract");
  });
});
