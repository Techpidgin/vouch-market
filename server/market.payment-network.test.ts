import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const assetsSource = readFileSync(resolve(process.cwd(), "client/src/lib/brandAssets.ts"), "utf8");

describe("payment network selector", () => {
  it("shows Arc first as a disabled Mainnet-soon preview and keeps Solana as the only Connect action", () => {
    expect(assetsSource).toContain("USDC_MARK_URL");
    expect(assetsSource).toContain("ARC_MARK_URL");
    expect(marketSource).toContain("PaymentRailPopover");
    expect(marketSource).toContain("setPaymentRailOpen(true)");
    expect(marketSource).toContain("selectSolanaRail");
    expect(marketSource).toContain("USDC · Solana");
    expect(marketSource).toContain("USDC · Arc EVM");
    expect(marketSource).toContain("Mainnet soon");
    expect(marketSource).toContain("disabled aria-disabled=\"true\"");
    expect(marketSource.indexOf("USDC · Arc EVM")).toBeLessThan(marketSource.indexOf("USDC · Solana"));
    expect(marketSource).not.toContain("PaymentNetworkDock");
    expect(marketSource).not.toContain("Solana USDC is the active settlement rail.");
  });
});
