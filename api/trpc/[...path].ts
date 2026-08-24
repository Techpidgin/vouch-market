import { createVouchApp } from "../../server/_core/app";

// Vercel resolves this explicit nested catch-all before the SPA fallback.
// Express still receives the full /api/trpc path required by the tRPC adapter.
export default createVouchApp();
