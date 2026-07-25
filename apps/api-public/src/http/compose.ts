/**
 * Production `HandlerDeps` composition — Postgres `bb_public` reads when
 * `PUBLIC_DATA_SOURCE=postgres` + `DATABASE_URL`; client-attestation + rate limits replace
 * Firebase App Check after ADR-020 cutover. Postgres is the only live data path (the legacy
 * Firestore read branch was removed — repo-348e.3).
 */
import { createPublicApiClientAttestationGuard } from '../client-attestation.js';
import { createPublicRateLimitGuard, createNoopRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import {
  createPublicDataAccessFromReaders,
  createInMemoryPublicDataAccess,
} from './data-access.js';
import { createPostgresDataAccessReaders } from './postgres-data-access.js';
import type { HandlerDeps } from './handlers.js';
import { shouldUsePublicPostgresDataAccess } from './live-policy.js';

export type ComposeHandlerDepsOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

export function createProductionHandlerDeps(options: ComposeHandlerDepsOptions = {}): HandlerDeps {
  const environment = options.environment ?? process.env;

  const dataAccess = shouldUsePublicPostgresDataAccess(environment)
    ? createPublicDataAccessFromReaders(createPostgresDataAccessReaders())
    : createInMemoryPublicDataAccess({ entities: [] });

  return {
    dataAccess,
    clientAttestationGuard: createPublicApiClientAttestationGuard({ environment }),
    rateLimitGuard:
      environment['RATE_LIMIT_DISABLED'] === '1'
        ? createNoopRateLimitGuard()
        : createPublicRateLimitGuard(),
    searchGuard: createPublicSearchGuard(),
  };
}
