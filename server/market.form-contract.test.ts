import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const marketFormSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");

describe("market form contract", () => {
  it("sends a validated numeric points-per-unit value for seller listings and fills", () => {
    expect(marketFormSource).toContain('name="pointsPerUnit"');
    expect(marketFormSource).toContain("pointsPerUnit: unitPoints");
    expect(marketFormSource).not.toContain("pointsPerUnit: Number(pointsPerUnit)");
    expect(marketFormSource).toContain("Enter the actual whole-number points carried by one");
  });

  it("explains the target and source X-account roles where participants enter them", () => {
    expect(marketFormSource).toContain("The X account to be vouched or slashed");
    expect(marketFormSource).toContain("The X account that will give the vouch or slash");
    expect(marketFormSource).toContain("It may be different from your connected wallet’s own X account");
  });
});
