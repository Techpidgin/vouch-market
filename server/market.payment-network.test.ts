import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const assetsSource = readFileSync(resolve(process.cwd(), "client/src/lib/brandAssets.ts"), "utf8");

describe("payment network selector", () => {
  it("opens from Connect with USDC on Solana live and USDC on Arc EVM testnet", () => {
    expect(assetsSource).toContain("USDC_MARK_URL");
    expect(assetsSource).toContain("ARC_MARK_URL");
    expect(marketSource).toContain("PaymentRailPopover");
    expect(marketSource).toContain("setPaymentRailOpen(true)");
    expect(marketSource).toContain("selectPaymentRail");
    expect(marketSource).toContain("USDC · Solana");
    expect(marketSource).toContain("USDC · Arc EVM");
    expect(marketSource).toContain("Testnet");
    expect(marketSource).toContain("paymentNetwork !== \"solana_usdc\"");
    expect(marketSource).toContain("Arc EVM USDC is testnet-only.");
    expect(marketSource).not.toContain("PaymentNetworkDock");
  });
});
