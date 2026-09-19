/** Server-only vector search with client-header policy, rate limits, query budgets, and kill switches. */
import type { EmbeddingProvider, VectorIndexStore, VectorQueryMatch } from '@repo/ops-data';
import { truncateAndNormalize, EMBEDDING_DIMS } from '@repo/ops-data';
import type { KillSwitchSnapshot } from '@repo/config';
import type {
  ClientAttestationDecision,
  ClientAttestationHeaders,
  RateLimitSubject,
} from '@repo/security';
import { evaluateVectorSearchKillSwitch } from './vector-search-kill-switch.js';
import {
  evaluateVectorSearchGuardrails,
  formatVectorSearchGuardDeniedResponse,
  type VectorSearchHttpQuery,
} from './vector-search-guardrails.js';
import { createPublicRateLimitGuard, type PublicRateLimitGuardOptions } from './rate-limits.js';

export type FindNearestHttpRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: VectorSearchHttpQuery;
  readonly headers: ClientAttestationHeaders;
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly userId?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
};

export type FindNearestMatch = {
  readonly entityId: string;
  readonly kind: string;
  readonly distance: number;
};

export type FindNearestHttpResponse =
  | {
      readonly status: 200;
      readonly body: {
        readonly matches: readonly FindNearestMatch[];
        readonly k: number;
        readonly distanceThreshold: number;
      };
    }
  | { readonly status: 400; readonly body: Record<string, unknown> }
  | { readonly status: 403; readonly body: Record<string, unknown> }
  | {
      readonly status: 429;
      readonly body: Record<string, unknown>;
      readonly headers: { readonly 'Retry-After': string };
    };

export type FindNearestEndpointOptions = {
  readonly clientAttestationGuard: (request: {
    readonly headers: ClientAttestationHeaders;
  }) => Promise<ClientAttestationDecision>;
  readonly embeddingProvider: EmbeddingProvider;
  readonly vectorStore: VectorIndexStore;
  readonly loadKillSwitchSnapshot: () => Promise<KillSwitchSnapshot> | KillSwitchSnapshot;
  readonly rateLimitGuardOptions?: PublicRateLimitGuardOptions;
};

export type FindNearestEndpoint = {
  handle(request: FindNearestHttpRequest): Promise<FindNearestHttpResponse>;
};

/**
 * Builds the composed `find_nearest` handler. Construction never touches the database or the
 * network every side effect happens inside `.handle`.
 */
export function createFindNearestEndpoint(
  options: FindNearestEndpointOptions,
): FindNearestEndpoint {
  const rateLimitGuard = createPublicRateLimitGuard(options.rateLimitGuardOptions ?? {});

  return {
    async handle(request) {
      // Signal only never denies (fail-open, matches every other handler in this directory).
      const attestation = await options.clientAttestationGuard({ headers: request.headers });

      const killSwitchSnapshot = await options.loadKillSwitchSnapshot();
      const killSwitchDecision = evaluateVectorSearchKillSwitch(killSwitchSnapshot);
      if (!killSwitchDecision.allowed) {
        return {
          status: 403,
          body: {
            error: 'capability_disabled',
            switchId: killSwitchDecision.switchId,
            reason: killSwitchDecision.reason,
          },
        };
      }

      const rateLimitDecision = rateLimitGuard.evaluate({
        method: request.method,
        path: request.path,
        subject: request.subject,
        ...(request.clientIp !== undefined ? { clientIp: request.clientIp } : {}),
        ...(request.userId !== undefined ? { userId: request.userId } : {}),
        ...(request.deviceId !== undefined ? { deviceId: request.deviceId } : {}),
        ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
        clientAttested: attestation.verified,
      });
      if (rateLimitDecision && !rateLimitDecision.allowed) {
        const formatted = rateLimitGuard.formatDeniedResponse(rateLimitDecision);
        return { status: 429, body: formatted.body, headers: formatted.headers };
      }

      const guardDecision = evaluateVectorSearchGuardrails({
        method: request.method,
        path: request.path,
        query: request.query,
      });
      if (!guardDecision.allowed) {
        const formatted = formatVectorSearchGuardDeniedResponse(guardDecision);
        if (rateLimitDecision) rateLimitGuard.release(rateLimitDecision.key);
        return { status: formatted.status, body: formatted.body };
      }

      try {
        const [rawQueryVector] = await options.embeddingProvider.embed([
          guardDecision.canonical.queryText,
        ]);
        if (!rawQueryVector) {
          throw new Error('Embedding provider returned no vector for the query text');
        }
        const queryVector = truncateAndNormalize(rawQueryVector, EMBEDDING_DIMS);

        const rawMatches: readonly VectorQueryMatch[] = await options.vectorStore.findNearest({
          queryVector,
          limit: guardDecision.canonical.k,
          distanceThreshold: guardDecision.canonical.distanceThreshold,
          ...(guardDecision.canonical.kind ? { kind: guardDecision.canonical.kind } : {}),
          ...(guardDecision.canonical.state ? { state: guardDecision.canonical.state } : {}),
          ...(guardDecision.canonical.eraBucket
            ? { eraBucket: guardDecision.canonical.eraBucket }
            : {}),
        });

        const matches: readonly FindNearestMatch[] = rawMatches.map((match) => ({
          entityId: match.entityId,
          kind: match.kind,
          distance: match.distance,
        }));

        return {
          status: 200,
          body: {
            matches,
            k: guardDecision.canonical.k,
            distanceThreshold: guardDecision.canonical.distanceThreshold,
          },
        };
      } finally {
        if (rateLimitDecision) rateLimitGuard.release(rateLimitDecision.key);
      }
    },
  };
}
