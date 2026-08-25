import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const marketSource = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const themeTogglePath = resolve(process.cwd(), "client/src/components/ThemeToggle.tsx");

describe("public market branding", () => {
  it("removes CommonsMade-specific public marketing copy while retaining the actual project selector", () => {
    expect(homeSource).not.toContain("CommonsMade first");
    expect(homeSource).not.toContain("Compatible projects next");
    expect(homeSource).not.toContain("buying and selling CommonsMade vouches and slashes");
    expect(marketSource).not.toContain("Commons market");
    expect(marketSource).not.toContain("A single market ledger for CommonsMade vouches and slashes");
    expect(marketSource).not.toContain("Vouch Market · CommonsMade first");
  });

  it("keeps terms and operations in footers and uses an intentional responsive landing hero", () => {
    expect(homeSource).toContain('href="/market#terms"');
    expect(homeSource).toContain('href="/ops"');
    expect(marketSource).toContain('href="#terms"');
    expect(marketSource).toContain('href="/ops"');
    expect(homeSource).toContain("text-[clamp(4.1rem,11vw,8.6rem)]");
    expect(homeSource).toContain("lg:grid-cols-[1.08fr_.92fr]");
  });

  it("uses the HANKA product identity and positions the market for an expanded social-proof catalogue", () => {
    const documentSource = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(documentSource).toContain("HANKA Vouch &amp; Slash Market");
    expect(homeSource).toContain("HANKA · Social proof exchange");
    expect(homeSource).toContain("follows, reposts, comments, and X Space participation");
    expect(homeSource).toContain("HANKA Social Proof Market · USDC on Solana");
    expect(marketSource).toContain("HANKA · Open market");
    expect(marketSource).toContain("HANKA Social Proof Market · USDC on Solana");
  });

  it("keeps the public product dark-only and lets each catalogue card open its matching proof market", () => {
    expect(appSource).not.toContain("switchable");
    expect(existsSync(themeTogglePath)).toBe(false);
    expect(homeSource).toContain("?proof=${instrument}#market");
    expect(homeSource).toContain("Browse market");
  });

  it("uses the supplied Ethos mark alongside every public Ethos vouch and slash product identity", () => {
    expect(homeSource).toContain('/manus-storage/ethos-logo_194cfccc.jpeg');
    expect(marketSource).toContain('/manus-storage/ethos-logo_194cfccc.jpeg');
    expect(homeSource).toContain('EthosMark className="proof-icon"');
    expect(marketSource).toContain("InstrumentGlyph instrument={instrument}");
  });
});
