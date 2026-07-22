/**
 * Production `HandlerDeps` composition (MOB-004 live wiring) — Postgres `bb_public` reads
 * when `PUBLIC_DATA_SOURCE=postgres` + `DATABASE_URL`; client-attestation + rate limits
 * replace Firebase App Check after ADR-020 cutover.
 */
import { createPublicApiClientAttestationGuard } from '../client-attestation.js';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import {
  createFirestorePublicDataAccess,
  createInMemoryPublicDataAccess,
} from './data-access.js';
import { createFirestoreDataAccessReaders } from './firestore-data-access.js';
import { createPostgresDataAccessReaders } from './postgres-data-access.js';
import type { HandlerDeps } from './handlers.js';
import {
  shouldUsePublicFirestoreDataAccess,
  shouldUsePublicPostgresDataAccess,
} from './live-policy.js';

export type ComposeHandlerDepsOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

export function createProductionHandlerDeps(options: ComposeHandlerDepsOptions = {}): HandlerDeps {
  const environment = options.environment ?? process.env;

  const dataAccess = shouldUsePublicPostgresDataAccess(environment)
    ? createFirestorePublicDataAccess(createPostgresDataAccessReaders())
    : shouldUsePublicFirestoreDataAccess(environment)
      ? createFirestorePublicDataAccess(createFirestoreDataAccessReaders({ environment }))
      : createInMemoryPublicDataAccess({ entities: [] });

  return {
    dataAccess,
    clientAttestationGuard: createPublicApiClientAttestationGuard({ environment }),
    rateLimitGuard: createPublicRateLimitGuard(),
    searchGuard: createPublicSearchGuard(),
  };
}
