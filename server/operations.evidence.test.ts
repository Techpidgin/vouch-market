import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceTable } from "../client/src/pages/Operations";

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
});
