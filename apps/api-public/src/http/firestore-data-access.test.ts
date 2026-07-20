/**
 * Unit tests for live Firestore `PublicDataAccess` bindings — mapping, gating, and reader
 * behavior over an injected fake Firestore client (no emulator or ADC required).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityProjectionDoc } from '@repo/firebase';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import {
  createFirestoreDataAccessReaders,
  mapProjectionToEntityV1,
  MAX_LIVE_SEARCH_SCAN,
  type FirestoreClientLike,
  type FirestoreDocSnapshotLike,
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

function doc(exists: boolean, data?: unknown): FirestoreDocSnapshotLike {
  return {
    exists,
    data() {
      return data;
    },
  };
}

function fakeFirestore(options: {
  readonly activeRelease?: unknown;
  readonly entities?: ReadonlyMap<string, unknown>;
}): FirestoreClientLike {
  const entities = options.entities ?? new Map<string, unknown>();
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
    collection(_path: string) {
      return {
        limit(count: number) {
          assert.equal(count, MAX_LIVE_SEARCH_SCAN);
          return {
            async get() {
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

test('mapProjectionToEntityV1 returns undefined for an unsupported kind (T3 indistinguishability)', () => {
  const mapped = mapProjectionToEntityV1({ ...sampleProjection, kind: 'person' as 'place' });
  assert.equal(mapped, undefined);
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

test('createFirestoreDataAccessReaders search scans the release entities collection (bounded)', async () => {
  const readers = createFirestoreDataAccessReaders({
    firestore: fakeFirestore({ entities: new Map([[sampleProjection.id, sampleProjection]]) }),
  });
  const page = await readers.readSearchPage(
    { q: 'seed', pageSize: 10, depth: 1, filters: {}, geo: undefined, dateRange: undefined },
    { releaseId: RELEASE_ID },
  );
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0]?.id, sampleProjection.id);
  assert.equal(page.totalMatched, 1);
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
