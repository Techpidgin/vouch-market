import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const assetsSource = readFileSync(resolve(process.cwd(), "client/src/lib/brandAssets.ts"), "utf8");

describe("payment network selector", () => {
  it("makes Arc the connected-wallet primary path while retaining Solana manual OTC as an alternative", () => {
    expect(assetsSource).toContain("USDC_MARK_URL");
    expect(assetsSource).toContain("ARC_MARK_URL");
    expect(marketSource).toContain("PaymentRailPopover");
    expect(marketSource).toContain("setPaymentRailOpen(true)");
    expect(marketSource).toContain("onSelectArc");
    expect(marketSource).toContain("selectSolanaRail");
    expect(marketSource).toContain("USDC · Solana");
    expect(marketSource).toContain("USDC · Arc EVM");
    expect(marketSource).toContain("Testnet contract market");
    expect(marketSource).toContain("Alternative market");
    expect(marketSource).toContain("connectArcWallet");
    expect(marketSource).toContain("sendArcManualOtcUsdc");
    expect(marketSource).toContain("Bounty &amp; point escrow");
    expect(marketSource.indexOf("USDC · Arc EVM")).toBeLessThan(marketSource.indexOf("USDC · Solana"));
    expect(marketSource).not.toContain("PaymentNetworkDock");
    expect(marketSource).not.toContain("Solana USDC is the active settlement rail.");
  });
});
