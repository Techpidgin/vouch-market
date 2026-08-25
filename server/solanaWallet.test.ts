import { afterEach, describe, expect, it } from "vitest";
import { getMobileWalletLinks, getWalletOptions } from "../client/src/lib/solanaWallet";

type TestProvider = {
  isPhantom?: boolean;
  isBackpack?: boolean;
  isSolflare?: boolean;
  connect: () => Promise<{ publicKey: never }>;
  signMessage: () => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction: () => Promise<{ signature: string }>;
};

const provider = (flags: Partial<TestProvider> = {}): TestProvider => ({
  connect: async () => ({ publicKey: undefined as never }),
  signMessage: async () => ({ signature: new Uint8Array() }),
  signAndSendTransaction: async () => ({ signature: "test" }),
  ...flags,
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("Solana wallet discovery", () => {
  it("discovers named injected providers and removes duplicate provider references", () => {
    const phantom = provider({ isPhantom: true });
    const backpack = provider({ isBackpack: true });
    Object.assign(globalThis, { window: { phantom: { solana: phantom }, backpack: { solana: backpack }, solana: { providers: [phantom, backpack] } } });

    expect(getWalletOptions().map(option => option.label)).toEqual(["Phantom", "Backpack"]);
  });

  it("creates encoded mobile wallet handoff URLs for supported apps", () => {
    const links = getMobileWalletLinks("https://hanka.example/market?ref=HANKA%20ONE");
    expect(links.map(link => link.id)).toEqual(["phantom", "solflare", "backpack"]);
    expect(links[0].href).toContain("phantom.app/ul/browse/https%3A%2F%2Fhanka.example%2Fmarket%3Fref%3DHANKA%2520ONE");
    expect(links[1].href).toContain("solflare.com/ul/v1/browse/");
  });
});
