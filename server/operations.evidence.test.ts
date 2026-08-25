import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceTable, SupportInbox } from "../client/src/pages/Operations";

describe("private operations payment evidence", () => {
  it("renders source-to-target account reconciliation for a completed allocation", () => {
    const html = renderToStaticMarkup(createElement(EvidenceTable, {
      records: [{
        publicId: "ASK-ALLOCATION",
        sourceHandle: "maker_one",
        targetHandle: "buyer_one",
        instrument: "vouch",
        quantity: 1,
        pointsPerUnit: 12000,
        status: "under_review",
        grossUsdc: "0.520000",
        paymentSignature: "proof",
      }],
    }));

    expect(html).toContain("Accounts");
    expect(html).toContain("@maker_one → @buyer_one");
    expect(html).toContain("Points / unit");
    expect(html).toContain("12,000 points per unit");
  });

  it("renders wallet-linked customer messages for an authorized operator", () => {
    const html = renderToStaticMarkup(createElement(SupportInbox, {
      messages: [{
        publicId: "SUP-HELLO",
        wallet: "6SaEG13gzLSkYnam6gRkM2NGRctVLL5JZ9vEi5MgGydd",
        subject: "Listing question",
        message: "I need help with my source account.",
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
      }],
    }));

    expect(html).toContain("Wallet messages");
    expect(html).toContain("Listing question");
    expect(html).toContain("I need help with my source account.");
    expect(html).toContain("6SaE…Gydd");
  });
});
