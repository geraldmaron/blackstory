/**
 * `/v1` handler acceptance + adversarial tests. Every 200 body is re-parsed against its
 * `@repo/public-contracts` schema; client attestation fail-open and ID-enumeration
 * indistinguishability are asserted directly.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientAttestationDecision, ClientAttestationHeaders } from '@repo/security';
import { bootstrapResponseV1Schema } from '@repo/public-contracts/v1/bootstrap';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import { mapSourceV1Schema } from '@repo/public-contracts/v1/map';
import { searchResponseV1Schema } from '@repo/public-contracts/v1/search';
import { publicApiErrorEnvelopeSchema } from '@repo/public-contracts/errors';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createInMemoryPublicDataAccess } from './data-access.js';
import { dispatch } from './router.js';
import type { ApiRequest, HandlerDeps } from './handlers.js';
import { makeEntity, SAMPLE_POINTER } from './entity-fixture.js';

const FIXED_NOW = 1_800_000_000_000;

function monitorAttestation(verified: boolean): ClientAttestationDecision {
  return { allowed: true, verified, mode: 'monitor' };
}

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    dataAccess: createInMemoryPublicDataAccess({
      pointer: SAMPLE_POINTER,
      entities: [makeEntity()],
      unpublishedIds: ['ent_withdrawn_999'],
    }),
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => {
      const record = headers as Record<string, string | undefined>;
      return monitorAttestation(Boolean(record['x-blackstory-client']));
    },
    rateLimitGuard: createPublicRateLimitGuard({ now: () => FIXED_NOW }),
    searchGuard: createPublicSearchGuard(),
    ...overrides,
  };
}

function makeRequest(
  path: string,
  init: { query?: string; headers?: Record<string, string>; requestId?: string } = {},
): ApiRequest {
  return {
    method: 'GET',
    path,
    query: new URLSearchParams(init.query ?? ''),
    headers: Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    requestId: init.requestId ?? 'req_test_fixed',
  };
}

test('GET /v1/health returns surface posture, no-store, request id', async () => {
  const res = await dispatch(makeRequest('/v1/health'), makeDeps());
  assert.equal(res.status, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers['X-Request-Id'], 'req_test_fixed');
  assert.equal((res.body as { service: string }).service, 'api-public');
});

test('GET /v1/compatibility: current client is supported (200)', async () => {
  const res = await dispatch(
    makeRequest('/v1/compatibility', { headers: { 'X-BlackStory-Client': 'mobile/1.4.0; api=1' } }),
    makeDeps(),
  );
  assert.equal(res.status, 200);
  assert.equal((res.body as { supported: boolean }).supported, true);
});

test('GET /v1/compatibility: below-floor client gets 426 CLIENT_VERSION_UNSUPPORTED', async () => {
  const res = await dispatch(
    makeRequest('/v1/compatibility', { headers: { 'X-BlackStory-Client': 'mobile/0.9.0; api=0' } }),
    makeDeps(),
  );
  assert.equal(res.status, 426);
  const envelope = publicApiErrorEnvelopeSchema.parse(res.body);
  assert.equal(envelope.error.code, 'CLIENT_VERSION_UNSUPPORTED');
});

test('GET /v1/bootstrap validates against bootstrapResponseV1Schema and carries an ETag', async () => {
  const res = await dispatch(makeRequest('/v1/bootstrap'), makeDeps());
  assert.equal(res.status, 200);
  assert.ok(res.headers.ETag, 'bootstrap response must carry an ETag');
  const parsed = bootstrapResponseV1Schema.parse(res.body);
  assert.equal(parsed.apiVersion, 'v1');
  assert.equal(parsed.activeRelease.releaseId, 'rel_2026_07_19_001');
});

test('If-None-Match matching the ETag yields a bodiless 304', async () => {
  const deps = makeDeps();
  const first = await dispatch(makeRequest('/v1/bootstrap'), deps);
  const etag = first.headers.ETag as string;
  const second = await dispatch(makeRequest('/v1/bootstrap', { headers: { 'If-None-Match': etag } }), deps);
  assert.equal(second.status, 304);
  assert.equal(second.body, null);
});

test('GET /v1/entity/:id returns a contract-valid entity', async () => {
  const res = await dispatch(makeRequest('/v1/entity/ent_dunbar_school_001'), makeDeps());
  assert.equal(res.status, 200);
  const parsed = entityV1Schema.parse(res.body);
  assert.equal(parsed.id, 'ent_dunbar_school_001');
});

test('GET /v1/map returns MapSourceV1 for geo-anchored entities', async () => {
  const deps = makeDeps({
    dataAccess: createInMemoryPublicDataAccess({
      pointer: SAMPLE_POINTER,
      entities: [
        makeEntity({
          id: 'ent_with_geo',
          geoAnchor: {
            lat: 38.9072,
            lng: -77.0369,
            geohash: 'dqcjq',
            matchMethod: 'fixture',
          },
        }),
        makeEntity({ id: 'ent_no_geo' }),
      ],
    }),
  });
  const res = await dispatch(makeRequest('/v1/map'), deps);
  assert.equal(res.status, 200);
  const parsed = mapSourceV1Schema.parse(res.body);
  assert.equal(parsed.releaseId, 'rel_2026_07_19_001');
  assert.equal(parsed.features.length, 1);
  assert.equal(parsed.features[0]!.properties.entityId, 'ent_with_geo');
});

test('GET /v1/map without active release is UPSTREAM_UNAVAILABLE', async () => {
  const deps = makeDeps({
    dataAccess: createInMemoryPublicDataAccess({ entities: [] }),
  });
  const res = await dispatch(makeRequest('/v1/map'), deps);
  assert.equal(res.status, 503);
  assert.equal(publicApiErrorEnvelopeSchema.parse(res.body).error.code, 'UPSTREAM_UNAVAILABLE');
});

test('ADVERSARIAL: unpublished and nonexistent ids return byte-identical 404s (no enumeration signal)', async () => {
  const deps = makeDeps();
  const nonexistent = await dispatch(
    makeRequest('/v1/entity/ent_does_not_exist_000', { requestId: 'req_same' }),
    deps,
  );
  const unpublished = await dispatch(
    makeRequest('/v1/entity/ent_withdrawn_999', { requestId: 'req_same' }),
    deps,
  );
  assert.equal(nonexistent.status, 404);
  assert.equal(unpublished.status, 404);
  assert.equal(
    JSON.stringify(nonexistent.body),
    JSON.stringify(unpublished.body),
    'unpublished vs nonexistent must be indistinguishable',
  );
});

test('ADVERSARIAL: malformed entity id is rejected 400 before any lookup', async () => {
  const res = await dispatch(makeRequest('/v1/entity/..%2f..%2fetc'), makeDeps());
  assert.equal(res.status, 400);
  assert.equal(publicApiErrorEnvelopeSchema.parse(res.body).error.code, 'INVALID_REQUEST');
});

// Search is an `expensive_read`: anonymous callers MUST present a verified client header or the
// rate-limiter denies `app_check_required` (quota policy name retained for compatibility).
const CLIENT_HEADER = { 'x-blackstory-client': 'mobile/1.0.0; api=1' };

test('GET /v1/search returns a contract-valid, bounded response', async () => {
  const res = await dispatch(
    makeRequest('/v1/search', { query: 'q=dunbar', headers: CLIENT_HEADER }),
    makeDeps(),
  );
  assert.equal(res.status, 200);
  const parsed = searchResponseV1Schema.parse(res.body);
  assert.equal(parsed.results[0]?.id, 'ent_dunbar_school_001');
  assert.ok(!('relevanceRankingScore' in (parsed.results[0] ?? {})));
});

test('GET /v1/search mints an opaque nextCursor when more results exist', async () => {
  const entities = Array.from({ length: 5 }, (_v, i) =>
    makeEntity({ id: `ent_school_${i}`, displayName: `School ${i} dunbar` }),
  );
  const deps = makeDeps({
    dataAccess: createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities }),
  });
  const res = await dispatch(
    makeRequest('/v1/search', { query: 'q=dunbar&pageSize=2', headers: CLIENT_HEADER }),
    deps,
  );
  const parsed = searchResponseV1Schema.parse(res.body);
  assert.equal(parsed.hasMore, true);
  assert.ok(parsed.nextCursor && parsed.nextCursor.length > 0, 'cursor must be present and opaque');
});

test('ADVERSARIAL: SQL-injection-shaped query param is denied 400 by the shared guardrail', async () => {
  const res = await dispatch(
    makeRequest('/v1/search', { query: 'q=dunbar&sql=DROP+TABLE+entities', headers: CLIENT_HEADER }),
    makeDeps(),
  );
  assert.equal(res.status, 400);
  const envelope = publicApiErrorEnvelopeSchema.parse(res.body);
  assert.equal(envelope.error.code, 'INVALID_REQUEST');
  assert.equal(envelope.error.details?.reason, 'sql_not_allowed');
});

test('search (expensive_read) requires client header for anonymous callers → 429 without it', async () => {
  const res = await dispatch(makeRequest('/v1/search', { query: 'q=dunbar' }), makeDeps());
  assert.equal(res.status, 429);
  assert.equal(publicApiErrorEnvelopeSchema.parse(res.body).error.code, 'RATE_LIMITED');
});

test('ADVERSARIAL: client header omitted → entity read still served (fail-open static read)', async () => {
  const deps = makeDeps();
  const withHeader = await dispatch(
    makeRequest('/v1/entity/ent_dunbar_school_001', {
      requestId: 'req_same',
      headers: CLIENT_HEADER,
    }),
    deps,
  );
  const withoutHeader = await dispatch(
    makeRequest('/v1/entity/ent_dunbar_school_001', { requestId: 'req_same' }),
    deps,
  );
  assert.equal(withHeader.status, 200);
  assert.equal(withoutHeader.status, 200);
  assert.equal(JSON.stringify(withHeader.body), JSON.stringify(withoutHeader.body));
});

test('version floor is enforced on entity/search/bootstrap, not only /v1/compatibility', async () => {
  const belowFloor = { 'X-BlackStory-Client': 'mobile/0.9.0; api=0' };
  for (const path of ['/v1/bootstrap', '/v1/entity/ent_dunbar_school_001', '/v1/search']) {
    const res = await dispatch(makeRequest(path, { headers: belowFloor, query: 'q=x' }), makeDeps());
    assert.equal(res.status, 426, `${path} must reject a below-floor client`);
  }
});

test('unknown route returns a NOT_FOUND envelope', async () => {
  const res = await dispatch(makeRequest('/v1/nope'), makeDeps());
  assert.equal(res.status, 404);
  assert.equal(publicApiErrorEnvelopeSchema.parse(res.body).error.code, 'NOT_FOUND');
});

test('non-GET method is not served', async () => {
  const req = { ...makeRequest('/v1/entity/ent_dunbar_school_001'), method: 'POST' };
  const res = await dispatch(req, makeDeps());
  assert.equal(res.status, 404);
});
