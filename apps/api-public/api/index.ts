/**
 * Vercel entrypoint for `apps/api-public`.
 *
 * `vercel.json` rewrites every path here, so this one function serves the whole `/v1` surface
 * and routing stays where it already is, in `dispatch`. The handler is built once per warm
 * instance rather than per request: `createProductionHandlerDeps` opens the Postgres pool, and
 * rebuilding it per invocation would open a pool per request.
 *
 * Imports point at `../dist` on purpose. `tsconfig.json` scopes the package to `src/**`, so a
 * file here is outside it, and importing source would make Vercel's bundler re-typecheck the
 * whole tree under its own defaults — which reports errors `pnpm typecheck` does not, because
 * it is using different options. Consuming built output keeps one compiler in charge of types.
 * `buildCommand` produces `dist/` before this is bundled.
 *
 * `../src/main.ts` remains the entrypoint for a long-lived listener. Both call the same
 * `createPublicApiRequestHandler`, so neither host can drift from the other; that pairing is
 * asserted in `src/http/request-handler.test.ts`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createProductionHandlerDeps } from '../dist/http/compose.js';
import { createPublicApiRequestHandler } from '../dist/http/server.js';

const handler = createPublicApiRequestHandler(createProductionHandlerDeps());

export default function (req: IncomingMessage, res: ServerResponse): void {
  handler(req, res);
}
