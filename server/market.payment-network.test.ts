import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const assetsSource = readFileSync(resolve(process.cwd(), "client/src/lib/brandAssets.ts"), "utf8");

describe("payment network selector", () => {
  it("offers Solana USDC live settlement and an explicitly testnet-only Arc EVM USDT preview", () => {
    expect(assetsSource).toContain("USDC_MARK_URL");
    expect(assetsSource).toContain("ARC_MARK_URL");
    expect(marketSource).toContain("PaymentNetworkDock");
    expect(marketSource).toContain("Solana · USDC");
    expect(marketSource).toContain("Arc EVM · USDT");
    expect(marketSource).toContain("Testnet");
    expect(marketSource).toContain('paymentNetwork === "arc_usdt_testnet"');
    expect(marketSource).toContain("Select Solana USDC to settle a live order.");
  });
});
