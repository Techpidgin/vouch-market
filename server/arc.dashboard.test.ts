import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(path.resolve(process.cwd(), "client/src/lib/arcTestnet.ts"), "utf8");
const contractSource = readFileSync(path.resolve(process.cwd(), "contracts/src/HankaArcEscrow.sol"), "utf8");
const dashboardSource = readFileSync(path.resolve(process.cwd(), "client/src/pages/ArcDashboard.tsx"), "utf8");

describe("Arc wallet dashboard discovery", () => {
  it("uses bounded, read-only onchain discovery and filters records to the connected wallet", () => {
    expect(contractSource).toContain("function pointExchangeCount() external view returns (uint256)");
    expect(contractSource).toContain("function taskCount() external view returns (uint256)");
    expect(clientSource).toContain("Math.min(Number(count), 300)");
    expect(clientSource).toContain("walletMatches(record.maker, wallet) || walletMatches(record.taker, wallet)");
    expect(clientSource).toContain("walletMatches(record.requester, wallet) || walletMatches(record.taker, wallet)");
  });

  it("maps active and completed state labels for point exchanges and tasks", () => {
    expect(clientSource).toContain('"Open", "Funded", "Disputed", "Settled", "Declined", "Cancelled"');
    expect(clientSource).toContain('"Open", "Accepted", "Submitted", "Disputed", "Paid", "Cancelled"');
  });

  it("renders separate wallet-owned active and completed exchange and task ledgers", () => {
    expect(dashboardSource).toContain("getArcWalletDashboard");
    expect(dashboardSource).toContain("Only records where your connected EVM wallet");
    expect(dashboardSource).toContain("Active exchanges");
    expect(dashboardSource).toContain("Completed exchanges");
    expect(dashboardSource).toContain("Point exchanges");
    expect(dashboardSource).toContain("Task escrows");
  });
});
