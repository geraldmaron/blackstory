/**
 * Negative redaction snapshots — proving specific sensitive/internal fields are ABSENT from real
 * `/v1` response payloads (ADR-021 §3). Mirrors the sensitive-field negative-snapshot style of
 * `packages/public-contracts/src/v1/entity.test.ts`: a fixture that carries forbidden keys must not
 * see them survive onto the wire.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppCheckDecision, AppCheckHeaders } from '@repo/firebase';
import type { EntityV1 } from '@repo/public-contracts/v1/entity';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createInMemoryPublicDataAccess } from './data-access.js';
import { dispatch } from './router.js';
import type { ApiRequest, HandlerDeps } from './handlers.js';
import { makeEntity, SAMPLE_POINTER } from './entity-fixture.js';

const FORBIDDEN_KEYS = [
  'notabilityScore',
  'relevanceRankingScore',
  'preciseLocation',
  'residentialAddress',
  'internalReviewNotes',
  'sourceLineageInternal',
  'moderationState',
  'draftOnly',
  'unpublishedStatus',
  '__collection',
] as const;

/** An entity object polluted with internal/ranking/precise-geo/collection fields. The `as` cast is
 * deliberate — the whole point is to feed the server a shape that CARRIES these keys and prove the
 * contract parse strips them before serialization. */
function leakyEntity(): EntityV1 {
  const raw: Record<string, unknown> = {
    ...makeEntity(),
    notabilityScore: 0.97,
    relevanceRankingScore: 12.5,
    preciseLocation: { lat: 38.9101, lng: -77.0101 },
    residentialAddress: '1301 New Jersey Ave NW',
    internalReviewNotes: 'reviewer: alice; flagged',
    sourceLineageInternal: { rawSources: ['case-77'] },
    moderationState: 'in_review',
    draftOnly: true,
    unpublishedStatus: 'hidden',
    __collection: 'canonicalEntities',
  };
  return raw as unknown as EntityV1;
}

function makeDeps(entity: EntityV1): HandlerDeps {
  return {
    dataAccess: createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities: [entity] }),
    // verified:true so the expensive-read search path (which requires App Check for anonymous)
    // is exercised — this test is about field redaction, not the App Check gate.
    appCheckGuard: async (_req: { headers: AppCheckHeaders }): Promise<AppCheckDecision> => ({
      allowed: true,
      verified: true,
      mode: 'monitor',
      trustedService: false,
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => 1_800_000_000_000 }),
    searchGuard: createPublicSearchGuard(),
  };
}

function makeRequest(path: string, query = ''): ApiRequest {
  return {
    method: 'GET',
    path,
    query: new URLSearchParams(query),
    headers: {},
    requestId: 'req_redaction',
  };
}

test('entity response contains NONE of the forbidden internal/ranking/geo/collection fields', async () => {
  const res = await dispatch(makeRequest('/v1/entity/ent_dunbar_school_001'), makeDeps(leakyEntity()));
  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  for (const key of FORBIDDEN_KEYS) {
    assert.ok(!(key in body), `${key} must not appear in the entity payload`);
  }
});

test('search result carries no numeric ranking/evidence score and no internal fields', async () => {
  const res = await dispatch(makeRequest('/v1/search', 'q=dunbar'), makeDeps(leakyEntity()));
  assert.equal(res.status, 200);
  const result = (res.body as { results: Record<string, unknown>[] }).results[0] ?? {};
  for (const key of [...FORBIDDEN_KEYS, 'score', 'relevance', 'evidenceCount', 'connectionCount']) {
    assert.ok(!(key in result), `${key} must not appear in a search result`);
  }
});

test('locationPrecision on a served entity is one of the four public tiers (never address/exact)', async () => {
  const res = await dispatch(makeRequest('/v1/entity/ent_dunbar_school_001'), makeDeps(makeEntity()));
  const body = res.body as { locationPrecision: string };
  assert.ok(['city', 'neighborhood', 'campus', 'institution'].includes(body.locationPrecision));
});
