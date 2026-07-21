/**
 * Deterministic Firestore read-budget tests for MOB-004 `/v1` endpoints.
 *
 * Uses `createRecordingFirestoreClient` to assert worst-case `doc().get()` and paginated query
 * counts for bootstrap, entity, and search (artifact, index-backed, and entity-scan fallback).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityProjectionDoc, ReleaseSearchIndexArtifact } from '@repo/firebase';
import type { ClientAttestationHeaders } from '@repo/security';
import { DEFAULT_QUERY_GUARDRAIL_LIMITS } from '@repo/security';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createFirestorePublicDataAccess } from './data-access.js';
import { createFirestoreDataAccessReaders, SEARCH_INDEX_PAGE_SIZE } from './firestore-data-access.js';
import {
  BOOTSTRAP_READ_BUDGET,
  createEmptyFirestoreReadTrace,
  createRecordingFirestoreClient,
  ENTITY_READ_BUDGET,
  SEARCH_ARTIFACT_READ_BUDGET,
  searchFallbackReadBudget,
  searchIndexBackedReadBudget,
  totalFirestoreDocumentsRead,
} from './firestore-read-budget.js';
import { handleBootstrap, handleEntity, handleSearch, type HandlerDeps } from './handlers.js';
import type { ApiRequest } from './handlers.js';

const RELEASE_ID = 'rel_budget_001';
const MANIFEST_HASH = 'b'.repeat(64);
const CLIENT_ATTESTATION = { 'x-blackstory-client': 'mobile/1.0.0; api=1' };

const activeRelease = {
  releaseId: RELEASE_ID,
  activatedAt: '2026-07-20T00:00:00.000Z',
  searchIndexVersion: 'idx_budget',
  manifestHash: MANIFEST_HASH,
};

const LONG_SUMMARY =
  'A documented place used for read-budget assertions in MOB-004, with enough published archival ' +
  'context to satisfy the public projection summary minimum length for release validation.';

const sampleProjection: PublicEntityProjectionDoc = {
  id: 'ent_budget_place_001',
  releaseId: RELEASE_ID,
  kind: 'place',
  displayName: 'Budget Test Place',
  nameLower: 'budget test place',
  summary: LONG_SUMMARY,
  location: {
    lat: 38.9072,
    lng: -77.0369,
    geohash: 'dqcjq',
    precision: 'city',
    matchMethod: 'manual_research',
  },
  claimIds: [],
  topicTags: ['community'],
  historicalContext: 'Used only in deterministic read-budget tests.',
  eraBuckets: ['1860s'],
};

const sampleSearchIndexDoc = {
  id: sampleProjection.id,
  releaseId: RELEASE_ID,
  kind: 'place' as const,
  displayName: sampleProjection.displayName,
  nameLower: sampleProjection.nameLower,
  aliases: ['budget place'],
  summary: sampleProjection.summary,
  topicTags: ['community'],
  eraBuckets: ['1860s'],
  notabilityBasis: [{ criterion: 'community_landmark', note: 'Documented site.', evidenceIds: [] }],
  notabilityLabels: ['Community landmark.'],
  recordMaturity: 'projection_stub',
  researchCoverage: 'minimal' as const,
  relatedCount: 0,
  claimCount: 0,
};

function makeRequest(path: string, query = ''): ApiRequest {
  return {
    method: 'GET',
    path,
    query: new URLSearchParams(query),
    headers: Object.fromEntries(Object.entries(CLIENT_ATTESTATION).map(([k, v]) => [k.toLowerCase(), v])),
    requestId: 'req_read_budget',
  };
}

function makeHandlerDeps(trace: ReturnType<typeof createEmptyFirestoreReadTrace>, seed: {
  readonly activeRelease?: unknown;
  readonly entities?: ReadonlyMap<string, unknown>;
  readonly searchIndex?: ReadonlyMap<string, unknown>;
  readonly fetchSearchIndexArtifact?: (releaseId: string) => Promise<ReleaseSearchIndexArtifact | undefined>;
}): HandlerDeps {
  const firestore = createRecordingFirestoreClient(seed, trace);
  const readers = createFirestoreDataAccessReaders({
    firestore,
    ...(seed.fetchSearchIndexArtifact ? { fetchSearchIndexArtifact: seed.fetchSearchIndexArtifact } : {}),
  });
  return {
    dataAccess: createFirestorePublicDataAccess(readers),
    clientAttestationGuard: async ({ headers }: { headers: ClientAttestationHeaders }) => ({
      allowed: true,
      verified: Boolean((headers as Record<string, string | undefined>)['x-blackstory-client']),
      mode: 'monitor',
    }),
    rateLimitGuard: createPublicRateLimitGuard({ now: () => 1_800_000_000_000 }),
    searchGuard: createPublicSearchGuard(),
  };
}

function assertWithinBudget(
  trace: ReturnType<typeof createEmptyFirestoreReadTrace>,
  budget: { readonly docGets: number; readonly queryGets: number; readonly documentsRead: number },
  label: string,
): void {
  assert.equal(trace.docGets, budget.docGets, `${label}: docGets`);
  assert.equal(trace.queryGets, budget.queryGets, `${label}: queryGets`);
  assert.equal(
    totalFirestoreDocumentsRead(trace),
    budget.documentsRead,
    `${label}: documentsRead`,
  );
}

test('read budget: GET /v1/bootstrap reads exactly one Firestore doc', async () => {
  const trace = createEmptyFirestoreReadTrace();
  const deps = makeHandlerDeps(trace, { activeRelease });
  const res = await handleBootstrap(makeRequest('/v1/bootstrap'), deps);
  assert.equal(res.status, 200);
  assertWithinBudget(trace, BOOTSTRAP_READ_BUDGET, 'bootstrap');
});

test('read budget: GET /v1/entity/:id reads release pointer + one entity doc', async () => {
  const trace = createEmptyFirestoreReadTrace();
  const deps = makeHandlerDeps(trace, {
    activeRelease,
    entities: new Map([[sampleProjection.id, sampleProjection]]),
  });
  const res = await handleEntity(makeRequest('/v1/entity/ent_budget_place_001'), sampleProjection.id, deps);
  assert.equal(res.status, 200);
  assertWithinBudget(trace, ENTITY_READ_BUDGET, 'entity');
});

test('read budget: search with artifact uses zero Firestore index queries', async () => {
  const trace = createEmptyFirestoreReadTrace();
  const deps = makeHandlerDeps(trace, {
    activeRelease,
    searchIndex: new Map([['ent_firestore_only', { ...sampleSearchIndexDoc, id: 'ent_firestore_only' }]]),
    fetchSearchIndexArtifact: async () => ({
      schemaVersion: 1,
      releaseId: RELEASE_ID,
      generatedAt: '2026-07-20T00:00:00.000Z',
      docCount: 1,
      docs: [sampleSearchIndexDoc],
    }),
  });
  const res = await handleSearch(makeRequest('/v1/search', 'q=budget&pageSize=10'), deps);
  assert.equal(res.status, 200);
  assertWithinBudget(trace, SEARCH_ARTIFACT_READ_BUDGET, 'search-artifact');
});

test('read budget: index-backed search loads full release index with paginated queries', async () => {
  const indexDocCount = SEARCH_INDEX_PAGE_SIZE * 2 + 17;
  const index = new Map<string, unknown>();
  for (let i = 0; i < indexDocCount; i += 1) {
    const id = `ent_index_${String(i).padStart(4, '0')}`;
    index.set(id, {
      ...sampleSearchIndexDoc,
      id,
      nameLower: `budget index ${i}`,
      displayName: `Budget Index ${i}`,
    });
  }

  const trace = createEmptyFirestoreReadTrace();
  const deps = makeHandlerDeps(trace, { activeRelease, searchIndex: index });
  const res = await handleSearch(makeRequest('/v1/search', 'q=budget&pageSize=50&depth=1'), deps);
  assert.equal(res.status, 200);
  assertWithinBudget(trace, searchIndexBackedReadBudget(indexDocCount), 'search-index');
});

test('read budget: entity-scan fallback probes index then scans MAX_LIVE_SEARCH_SCAN entities', async () => {
  const entityCount = 600;
  const entities = new Map<string, unknown>();
  for (let i = 0; i < entityCount; i += 1) {
    const id = `ent_fallback_${String(i).padStart(4, '0')}`;
    entities.set(id, {
      ...sampleProjection,
      id,
      displayName: `Fallback Entity ${i}`,
      nameLower: `fallback entity ${i}`,
      summary: `${LONG_SUMMARY} Fallback entity ${i} includes the budget keyword for matching.`,
    });
  }

  const trace = createEmptyFirestoreReadTrace();
  const deps = makeHandlerDeps(trace, { activeRelease, entities });
  const res = await handleSearch(makeRequest('/v1/search', 'q=budget&pageSize=50'), deps);
  assert.equal(res.status, 200);
  assertWithinBudget(trace, searchFallbackReadBudget(entityCount), 'search-fallback');
});

test('read budget: guardrail depth/pageSize caps do not expand Firestore index fetches', async () => {
  const indexDocCount = 120;
  const index = new Map<string, unknown>();
  for (let i = 0; i < indexDocCount; i += 1) {
    const id = `ent_guard_${String(i).padStart(3, '0')}`;
    index.set(id, { ...sampleSearchIndexDoc, id, nameLower: `budget guard ${i}` });
  }

  const trace = createEmptyFirestoreReadTrace();
  const deps = makeHandlerDeps(trace, { activeRelease, searchIndex: index });
  const res = await handleSearch(
    makeRequest(
      '/v1/search',
      `q=budget&pageSize=${DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPageSize}`,
    ),
    deps,
  );
  assert.equal(res.status, 200);
  assertWithinBudget(trace, searchIndexBackedReadBudget(indexDocCount), 'search-index-depth-cap');
});

test('read budget: readers.readReleasePointer alone matches bootstrap doc budget', async () => {
  const trace = createEmptyFirestoreReadTrace();
  const readers = createFirestoreDataAccessReaders({
    firestore: createRecordingFirestoreClient({ activeRelease }, trace),
  });
  const pointer = await readers.readReleasePointer();
  assert.ok(pointer);
  assert.equal(trace.docGets, 1);
  assert.equal(trace.queryGets, 0);
  assert.equal(totalFirestoreDocumentsRead(trace), 1);
});

test('read budget: readers.readEntity alone matches single-entity doc budget', async () => {
  const trace = createEmptyFirestoreReadTrace();
  const readers = createFirestoreDataAccessReaders({
    firestore: createRecordingFirestoreClient(
      { entities: new Map([[sampleProjection.id, sampleProjection]]) },
      trace,
    ),
  });
  const entity = await readers.readEntity(RELEASE_ID, sampleProjection.id);
  assert.ok(entity);
  assert.equal(trace.docGets, 1);
  assert.equal(trace.queryGets, 0);
  assert.equal(totalFirestoreDocumentsRead(trace), 1);
});
