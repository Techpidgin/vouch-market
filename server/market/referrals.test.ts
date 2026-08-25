import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEADERBOARD_MAX_ENTRIES, REFERRAL_DIRECT_LIMIT, REFERRAL_REWARDS } from "./constants";

describe("wallet referrals and HANKA Points", () => {
  it("keeps the direct referral allowance capped and reward amounts explicit", () => {
    expect(REFERRAL_DIRECT_LIMIT).toBe(10);
    expect(LEADERBOARD_MAX_ENTRIES).toBe(100);
    expect(REFERRAL_REWARDS.directJoin).toBeGreaterThan(0);
    expect(REFERRAL_REWARDS.levelTwoJoin).toBeGreaterThan(0);
    expect(REFERRAL_REWARDS.sellerListing).toBeGreaterThan(0);
    expect(REFERRAL_REWARDS.buyerPurchase).toBeGreaterThan(0);
  });

  it("keeps referrals wallet-signed and leaderboard output capped", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers/market.ts"), "utf8");
    const referrals = readFileSync(resolve(process.cwd(), "server/market/referrals.ts"), "utf8");
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const client = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
    expect(router).toContain("action: \"referral_join\"");
    expect(router).toContain("verifyWalletChallenge");
    expect(referrals).toContain("LEADERBOARD_MAX_ENTRIES");
    expect(referrals).toContain('process.env.NODE_ENV !== "production"');
    expect(referrals).toContain('throw new Error("Database is unavailable")');
    expect(referrals).toContain("directReferrals >= REFERRAL_DIRECT_LIMIT");
    expect(schema).toContain("referralProfiles");
    expect(schema).toContain("pointLedger");
    expect(schema).toContain("hanka_points");
    expect(client).toContain("HANKA Points network");
    expect(client).toContain("Top 100");
    expect(client).toContain('value: "hanka_points"');
    expect(client).toContain("downloadSocialCard");
    expect(client).toContain("completedSales");
    expect(client).toContain("completedPurchases");
    expect(client).toContain("referralCode");
    expect(client).toContain("KAITO AURA");
    expect(client).toContain("copyReferralLink");
    expect(client).toContain('image/png');
    expect(client).toContain('download = `hanka-top-');
    expect(client).toContain("Platform scores");
    expect(client).toContain("shareSocialCard");
    expect(client).toContain("shareOnX");
    expect(client).toContain("metricSort");
    expect(client).toContain("metricsVerifiedAt");
  });
});
