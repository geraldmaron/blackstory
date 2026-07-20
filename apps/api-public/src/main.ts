/**
 * Cloud Run entrypoint for `apps/api-public` (MOB-004 live wiring). Boots the real `node:http`
 * server (`./http/server.ts`) with production `HandlerDeps` (`./http/compose.ts`) — live Firestore
 * public-release reads when the environment satisfies `./http/live-policy.ts`'s gate, an honest
 * empty in-memory adapter otherwise. `package.json`'s `start` script runs this file's compiled
 * output; `http/README.md` documents the exact local run command (including the
 * `run-with-dev-secrets` / `GOOGLE_CLOUD_QUOTA_PROJECT` / ADC pattern this repo already uses for
 * `apps/web`/`apps/admin` against the same production project).
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
