/**
 * Timing-channel / enumeration indistinguishability tests (repo-rw1p, T3).
 *
 * Uses a deterministic tracing data-access adapter to record backend lookup patterns — same call
 * sequence and stable error shape for nonexistent vs unpublished ids, without flaky wall-clock timing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientAttestationHeaders } from '@repo/security';
import { publicApiErrorEnvelopeSchema } from '@repo/public-contracts/errors';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import {
  createInMemoryPublicDataAccess,
  type PublicDataAccess,
} from './data-access.js';
import { dispatch } from './router.js';
import type { ApiRequest, HandlerDeps } from './handlers.js';
import { makeEntity, SAMPLE_POINTER } from './entity-fixture.js';

const FIXED_NOW = 1_800_000_000_000;
const REQUEST_ID = 'req_enum_fixed';

type TracedAccess = PublicDataAccess & { readonly trace: readonly string[] };

function traceDataAccess(inner: PublicDataAccess): TracedAccess {
  const trace: string[] = [];
  return {
    trace,
    async getReleasePointer() {
      trace.push('getReleasePointer');
      return inner.getReleasePointer();
    },
    async getEntity(releaseId, entityId) {
      trace.push(`getEntity:${entityId}`);
      return inner.getEntity(releaseId, entityId);
    },
    async listEntities(releaseId) {
      trace.push(`listEntities:${releaseId}`);
      return inner.listEntities(releaseId);
    },
    async search(canonical, options) {
      trace.push(`search:q=${canonical.q}`);
      return inner.search(canonical, options);
    },
  };
}

function makeDeps(dataAccess: PublicDataAccess): HandlerDeps {
  return {
    dataAccess,
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => ({
      allowed: true,
      verified: Boolean((headers as Record<string, string | undefined>)['x-blackstory-client']),
      mode: 'monitor',
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => FIXED_NOW }),
    searchGuard: createPublicSearchGuard(),
  };
}

function entityRequest(entityId: string): ApiRequest {
  return {
    method: 'GET',
    path: `/v1/entity/${entityId}`,
    query: new URLSearchParams(''),
    headers: {},
    requestId: REQUEST_ID,
  };
}

/** Stable error fields clients could use to distinguish outcomes (requestId is fixed in these tests). */
function stableNotFoundBody(body: unknown): Record<string, unknown> {
  const envelope = publicApiErrorEnvelopeSchema.parse(body);
  return {
    code: envelope.error.code,
    message: envelope.error.message,
    ...(envelope.error.details ? { details: envelope.error.details } : {}),
  };
}

function stableResponseHeaders(headers: Record<string, string>): Record<string, string> {
  const { 'X-Request-Id': _requestId, ...rest } = headers;
  return rest;
}

test('T3: nonexistent and unpublished ids share identical backend lookup trace', async () => {
  const inner = createInMemoryPublicDataAccess({
    pointer: SAMPLE_POINTER,
    entities: [makeEntity()],
    unpublishedIds: ['ent_withdrawn_999'],
  });
  const traced = traceDataAccess(inner);
  const deps = makeDeps(traced);

  traced.trace.length = 0;
  await dispatch(entityRequest('ent_does_not_exist_000'), deps);
  const nonexistentTrace = [...traced.trace];

  traced.trace.length = 0;
  await dispatch(entityRequest('ent_withdrawn_999'), deps);
  const unpublishedTrace = [...traced.trace];

  const callPattern = (trace: readonly string[]) =>
    trace.map((entry) => (entry.startsWith('getEntity:') ? 'getEntity' : entry));

  assert.deepEqual(
    callPattern(nonexistentTrace),
    callPattern(unpublishedTrace),
    'nonexistent and unpublished must hit the same backend lookup sequence',
  );
  assert.deepEqual(callPattern(nonexistentTrace), ['getReleasePointer', 'getEntity']);
  assert.equal(nonexistentTrace.length, 2);
  assert.equal(unpublishedTrace.length, 2);
});

test('T3: nonexistent and unpublished ids return identical status, envelope, and headers', async () => {
  const deps = makeDeps(
    createInMemoryPublicDataAccess({
      pointer: SAMPLE_POINTER,
      entities: [makeEntity()],
      unpublishedIds: ['ent_withdrawn_999'],
    }),
  );

  const nonexistent = await dispatch(entityRequest('ent_does_not_exist_000'), deps);
  const unpublished = await dispatch(entityRequest('ent_withdrawn_999'), deps);

  assert.equal(nonexistent.status, 404);
  assert.equal(unpublished.status, 404);
  assert.deepEqual(stableNotFoundBody(nonexistent.body), stableNotFoundBody(unpublished.body));
  assert.deepEqual(
    stableResponseHeaders(nonexistent.headers),
    stableResponseHeaders(unpublished.headers),
  );
});

test('T3: malformed entity id is rejected before any backend lookup (no enumeration side-channel)', async () => {
  const traced = traceDataAccess(
    createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities: [makeEntity()] }),
  );
  const deps = makeDeps(traced);

  const res = await dispatch(entityRequest('..%2f..%2fetc'), deps);
  assert.equal(res.status, 400);
  assert.equal(publicApiErrorEnvelopeSchema.parse(res.body).error.code, 'INVALID_REQUEST');
  assert.deepEqual(traced.trace, [], 'malformed id must not trigger release/entity lookups');
});

test('T3: existing entity lookup trace is one pointer read + one entity read', async () => {
  const traced = traceDataAccess(
    createInMemoryPublicDataAccess({ pointer: SAMPLE_POINTER, entities: [makeEntity()] }),
  );
  const deps = makeDeps(traced);

  const res = await dispatch(entityRequest('ent_dunbar_school_001'), deps);
  assert.equal(res.status, 200);
  assert.deepEqual(traced.trace, ['getReleasePointer', 'getEntity:ent_dunbar_school_001']);
});
