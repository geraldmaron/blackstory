/**
 * Production `HandlerDeps` composition — Postgres `bb_public` reads when
 * `PUBLIC_DATA_SOURCE=postgres` + `DATABASE_URL`; client-attestation + rate limits replace
 * Firebase App Check after ADR-020 cutover. Postgres is the only live data path (the legacy
 * Firestore read branch was removed — repo-348e.3).
 *
 * `vectorSearch` (`/v1/search/nearest`, 2026-08-14) shares the same rate-limit store as
 * `rateLimitGuard` (both hit the `search` endpoint class) rather than constructing its own — see
 * `createFindNearestEndpoint`'s `rateLimitGuardOptions.store`. It's `undefined` (route 404s) when
 * no embedding API key is configured (`GEMINI_API_KEY`/`GOOGLE_AI_API_KEY`) since the endpoint
 * cannot function without one.
 */
import { createInMemoryRateLimitStore } from '@repo/security';
import {
  createPostgresVectorIndexStore,
  createGeminiEmbeddingProvider,
} from '@repo/ops-data';
import { createPublicApiClientAttestationGuard } from '../client-attestation.js';
import { createPublicRateLimitGuard, createNoopRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createFindNearestEndpoint } from '../vector-search-endpoint.js';
import {
  createPublicDataAccessFromReaders,
  createInMemoryPublicDataAccess,
} from './data-access.js';
import { createPostgresDataAccessReaders } from './postgres-data-access.js';
import { loadKillSwitchSnapshot } from './kill-switches.js';
import { queryPostgres } from './postgres-client.js';
import type { HandlerDeps } from './handlers.js';
import { shouldUsePublicPostgresDataAccess } from './live-policy.js';

export type ComposeHandlerDepsOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

const EMBEDDING_API_KEY_ENV_VARS = ['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY'] as const;

function hasEmbeddingApiKey(environment: Readonly<Record<string, string | undefined>>): boolean {
  return EMBEDDING_API_KEY_ENV_VARS.some((key) => environment[key]?.trim());
}

export function createProductionHandlerDeps(options: ComposeHandlerDepsOptions = {}): HandlerDeps {
  const environment = options.environment ?? process.env;

  const dataAccess = shouldUsePublicPostgresDataAccess(environment)
    ? createPublicDataAccessFromReaders(createPostgresDataAccessReaders())
    : createInMemoryPublicDataAccess({ entities: [] });

  const rateLimitDisabled = environment['RATE_LIMIT_DISABLED'] === '1';
  const sharedRateLimitStore = createInMemoryRateLimitStore();
  const clientAttestationGuard = createPublicApiClientAttestationGuard({ environment });

  return {
    dataAccess,
    clientAttestationGuard,
    rateLimitGuard: rateLimitDisabled
      ? createNoopRateLimitGuard()
      : createPublicRateLimitGuard({ store: sharedRateLimitStore }),
    searchGuard: createPublicSearchGuard(),
    ...(hasEmbeddingApiKey(environment)
      ? {
          vectorSearch: createFindNearestEndpoint({
            clientAttestationGuard,
            embeddingProvider: createGeminiEmbeddingProvider({ environment }),
            vectorStore: createPostgresVectorIndexStore(queryPostgres),
            loadKillSwitchSnapshot,
            ...(rateLimitDisabled ? {} : { rateLimitGuardOptions: { store: sharedRateLimitStore } }),
          }),
        }
      : {}),
  };
}
