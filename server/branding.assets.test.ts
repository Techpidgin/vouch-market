import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("HANKA brand assets", () => {
  const root = process.cwd();

  it("ships the four-cell favicon and declares it in the document head", () => {
    const favicon = resolve(root, "client/public/favicon.svg");
    expect(existsSync(favicon)).toBe(true);
    expect(readFileSync(favicon, "utf8")).toContain('viewBox="0 0 64 64"');
    expect(readFileSync(resolve(root, "client/index.html"), "utf8")).toContain('href="/favicon.svg"');
  });

  it("keeps brand motion and sheen styles behind the reduced-motion media query", () => {
    const styles = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    expect(styles).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styles).toContain(".brand-mark");
    expect(styles).toContain("home-sheen");
  });
});

  it("uses the uploaded Phantom mark in wallet-connect controls", () => {
    const market = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
    expect(market).toContain("/phantomwallettt.png");
    expect(market).toContain("function PhantomMark");
    expect(market).toContain("<PhantomMark");
    expect(market).toContain("/kaitopng.png");
    const proxy = readFileSync(resolve(process.cwd(), "api/manus-storage/[...path].js"), "utf8");
    expect(proxy).toContain("kaito-mark_bfc88d67.png");
    expect(proxy).toContain("phantom-wallet_25796a99.png");
    expect(market).toContain("Platform scores");
  });
