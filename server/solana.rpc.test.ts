import { describe, expect, it } from "vitest";

describe("Solana RPC configuration", () => {
  it("reaches the configured RPC endpoint", async () => {
    const rpcUrl = process.env.SOLANA_RPC_URL;

    expect(rpcUrl, "SOLANA_RPC_URL must be configured").toBeTruthy();

    const response = await fetch(rpcUrl!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "vouch-market-health-check",
        method: "getHealth",
      }),
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { result?: string; error?: unknown };
    expect(payload.error).toBeUndefined();
    expect(payload.result).toBe("ok");
  }, 15_000);

  it("accepts the configured recipient wallet", async () => {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const recipientWallet = process.env.SOLANA_RECIPIENT_WALLET;

    expect(rpcUrl, "SOLANA_RPC_URL must be configured").toBeTruthy();
    expect(recipientWallet, "SOLANA_RECIPIENT_WALLET must be configured").toBeTruthy();

    const response = await fetch(rpcUrl!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "vouch-market-recipient-check",
        method: "getBalance",
        params: [recipientWallet, { commitment: "finalized" }],
      }),
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { result?: { value?: number }; error?: unknown };
    expect(payload.error).toBeUndefined();
    expect(typeof payload.result?.value).toBe("number");
  }, 15_000);
});
