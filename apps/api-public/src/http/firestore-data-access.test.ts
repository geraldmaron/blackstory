/**
 * Unit tests for live Firestore `PublicDataAccess` bindings — mapping, gating, index-backed
 * search, fallback entity scan, and reader behavior over an injected fake Firestore client.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityProjectionDoc } from '@repo/firebase';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import {
  createFirestoreDataAccessReaders,
  loadReleaseSearchIndexDocs,
  loadReleaseSearchIndexForSearch,
  mapProjectionToEntityV1,
  mapSearchIndexDoc,
  MAX_LIVE_SEARCH_SCAN,
  SEARCH_INDEX_PAGE_SIZE,
  type FirestoreClientLike,
  type FirestoreDocSnapshotLike,
  type FirestoreQueryLike,
  type FirestoreQuerySnapshotLike,
} from './firestore-data-access.js';
import { createFirestorePublicDataAccess } from './data-access.js';

const RELEASE_ID = 'rel_seed_001';
const MANIFEST_HASH = 'a'.repeat(64);

const sampleProjection: PublicEntityProjectionDoc = {
  id: 'ent_seed_place_001',
  releaseId: RELEASE_ID,
  kind: 'place',
  displayName: 'Seed Historical Place',
  nameLower: 'seed historical place',
  summary:
    'A historically documented Black community place in the District of Columbia area, tied to education ' +
    'and mutual-aid networks with published archival claims for learners and researchers.',
  location: {
    lat: 38.9072,
    lng: -77.0369,
    geohash: 'dqcjq',
    precision: 'city',
    matchMethod: 'manual_research',
  },
  claimIds: ['claim_seed_001'],
  topicTags: ['community', 'education'],
  historicalContext: 'Reconstruction-era Black communities organized schools and mutual aid networks.',
  eraBuckets: ['1860s'],
};

const sampleSearchIndexDoc = {
  id: 'ent_seed_place_001',
  releaseId: RELEASE_ID,
  kind: 'place' as const,
  displayName: 'Seed Historical Place',
  nameLower: 'seed historical place',
  aliases: ['seed place'],
  summary: sampleProjection.summary,
  topicTags: ['community', 'education'],
  eraBuckets: ['1860s'],
  notabilityBasis: [{ criterion: 'community_landmark', note: 'Documented site.', evidenceIds: [] }],
  notabilityLabels: ['Community landmark.'],
  recordMaturity: 'projection_stub',
  researchCoverage: 'minimal' as const,
  relatedCount: 1,
  claimCount: 0,
};

const secondSearchIndexDoc = {
  ...sampleSearchIndexDoc,
  id: 'ent_seed_place_002',
  displayName: 'Second Seed Place',
  nameLower: 'second seed place',
  aliases: [],
  summary: 'Another seed place for pagination coverage.',
};

function doc(exists: boolean, data?: unknown, id?: string): FirestoreDocSnapshotLike {
  return {
    ...(id !== undefined ? { id } : {}),
    exists,
    data() {
      return data;
    },
  };
}

type FakeFirestoreTrace = {
  entityScans: number;
  searchIndexQueries: number;
};

function fakeFirestore(options: {
  readonly activeRelease?: unknown;
  readonly entities?: ReadonlyMap<string, unknown>;
  readonly searchIndex?: ReadonlyMap<string, unknown>;
  readonly trace?: FakeFirestoreTrace;
}): FirestoreClientLike {
  const entities = options.entities ?? new Map<string, unknown>();
  const searchIndex = options.searchIndex ?? new Map<string, unknown>();
  const trace = options.trace;

  function buildSearchIndexQuery(releaseId: string): FirestoreQueryLike {
    let startAfterId: string | undefined;
    let pageLimit = SEARCH_INDEX_PAGE_SIZE;

    const self: FirestoreQueryLike = {
      where(field: string, op: '==', value: string) {
        assert.equal(field, 'releaseId');
        assert.equal(op, '==');
        assert.equal(value, releaseId);
        return self;
      },
      orderBy(field: string) {
        assert.equal(field, '__name__');
        return self;
      },
      limit(count: number) {
        pageLimit = count;
        return self;
      },
      startAfter(snapshot: FirestoreDocSnapshotLike) {
        startAfterId = snapshot.id;
        return self;
      },
      async get(): Promise<FirestoreQuerySnapshotLike> {
        if (trace) trace.searchIndexQueries += 1;
        const rows = [...searchIndex.entries()]
          .map(([id, data]) => ({ id, data }))
          .filter(({ data }) => {
            const parsed = data as { releaseId?: string };
            return parsed.releaseId === releaseId;
          })
          .sort((a, b) => a.id.localeCompare(b.id));

        const startIndex =
          startAfterId === undefined
            ? 0
            : rows.findIndex((row) => row.id === startAfterId) + 1;
        const page = rows.slice(startIndex, startIndex + pageLimit);
        const docs = page.map(({ id, data }) => doc(true, data, id));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
    return self;
  }

  return {
    doc(path: string) {
      if (path.endsWith('/activeRelease')) {
        return {
          async get() {
            return options.activeRelease === undefined
              ? doc(false)
              : doc(true, options.activeRelease);
          },
        };
      }
      const entityId = path.split('/').at(-1) ?? '';
      return {
        async get() {
          const data = entities.get(entityId);
          return data === undefined ? doc(false) : doc(true, data);
        },
      };
    },
    collection(path: string) {
      if (path === 'publicSearchIndex') {
        return {
          limit() {
            throw new Error('publicSearchIndex reads must use where/orderBy, not bare limit');
          },
          where(_field: string, _op: '==', releaseId: string) {
            return buildSearchIndexQuery(releaseId);
          },
        };
      }

      return {
        limit(count: number) {
          assert.equal(count, MAX_LIVE_SEARCH_SCAN);
          return {
            async get() {
              if (trace) trace.entityScans += 1;
              return {
                docs: [...entities.entries()].map(([id, data]) => ({
                  exists: true,
                  data() {
                    return { ...(data as object), id };
                  },
                })),
              };
            },
          };
        },
        where() {
          throw new Error('entity fallback does not use where queries');
        },
      };
    },
  };
}

test('mapProjectionToEntityV1 maps a supported projection and validates against entityV1Schema', () => {
  const mapped = mapProjectionToEntityV1(sampleProjection);
  assert.ok(mapped);
  assert.equal(mapped.id, 'ent_seed_place_001');
  assert.equal(mapped.kind, 'place');
  assert.equal(mapped.recordMaturity, 'projection_stub');
  assert.deepEqual(mapped.claims, []);
  assert.deepEqual(mapped.timeline, []);
  assert.equal(mapped.jurisdictionLabel, 'District of Columbia');
  assert.equal(entityV1Schema.safeParse(mapped).success, true);
});

test('mapProjectionToEntityV1 maps inline claims and release metadata when present', () => {
  const enriched: PublicEntityProjectionDoc = {
    ...sampleProjection,
    jurisdictionLabel: 'Washington, D.C.',
    locationLabel: 'Washington, D.C.',
    researchCoverage: 'partial',
    generatedAt: '2026-07-19T12:00:00.000Z',
    recordUpdatedAt: '2026-07-19T12:00:00.000Z',
    claims: [
      {
        id: 'claim_seed_001',
        predicate: 'located_in',
        object: 'Washington, D.C.',
        confidenceLevel: 'high',
        citationSource: 'National Register nomination, 1973',
        citationLabel: 'NRHP nomination',
        citationHref: 'https://example.org/nrhp',
        independentLineageCount: 2,
      },
    ],
  };
  const mapped = mapProjectionToEntityV1(enriched);
  assert.ok(mapped);
  assert.equal(mapped.recordMaturity, 'partial_enrichment');
  assert.equal(mapped.researchCoverage, 'partial');
  assert.equal(mapped.jurisdictionLabel, 'Washington, D.C.');
  assert.equal(mapped.locationLabel, 'Washington, D.C.');
  assert.equal(mapped.claims.length, 1);
  assert.equal(mapped.claims[0]?.id, 'claim_seed_001');
  assert.equal(mapped.claims[0]?.confidenceScore, 0.85);
  assert.equal(mapped.claims[0]?.citation.source, 'National Register nomination, 1973');
  assert.equal(mapped.claims[0]?.citation.href, 'https://example.org/nrhp');
  assert.equal(mapped.claims[0]?.independentLineageCount, 2);
  assert.deepEqual(mapped.timeline, []);
  assert.equal(mapped.revision.generatedAt, '2026-07-19T12:00:00.000Z');
  assert.equal(mapped.revision.recordUpdatedAt, '2026-07-19T12:00:00.000Z');
  assert.equal(entityV1Schema.safeParse(mapped).success, true);
});

test('mapProjectionToEntityV1 maps person (and other full-ontology kinds) for Explore parity', () => {
  const mapped = mapProjectionToEntityV1({ ...sampleProjection, kind: 'person' as 'place' });
  assert.equal(mapped?.kind, 'person');
  assert.equal(mapped?.id, sampleProjection.id);
});

test('mapProjectionToEntityV1 returns undefined for an unsupported kind (T3 indistinguishability)', () => {
  const mapped = mapProjectionToEntityV1({ ...sampleProjection, kind: 'spaceship' as 'place' });
  assert.equal(mapped, undefined);
});

test('mapProjectionToEntityV1 defaults matchMethod when location omits it', () => {
  const mapped = mapProjectionToEntityV1({
    ...sampleProjection,
    location: {
      lat: 38.9,
      lng: -77.0,
      geohash: 'dqcjq',
      precision: 'city',
    },
  });
  assert.equal(mapped?.geoAnchor?.matchMethod, 'release_projection');
  assert.equal(mapped?.geoAnchor?.lat, 38.9);
});

test('mapSearchIndexDoc maps Firestore search-index docs for runPublicSearch', () => {
  const mapped = mapSearchIndexDoc(sampleSearchIndexDoc);
  assert.equal(mapped.id, sampleSearchIndexDoc.id);
  assert.equal(mapped.releaseId, RELEASE_ID);
  assert.equal(mapped.nameLower, 'seed historical place');
  assert.equal(mapped.relatedCount, 1);
});

test('loadReleaseSearchIndexDocs pages release-scoped publicSearchIndex queries', async () => {
  const index = new Map<string, unknown>();
  for (let i = 0; i < SEARCH_INDEX_PAGE_SIZE + 1; i += 1) {
    const id = `ent_page_${String(i).padStart(3, '0')}`;
    index.set(id, { ...sampleSearchIndexDoc, id, releaseId: RELEASE_ID, nameLower: `page ${i}` });
  }
  index.set('ent_other_release', { ...sampleSearchIndexDoc, id: 'ent_other_release', releaseId: 'rel_other' });

  const firestore = fakeFirestore({ searchIndex: index });
  const loaded = await loadReleaseSearchIndexDocs(firestore, RELEASE_ID);
  assert.equal(loaded.length, SEARCH_INDEX_PAGE_SIZE + 1);
  assert.ok(loaded.every((row) => row.releaseId === RELEASE_ID));
});

test('createFirestoreDataAccessReaders collapses missing active release to undefined', async () => {
  const readers = createFirestoreDataAccessReaders({ firestore: fakeFirestore({}) });
  assert.equal(await readers.readReleasePointer(), undefined);
});

test('createFirestoreDataAccessReaders reads active release pointer from publicMeta/activeRelease', async () => {
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({
      activeRelease: {
        releaseId: RELEASE_ID,
        activatedAt: '2026-07-19T00:00:00.000Z',
        searchIndexVersion: 'idx_seed',
        manifestHash: MANIFEST_HASH,
      },
    }),
  });
  const pointer = await readers.readReleasePointer();
  assert.deepEqual(pointer, {
    activeRelease: {
      releaseId: RELEASE_ID,
      generatedAt: '2026-07-19T00:00:00.000Z',
      recordUpdatedAt: '2026-07-19T00:00:00.000Z',
    },
    searchIndexVersion: 'idx_seed',
  });
});

test('createFirestoreDataAccessReaders collapses missing/invalid entity docs to undefined', async () => {
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({ entities: new Map([['bad', { not: 'a projection' }]]) }),
  });
  assert.equal(await readers.readEntity(RELEASE_ID, 'missing'), undefined);
  assert.equal(await readers.readEntity(RELEASE_ID, 'bad'), undefined);
});

test('createFirestoreDataAccessReaders search uses publicSearchIndex when rows exist', async () => {
  const trace = { entityScans: 0, searchIndexQueries: 0 };
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({
      trace,
      searchIndex: new Map([[sampleSearchIndexDoc.id, sampleSearchIndexDoc]]),
      entities: new Map([[sampleProjection.id, sampleProjection]]),
    }),
    // Unit tests must not hit live public-media CDN (rel_seed_001 is published).
    fetchSearchIndexArtifact: async () => undefined,
  });
  const page = await readers.readSearchPage(
    { q: 'seed', pageSize: 10, depth: 1, filters: [], geo: undefined, dateRange: undefined, sort: 'relevance', shape: 'search' },
    { releaseId: RELEASE_ID },
  );
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0]?.id, sampleSearchIndexDoc.id);
  assert.equal(page.totalMatched, 1);
  assert.equal(trace.searchIndexQueries, 1);
  assert.equal(trace.entityScans, 0);
  assert.equal(page.facets.kind.place, 1);
});

test('createFirestoreDataAccessReaders search paginates index-backed results by depth', async () => {
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({
      searchIndex: new Map([
        [sampleSearchIndexDoc.id, sampleSearchIndexDoc],
        [secondSearchIndexDoc.id, secondSearchIndexDoc],
      ]),
    }),
    fetchSearchIndexArtifact: async () => undefined,
  });
  const page1 = await readers.readSearchPage(
    { q: 'seed', pageSize: 1, depth: 1, filters: [], geo: undefined, dateRange: undefined, sort: 'relevance', shape: 'search' },
    { releaseId: RELEASE_ID },
  );
  const page2 = await readers.readSearchPage(
    { q: 'seed', pageSize: 1, depth: 2, filters: [], geo: undefined, dateRange: undefined, sort: 'relevance', shape: 'search' },
    { releaseId: RELEASE_ID },
  );
  assert.equal(page1.results.length, 1);
  assert.equal(page1.hasMore, true);
  assert.equal(page2.results.length, 1);
  assert.notEqual(page1.results[0]?.id, page2.results[0]?.id);
});

test('loadReleaseSearchIndexForSearch prefers search-index.json artifact over Firestore', async () => {
  const trace = { entityScans: 0, searchIndexQueries: 0 };
  const loaded = await loadReleaseSearchIndexForSearch(fakeFirestore({ trace }), RELEASE_ID, {
    fetchSearchIndexArtifact: async () => ({
      schemaVersion: 1,
      releaseId: RELEASE_ID,
      generatedAt: '2026-07-20T00:00:00.000Z',
      docCount: 1,
      docs: [sampleSearchIndexDoc],
    }),
  });
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0]?.id, sampleSearchIndexDoc.id);
  assert.equal(trace.searchIndexQueries, 0);
});

test('createFirestoreDataAccessReaders search prefers search-index.json artifact over Firestore', async () => {
  const trace = { entityScans: 0, searchIndexQueries: 0 };
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({
      trace,
      searchIndex: new Map([
        [
          'ent_firestore_only',
          { ...sampleSearchIndexDoc, id: 'ent_firestore_only', nameLower: 'firestore only' },
        ],
      ]),
    }),
    fetchSearchIndexArtifact: async () => ({
      schemaVersion: 1,
      releaseId: RELEASE_ID,
      generatedAt: '2026-07-20T00:00:00.000Z',
      docCount: 1,
      docs: [sampleSearchIndexDoc],
    }),
  });
  const page = await readers.readSearchPage(
    { q: 'seed', pageSize: 10, depth: 1, filters: [], geo: undefined, dateRange: undefined, sort: 'relevance', shape: 'search' },
    { releaseId: RELEASE_ID },
  );
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0]?.id, sampleSearchIndexDoc.id);
  assert.equal(trace.searchIndexQueries, 0);
  assert.equal(trace.entityScans, 0);
});

test('createFirestoreDataAccessReaders search falls back to bounded entity scan when index is absent', async () => {
  const trace = { entityScans: 0, searchIndexQueries: 0 };
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({
      trace,
      entities: new Map([[sampleProjection.id, sampleProjection]]),
    }),
    fetchSearchIndexArtifact: async () => undefined,
  });
  const page = await readers.readSearchPage(
    { q: 'seed', pageSize: 10, depth: 1, filters: [], geo: undefined, dateRange: undefined, sort: 'relevance', shape: 'search' },
    { releaseId: RELEASE_ID },
  );
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0]?.id, sampleProjection.id);
  assert.equal(trace.searchIndexQueries, 1);
  assert.equal(trace.entityScans, 1);
  assert.deepEqual(page.facets, {
    kind: {},
    status: {},
    era: {},
    theme: {},
    state: {},
    recordMaturity: {},
    researchCoverage: {},
  });
});

test('createFirestorePublicDataAccess re-validates mapped entities at the port boundary', async () => {
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({ entities: new Map([[sampleProjection.id, sampleProjection]]) }),
  });
  const port = createFirestorePublicDataAccess(readers);
  const entity = await port.getEntity(RELEASE_ID, sampleProjection.id);
  assert.ok(entity);
  assert.equal(entityV1Schema.safeParse(entity).success, true);
});
