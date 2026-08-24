import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { assertConfiguredAdminWallet, configuredAdminWallets } from "./routers/admin";

const additionalWallet = "6SaEG13gzLSkYnam6gRkM2NGRctVLL5JZ9vEi5MgGydd";

describe("configured administrator wallets", () => {
  it("loads the user-provided additional operations wallet as a valid Solana public key", () => {
    expect(configuredAdminWallets()).toContain(additionalWallet);
    expect(new PublicKey(additionalWallet).toBase58()).toBe(additionalWallet);
    expect(() => assertConfiguredAdminWallet(additionalWallet)).not.toThrow();
  });
});
