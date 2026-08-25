import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const walletSource = readFileSync(resolve(process.cwd(), "client/src/lib/solanaWallet.ts"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("mobile HANKA experience", () => {
  it("keeps thumb-friendly Buy, Sell, and Support actions available in a dedicated mobile dock", () => {
    expect(marketSource).toContain("MobileActionDock");
    expect(marketSource).toContain('aria-label="Quick market actions"');
    expect(marketSource).toContain("onBuy={() => setDialog(\"bid\")}");
    expect(marketSource).toContain("onSell={() => setDialog(\"ask\")}");
    expect(marketSource).toContain("onSupport={() => setDialog(\"support\")}");
  });

  it("uses compact touch controls, safe-area spacing, and immediate mobile market rendering", () => {
    expect(styles).toContain(".mobile-action-dock");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain("min-height: 3.1rem");
    expect(styles).toContain(".market-row { animation: none; }");
  });

  it("keeps the market hero underlay and mobile wallet fallback available", () => {
    expect(marketSource).toContain("market-hero-opera");
    expect(marketSource).toContain("opera-small_1fa074ba.png");
    expect(marketSource).toContain("mobileWalletLinks");
    expect(marketSource).toContain("Open HANKA inside a mobile wallet");
    expect(marketSource).toContain("walletOptions.length !== 1");
    expect(walletSource).toContain("window.phantom?.solana");
    expect(walletSource).toContain("getMobileWalletLinks");
    expect(walletSource).toContain("phantom.app/ul/browse");
    expect(walletSource).toContain("solflare.com/ul/v1/browse");
  });
});
