import { createVouchApp } from "../../server/_core/app";

// Vercel traces this source entry and its imports during deployment. Keeping the
// handler in TypeScript removes the separate generated bundle and its stale
// runtime import path.
export default createVouchApp();
