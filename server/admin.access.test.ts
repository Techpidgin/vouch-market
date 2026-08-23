import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("administrator operations access", () => {
  it("blocks a non-administrator before operations records are queried", async () => {
    const ctx = {
      user: {
        id: 2,
        openId: "regular-user",
        name: "Regular User",
        email: null,
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;

    await expect(appRouter.createCaller(ctx).admin.operations()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
