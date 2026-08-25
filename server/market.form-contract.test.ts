import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketFormSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");

describe("market form contract", () => {
  it("sends a validated numeric points-per-unit value for seller listings and fills", () => {
    expect(marketFormSource).toContain('name="pointsPerUnit"');
    expect(marketFormSource).toContain("pointsPerUnit: unitPoints");
    expect(marketFormSource).not.toContain("pointsPerUnit: Number(pointsPerUnit)");
    expect(marketFormSource).toContain("Enter the actual whole-number signal value carried by one");
  });

  it("explains the target and source X-account roles where participants enter them", () => {
    expect(marketFormSource).toContain("The account that should receive this");
    expect(marketFormSource).toContain("The account that will deliver this");
    expect(marketFormSource).toContain("different from your connected wallet");
  });

  it("keeps public form surfaces in the dark marketplace system and exposes market price guidance", () => {
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(styles).toContain('[data-slot="dialog-content"]');
    expect(styles).toContain("background: #0c130f !important");
    expect(marketFormSource).toContain("MarketPriceGuide");
  });

  it("surfaces seller credibility inputs and Kaito branding without presenting them as verified facts", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    expect(marketFormSource).toContain("kaito-mark_bfc88d67.png");
    expect(marketFormSource).toContain("followerCount");
    expect(marketFormSource).toContain("ethosScore");
    expect(marketFormSource).toContain("kaitoScore");
    expect(marketFormSource).toContain("seller-declared source metrics");
    expect(marketFormSource).toContain("<Credibility row={row}");
    expect(schema).toContain("followerCount: integer");
    expect(schema).toContain("ethosScore: integer");
    expect(schema).toContain("kaitoScore: integer");
  });

  it("uses the requested Vouch vocabulary and sharp HANKA marketplace control system", () => {
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(marketFormSource).toContain('label: "Ethos vouch"');
    expect(marketFormSource).not.toContain('label: "Ethos voucher"');
    expect(styles).toContain('border-radius: 0 !important');
    expect(styles).toContain('animation: home-sheen 4.2s');
    expect(styles).toContain('--primary: oklch(0.86 0.11 151)');
  });
});
