import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");

describe("social-card owner controls", () => {
  it("renders download and share controls only for the connected wallet that owns a leaderboard row", () => {
    expect(marketSource).toContain("const ownsSocialCard");
    expect(marketSource).toContain("walletsMatch(wallet, entry.wallet)");
    expect(marketSource).toContain("ownsSocialCard(entry) ?");
    expect(marketSource).toContain("runOwnedSocialCardAction");
    expect(marketSource).toContain("Only the wallet that owns this card can download or share it.");
  });
});
