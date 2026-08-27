import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.resolve(process.cwd(), "client/src/pages/ArcMarket.tsx"), "utf8");

describe("Arc Testnet market page", () => {
  it("keeps real transaction controls testnet-only and deployment-gated", () => {
    expect(page).toContain("Arc Testnet · Contract market");
    expect(page).toContain("getArcEscrowAddress");
    expect(page).toContain("Awaiting reviewed contract");
    expect(page).toContain("disabled={!wallet || busy || !escrowAddress}");
  });

  it("presents point exchanges and Bounty reward funding from the user Arc wallet", () => {
    expect(page).toContain("Point exchange");
    expect(page).toContain("Open Bounties");
    expect(page).toContain("Fund Bounty reward");
    expect(page).toContain("createArcPointExchange");
    expect(page).toContain("createArcTask");
    expect(page).toContain("No seed phrase or private key is shared with HANKA.");
  });

  it("renders only real open Bounties read from the public contract", () => {
    expect(page).toContain("getArcOpenBounties");
    expect(page).toContain("No demo tasks are shown.");
    expect(page).toContain("No open Bounties found.");
  });

  it("includes onchain post-funding actions while keeping the contract as the settlement source of truth", () => {
    expect(page).toContain("Accept &amp; lock collateral");
    expect(page).toContain("Approve settlement");
    expect(page).toContain("Maker decline");
    expect(page).toContain("Submit delivery hash");
    expect(page).toContain("Approve payout");
    expect(page).toContain("Open dispute");
    expect(page).toContain("The contract is the source of truth");
  });
});
