import { createVouchApp } from "../_core/app";

// This source is bundled into one CommonJS Vercel function during the build.
// It prevents the Vercel runtime from resolving TypeScript server modules at
// request time and leaves HANKA with exactly one tRPC API entry point.
export default createVouchApp();
