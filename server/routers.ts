import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { marketRouter } from "./routers/market";

export const appRouter = router({
  system: systemRouter,
  market: marketRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
