/**
 * Firestore emulator integration tests for live `@repo/api-public` search + entity reads (MOB-004).
 * Skips when emulators are down unless CI_REQUIRE_FIREBASE=1; unit fakes remain the default CI lane.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { AppCheckDecision, AppCheckHeaders } from '@repo/firebase';
import { publicApiErrorEnvelopeSchema } from '@repo/public-contracts/errors';
import { searchResponseV1Schema } from '@repo/public-contracts/v1/search';
import { createFirebaseHarness, firebaseHarnessGate } from '@repo/testing';
import {
  API_PUBLIC_EMULATOR_RELEASE,
  buildEnumerationScenario,
  buildFallbackBoundScenario,
  buildFallbackSearchScenario,
  buildIndexBackedSearchScenario,
} from '../../../../packages/firebase/fixtures/api-public-emulator-seed.js';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createFirestorePublicDataAccess } from './data-access.js';
import {
  createFirestoreDataAccessReaders,
  MAX_LIVE_SEARCH_SCAN,
} from './firestore-data-access.js';
import {
  API_PUBLIC_EMULATOR_ENV,
  REQUIRE_FIREBASE_ENV,
  seedEmulatorScenario,
} from './emulator-harness.js';
import { dispatch } from './router.js';
import type { ApiRequest, HandlerDeps } from './handlers.js';

const FIXED_NOW = 1_800_000_000_000;
const REQUEST_ID = 'req_emulator_integration';
const APP_CHECK = { 'x-firebase-appcheck': 'valid-token' };

const harness = createFirebaseHarness(API_PUBLIC_EMULATOR_ENV);
let skipReason: string | undefined;

before(() => {
  if (!harness.available) {
    skipReason = harness.reason;
    if (process.env[REQUIRE_FIREBASE_ENV] === '1') {
      throw new Error(`${skipReason} (${REQUIRE_FIREBASE_ENV}=1)`);
    }
  }
});

function noArtifactFetch() {
  return async () => undefined;
}

function makeReaders() {
  return createFirestoreDataAccessReaders({
    environment: API_PUBLIC_EMULATOR_ENV,
    fetchSearchIndexArtifact: noArtifactFetch(),
  });
}

function makeLiveDeps(): HandlerDeps {
  return {
    dataAccess: createFirestorePublicDataAccess(makeReaders()),
    appCheckGuard: async (_req: { headers: AppCheckHeaders }): Promise<AppCheckDecision> => ({
      allowed: true,
      verified: true,
      mode: 'monitor',
      trustedService: false,
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => FIXED_NOW }),
    searchGuard: createPublicSearchGuard(),
  };
}

function makeRequest(path: string, query = ''): ApiRequest {
  return {
    method: 'GET',
    path,
    query: new URLSearchParams(query),
    headers: APP_CHECK,
    requestId: REQUEST_ID,
  };
}

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

const canonicalSearch = {
  q: 'dunbar',
  pageSize: 10,
  depth: 1,
  filters: [] as const,
  geo: undefined,
  dateRange: undefined,
  sort: 'relevance' as const,
  shape: 'search' as const,
};

test(
  'emulator: index-backed search reads publicSearchIndex + active release pointer',
  firebaseHarnessGate(harness),
  async (t) => {
    if (skipReason) {
      t.skip(skipReason);
      return;
    }

    const scenario = buildIndexBackedSearchScenario();
    await seedEmulatorScenario(scenario);
    const readers = makeReaders();

    const pointer = await readers.readReleasePointer();
    assert.ok(pointer);
    assert.equal(pointer.activeRelease.releaseId, API_PUBLIC_EMULATOR_RELEASE.indexSearch);

    const page = await readers.readSearchPage(canonicalSearch, { releaseId: scenario.releaseId });
    assert.ok(page.results.some((row) => row.id === 'ent_dunbar_school_001'));
    assert.equal(page.totalMatched, 1);
    assert.equal(page.facets.kind.school, 1);
  },
);

test(
  'emulator: HTTP search handler uses index-backed live Firestore reads',
  firebaseHarnessGate(harness),
  async (t) => {
    if (skipReason) {
      t.skip(skipReason);
      return;
    }

    await seedEmulatorScenario(buildIndexBackedSearchScenario());
    const res = await dispatch(makeRequest('/v1/search', 'q=dunbar'), makeLiveDeps());
    assert.equal(res.status, 200);
    const parsed = searchResponseV1Schema.parse(res.body);
    assert.ok(parsed.results.some((row) => row.id === 'ent_dunbar_school_001'));
    assert.equal(parsed.facets.kind.school, 1);
  },
);

test(
  'emulator: missing-index fallback scans entities with MAX_LIVE_SEARCH_SCAN cap',
  firebaseHarnessGate(harness),
  async (t) => {
    if (skipReason) {
      t.skip(skipReason);
      return;
    }

    const scenario = buildFallbackBoundScenario(MAX_LIVE_SEARCH_SCAN + 1);
    await seedEmulatorScenario(scenario);
    const readers = makeReaders();

    const page = await readers.readSearchPage(
      {
        q: '',
        pageSize: MAX_LIVE_SEARCH_SCAN + 50,
        depth: 1,
        filters: [],
        geo: undefined,
        dateRange: undefined,
        sort: 'relevance',
        shape: 'search',
      },
      { releaseId: scenario.releaseId },
    );

    assert.equal(page.totalMatched, MAX_LIVE_SEARCH_SCAN);
    assert.deepEqual(page.facets, {
      kind: {},
      status: {},
      era: {},
      theme: {},
      state: {},
      recordMaturity: {},
      researchCoverage: {},
    });
  },
);

test(
  'emulator: missing-index fallback search returns entity matches without index facets',
  firebaseHarnessGate(harness),
  async (t) => {
    if (skipReason) {
      t.skip(skipReason);
      return;
    }

    const scenario = buildFallbackSearchScenario();
    await seedEmulatorScenario(scenario);
    const readers = makeReaders();

    const page = await readers.readSearchPage(
      { ...canonicalSearch, q: 'presbyterian' },
      { releaseId: scenario.releaseId },
    );
    assert.equal(page.results.length, 1);
    assert.equal(page.results[0]?.id, 'ent_15th_st_church_001');
    assert.deepEqual(page.facets.kind, {});
  },
);

test(
  'emulator: T3 nonexistent and unsupported-kind ids are indistinguishable at HTTP layer',
  firebaseHarnessGate(harness),
  async (t) => {
    if (skipReason) {
      t.skip(skipReason);
      return;
    }

    await seedEmulatorScenario(buildEnumerationScenario());
    const deps = makeLiveDeps();

    const nonexistent = await dispatch(
      makeRequest('/v1/entity/ent_does_not_exist_000'),
      deps,
    );
    const unpublished = await dispatch(
      makeRequest('/v1/entity/ent_unpublished_person_001'),
      deps,
    );

    assert.equal(nonexistent.status, 404);
    assert.equal(unpublished.status, 404);
    assert.deepEqual(stableNotFoundBody(nonexistent.body), stableNotFoundBody(unpublished.body));
    assert.deepEqual(
      stableResponseHeaders(nonexistent.headers),
      stableResponseHeaders(unpublished.headers),
    );
  },
);

test(
  'emulator: published entity read succeeds through live Firestore adapter',
  firebaseHarnessGate(harness),
  async (t) => {
    if (skipReason) {
      t.skip(skipReason);
      return;
    }

    await seedEmulatorScenario(buildEnumerationScenario());
    const res = await dispatch(
      makeRequest('/v1/entity/ent_dunbar_school_001'),
      makeLiveDeps(),
    );
    assert.equal(res.status, 200);
    assert.equal((res.body as { id?: string }).id, 'ent_dunbar_school_001');
  },
);
