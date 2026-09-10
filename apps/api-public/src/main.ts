/**
 * Long-lived listener for `apps/api-public` (MOB-004 live wiring). Boots the real `node:http`
 * server on `PORT` with production `HandlerDeps` — Postgres `bb_public` reads when
 * `PUBLIC_DATA_SOURCE=postgres` + `DATABASE_URL`; see `http/README.md`.
 *
 * This is the entrypoint for local dev and any host that owns a port. The deployed host is
 * Vercel, which calls `api/index.ts` instead; both share `createPublicApiRequestHandler`.
 */
import { createProductionHandlerDeps } from './http/compose.js';
import { createPublicApiServer } from './http/server.js';

const DEFAULT_PORT = 8080;

function resolvePort(environment: Readonly<Record<string, string | undefined>>): number {
  const parsed = Number.parseInt(environment.PORT ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

export function main(): void {
  const port = resolvePort(process.env);
  const deps = createProductionHandlerDeps();
  const server = createPublicApiServer(deps);
  server.listen(port, () => {
    // Structured, secret-free startup line (no token/credential ever logged here).
    console.log(JSON.stringify({ event: 'api_public_listening', port }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
