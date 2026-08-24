import { createVouchApp } from "../_core/app";

// Built into api/trpc/[...path].js before Vercel deploys. Bundling local imports
// avoids Vercel Node ESM resolving server TypeScript modules at runtime.
export default createVouchApp();
