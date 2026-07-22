/**
 * Unit tests for live Postgres `PublicDataAccess` bindings — mapping and reader behavior over an
 * injected fake query function (no live DATABASE_URL required).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityProjectionDoc } from '@repo/schemas';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import { createFirestorePublicDataAccess } from './data-access.js';
import {
  createPostgresDataAccessReaders,
  mapPublicSearchProjection,
} from './postgres-data-access.js';
import type { PostgresQueryFn } from './postgres-readers.js';

const RELEASE_ID = 'rel_seed_001';

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

function createFakeQuery(state: {
  readonly activeRelease?: {
    readonly release_id: string;
    readonly activated_at: string;
    readonly search_index_version: string;
    readonly manifest_hash: string;
  };
  readonly entities?: ReadonlyMap<string, PublicEntityProjectionDoc>;
  readonly searchRows?: readonly Record<string, unknown>[];
}): PostgresQueryFn {
  return async (sql, params = []) => {
    if (sql.includes('bb_public.active_release')) {
      return state.activeRelease ? [state.activeRelease] : [];
    }
    if (sql.includes('bb_public.release_entities') && sql.includes('entity_id = $2')) {
      const releaseId = params[0] as string;
      const entityId = params[1] as string;
      const projection = state.entities?.get(`${releaseId}:${entityId}`);
      return projection ? [{ projection }] : [];
    }
    if (sql.includes('bb_public.release_entities') && sql.includes('ORDER BY entity_id')) {
      const releaseId = params[0] as string;
      const rows: { projection: PublicEntityProjectionDoc }[] = [];
      for (const [key, projection] of state.entities ?? []) {
        if (key.startsWith(`${releaseId}:`)) rows.push({ projection });
      }
      return rows;
    }
    if (sql.includes('bb_public.search_index')) {
      return state.searchRows ?? [];
    }
    return [];
  };
}

test('createPostgresDataAccessReaders maps active release pointer', async () => {
  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      activeRelease: {
        release_id: RELEASE_ID,
        activated_at: '2026-01-01T00:00:00.000Z',
        search_index_version: 'idx_v1',
        manifest_hash: 'a'.repeat(64),
      },
    }),
  });
  const access = createFirestorePublicDataAccess(readers);
  const pointer = await access.getReleasePointer();
  assert.equal(pointer?.activeRelease.releaseId, RELEASE_ID);
  assert.equal(pointer?.searchIndexVersion, 'idx_v1');
});

test('createPostgresDataAccessReaders maps entity projection to EntityV1', async () => {
  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      entities: new Map([[`${RELEASE_ID}:${sampleProjection.id}`, sampleProjection]]),
    }),
  });
  const access = createFirestorePublicDataAccess(readers);
  const entity = await access.getEntity(RELEASE_ID, sampleProjection.id);
  assert.ok(entity);
  assert.equal(entity?.displayName, sampleProjection.displayName);
  assert.equal(entityV1Schema.safeParse(entity).success, true);
});

test('createPostgresDataAccessReaders uses search index when present', async () => {
  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      searchRows: [
        {
          id: sampleProjection.id,
          release_id: RELEASE_ID,
          entity_id: sampleProjection.id,
          name: sampleProjection.displayName,
          name_lower: sampleProjection.nameLower,
          aliases: ['seed place'],
          topics: ['community', 'education'],
          kind: 'place',
          status: null,
          geohash: 'dqcjq',
          related_count: 0,
          claim_count: 1,
          facets: {
            id: sampleProjection.id,
            releaseId: RELEASE_ID,
            kind: 'place',
            displayName: sampleProjection.displayName,
            nameLower: sampleProjection.nameLower,
            aliases: ['seed place'],
            summary: sampleProjection.summary,
            topicTags: ['community', 'education'],
            eraBuckets: ['1860s'],
            notabilityBasis: [],
            notabilityLabels: ['Community landmark.'],
            recordMaturity: 'minimum_record',
            researchCoverage: 'minimal',
            relatedCount: 0,
            claimCount: 1,
            topicIds: [],
          },
        },
      ],
    }),
  });
  const access = createFirestorePublicDataAccess(readers);
  const page = await access.search(
    { q: '', depth: 1, pageSize: 10, filters: [], sort: 'relevance' },
    { releaseId: RELEASE_ID },
  );
  assert.ok(page.results.length >= 1);
  assert.equal(page.results[0]?.id, sampleProjection.id);
});

test('mapPublicSearchProjection preserves domain search fields', () => {
  const mapped = mapPublicSearchProjection({
    id: sampleProjection.id,
    releaseId: RELEASE_ID,
    kind: 'place',
    displayName: sampleProjection.displayName,
    nameLower: sampleProjection.nameLower,
    aliases: [],
    topicTags: ['community'],
    topicIds: [],
    mentionedEntityIds: [],
    keywords: [],
    campaignIds: [],
    eraBuckets: ['1860s'],
    notabilityBasis: [],
    notabilityLabels: ['Community landmark.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    relatedCount: 0,
    claimCount: 1,
    summary: sampleProjection.summary,
    jurisdictionState: 'DC',
    status: 'extant',
    sensitivityClass: 'standard',
  });
  assert.equal(mapped.displayName, sampleProjection.displayName);
  assert.equal(mapped.jurisdictionState, 'DC');
});
