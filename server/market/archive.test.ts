import { describe, expect, it } from "vitest";
import { buildArchiveSnapshot, sanitizeArchiveRecord } from "./archive";

describe("market archive snapshots", () => {
  it("creates a timestamped private-record snapshot payload", () => {
    const capturedAt = new Date("2026-08-23T10:00:00.000Z");
    const snapshot = JSON.parse(buildArchiveSnapshot("request", {
      publicId: "REQ-ARCHIVE",
      createdAt: new Date("2026-08-22T09:00:00.000Z"),
      archiveEligibleAt: new Date("2026-08-23T09:00:00.000Z"),
    }, capturedAt));

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      type: "request",
      publicId: "REQ-ARCHIVE",
      capturedAt: "2026-08-23T10:00:00.000Z",
    });
  });

  it("omits participant wallets and payment signatures from archive payloads", () => {
    const sanitized = sanitizeArchiveRecord({
      publicId: "REQ-PRIVATE",
      targetHandle: "commonsmade",
      sourceHandle: "maker_one",
      instrument: "slash",
      pointsPerUnit: 12000,
      status: "completed",
      buyerWallet: "wallet-that-must-not-be-archived",
      paymentSignature: "signature-that-must-not-be-archived",
      createdAt: new Date("2026-08-22T09:00:00.000Z"),
      archiveEligibleAt: new Date("2026-08-23T09:00:00.000Z"),
    });

    expect(sanitized).toMatchObject({ publicId: "REQ-PRIVATE", targetHandle: "commonsmade", sourceHandle: "maker_one", instrument: "slash", pointsPerUnit: 12000, status: "completed" });
    expect(sanitized).not.toHaveProperty("buyerWallet");
    expect(sanitized).not.toHaveProperty("paymentSignature");
  });
});
