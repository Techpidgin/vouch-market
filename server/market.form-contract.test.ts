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
});
