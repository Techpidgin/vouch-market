import { describe, expect, it } from "vitest";
import { ARC_TESTNET_TOKENS, hankaArcTestnet, toTokenUnits } from "../client/src/lib/arcTestnet";

describe("Arc Testnet wallet configuration", () => {
  it("uses Arc Testnet’s official network values and only its verified test tokens", () => {
    expect(hankaArcTestnet.id).toBe(5_042_002);
    expect(hankaArcTestnet.rpcUrls.default.http).toContain("https://rpc.testnet.arc.io");
    expect(ARC_TESTNET_TOKENS).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "USDC", address: "0x3600000000000000000000000000000000000000", decimals: 6 }),
      expect.objectContaining({ symbol: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 }),
      expect.objectContaining({ symbol: "cirBTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" }),
    ]));
  });

  it("converts settlement input to the selected token’s native units without native-USDC precision mixing", () => {
    expect(toTokenUnits("50", 6)).toBe(BigInt("50000000"));
    expect(toTokenUnits("0.000001", 6)).toBe(BigInt(1));
    expect(() => toTokenUnits("1.0000001", 6)).toThrow("at most 6 decimal places");
  });
});
