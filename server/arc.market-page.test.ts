import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.resolve(process.cwd(), "client/src/pages/ArcMarket.tsx"), "utf8");

describe("Arc Testnet market page", () => {
  it("keeps real transaction controls testnet-only and deployment-gated", () => {
    expect(page).toContain("Arc Testnet · Smart-contract preview");
    expect(page).toContain("getArcEscrowAddress");
    expect(page).toContain("No verified contract configured");
    expect(page).toContain("disabled={!wallet || busy || !escrowAddress}");
  });

  it("presents both point-exchange and task-reward funding flows from the user wallet", () => {
    expect(page).toContain("Point exchange");
    expect(page).toContain("Task market");
    expect(page).toContain("createArcPointExchange");
    expect(page).toContain("createArcTask");
    expect(page).toContain("No seed phrase or private key is shared with HANKA.");
  });

  it("includes onchain post-funding actions while keeping the contract as the settlement source of truth", () => {
    expect(page).toContain("Accept &amp; lock equal collateral");
    expect(page).toContain("Approve matching settlement");
    expect(page).toContain("Maker decline");
    expect(page).toContain("Submit delivery hash");
    expect(page).toContain("Approve payout");
    expect(page).toContain("Open dispute");
    expect(page).toContain("The contract is the source of truth");
  });
});
