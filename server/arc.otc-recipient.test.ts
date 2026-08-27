import { isAddress } from "viem";
import { describe, expect, it } from "vitest";

const recipient = process.env.VITE_ARC_OTC_RECIPIENT_ADDRESS;

describe("Arc Testnet manual OTC recipient", () => {
  it("is a valid public EVM address reachable through the Arc Testnet RPC", async () => {
    expect(recipient).toBeTruthy();
    expect(isAddress(recipient ?? "")).toBe(true);

    const response = await fetch("https://rpc.testnet.arc.io", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [recipient, "latest"] }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json() as { result?: string; error?: unknown };
    expect(response.ok).toBe(true);
    expect(payload.error).toBeUndefined();
    expect(payload.result).toMatch(/^0x[0-9a-f]+$/i);
  }, 15_000);
});
