import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.resolve(process.cwd(), "client/src/pages/ArcMarket.tsx"), "utf8");

describe("Arc Testnet market page", () => {
  it("keeps real transaction controls testnet-only and deployment-gated", () => {
    expect(page).toContain("ARC TESTNET · ESCROW MARKET");
    expect(page).toContain("getArcEscrowAddress");
    expect(page).toContain("Faucet tokens only.");
    expect(page).toContain("disabled={!props.wallet || props.busy || !props.escrow}");
  });

  it("presents point exchanges and Bounty reward funding from the user Arc wallet", () => {
    expect(page).toContain("Point exchange");
    expect(page).toContain("Create a Bounty");
    expect(page).toContain("Fund Arc Bounty");
    expect(page).toContain("createArcPointExchange");
    expect(page).toContain("createArcTask");
    expect(page).toContain("HANKA never requests your private key or seed phrase.");
  });

  it("renders only real open Bounties read from the public contract", () => {
    expect(page).toContain("getArcOpenBounties");
    expect(page).toContain("no sample Bounties are invented.");
    expect(page).toContain("No matching funded Bounties.");
  });

  it("includes onchain post-funding actions while keeping the contract as the settlement source of truth", () => {
    expect(page).toContain("Confirm &amp; accept Bounty");
    expect(page).toContain("Submit delivery");
    expect(page).toContain("Release reward");
    expect(page).toContain("Dispute");
    expect(page).toContain("Payout authority remains with the onchain contract.");
  });
});
