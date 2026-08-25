import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const database = readFileSync(resolve(process.cwd(), "server/market/db.ts"), "utf8");
const marketRouter = readFileSync(resolve(process.cwd(), "server/routers/market.ts"), "utf8");
const marketUi = readFileSync(resolve(process.cwd(), "client/src/components/MarketHome.tsx"), "utf8");
const operationsUi = readFileSync(resolve(process.cwd(), "client/src/pages/Operations.tsx"), "utf8");
const landingUi = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("wallet-linked customer support", () => {
  it("stores only signed wallet-linked messages for private operator review", () => {
    expect(schema).toContain('export const supportMessages = pgTable');
    expect(schema).toContain('wallet: varchar("wallet", { length: 64 }).notNull()');
    expect(database).toContain("export async function createSupportMessage");
    expect(marketRouter).toContain('action: "support_message"');
    expect(marketRouter).toContain("verifyWalletChallenge");
  });

  it("offers public submission but exposes message contents only in the operator desk", () => {
    expect(marketUi).toContain("Send support message");
    expect(marketUi).toContain("Customer support");
    expect(landingUi).toContain('/market?support=1#support');
    expect(operationsUi).toContain("Wallet messages");
    expect(operationsUi).toContain("No customer messages yet.");
  });
});
