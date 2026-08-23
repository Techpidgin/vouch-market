import { describe, expect, it } from "vitest";
import { removeArchiveMetadata } from "./visibility";

describe("public market archive visibility", () => {
  it("excludes archived entries from the public market result", () => {
    const visible = removeArchiveMetadata([
      { publicId: "REQ-LIVE", archivedAt: null },
      { publicId: "REQ-ARCHIVED", archivedAt: new Date("2026-08-23T10:00:00.000Z") },
    ]);

    expect(visible).toEqual([{ publicId: "REQ-LIVE" }]);
  });
});
