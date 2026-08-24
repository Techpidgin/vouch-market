import type { IncomingMessage, ServerResponse } from "node:http";
import { createVouchApp } from "../../server/_core/app";

// Vercel traces this source entry and its imports during deployment. The
// explicit Node request handler keeps the runtime contract unambiguous while
// avoiding a generated bundle or a second API route.
const app = createVouchApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as never, res as never);
}
