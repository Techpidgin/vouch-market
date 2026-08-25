import { describe, expect, it } from "vitest";
import { MARKET_INSTRUMENTS, instrumentLabel, isSpaceInstrument } from "./constants";
import { createExactMarketIntent } from "./instrumentLifecycle";
import { allocationKey } from "./rules";

describe("HANKA social-proof catalogue", () => {
  it("supports the requested marketable proof types", () => {
    expect(MARKET_INSTRUMENTS.map(item => item.value)).toEqual(expect.arrayContaining([
      "vouch", "slash", "follow", "repost", "comment", "space_listener", "space_speaker", "space_contributor",
    ]));
    expect(instrumentLabel("comment")).toBe("x comment");
    expect(isSpaceInstrument("space_speaker")).toBe(true);
    expect(isSpaceInstrument("repost")).toBe(false);
  });

  it("retains exact-unit and source-target uniqueness rules for every new proof type", () => {
    expect(createExactMarketIntent("space_contributor", 1)).toEqual({ instrument: "space_contributor", quantity: 1 });
    expect(allocationKey({ sourceHandle: "HostOne", targetHandle: "TargetOne", projectSlug: "commonsmade", instrument: "repost" }))
      .toBe("commonsmade:repost:hostone:targetone");
    expect(() => allocationKey({ sourceHandle: "HostOne", targetHandle: "@HostOne", projectSlug: "commonsmade", instrument: "comment" }))
      .toThrow("cannot allocate social proof to itself");
  });
});
