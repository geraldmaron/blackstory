/**
 * Unit tests for live Postgres `PublicDataAccess` bindings — mapping and reader behavior over an
 * injected fake query function (no live DATABASE_URL required).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicEntityProjectionDoc } from '@repo/schemas';
import { entityV1Schema } from '@repo/public-contracts/v1/entity';
import { createPublicDataAccessFromReaders, searchOverIndex } from './data-access.js';
import {
  createPostgresDataAccessReaders,
  mapPublicSearchProjection,
} from './postgres-data-access.js';
import type { PostgresQueryFn } from './postgres-readers.js';
import type { CanonicalSearchQuery } from '@repo/security';

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
  historicalContext:
    'Reconstruction-era Black communities organized schools and mutual aid networks.',
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
    if (sql.includes('published.active_release')) {
      return state.activeRelease ? [state.activeRelease] : [];
    }
    if (sql.includes('published.release_entities') && sql.includes('entity_id = $2')) {
      const releaseId = params[0] as string;
      const entityId = params[1] as string;
      const projection = state.entities?.get(`${releaseId}:${entityId}`);
      return projection ? [{ projection }] : [];
    }
    if (sql.includes('published.release_entities') && sql.includes('entity_id = ANY')) {
      const releaseId = params[0] as string;
      const ids = (params[1] as readonly string[]) ?? [];
      const rows: { projection: PublicEntityProjectionDoc }[] = [];
      for (const entityId of ids) {
        const projection = state.entities?.get(`${releaseId}:${entityId}`);
        if (projection) rows.push({ projection });
      }
      return rows;
    }
    if (sql.includes('published.release_entities') && sql.includes('ORDER BY entity_id')) {
      const releaseId = params[0] as string;
      const rows: { projection: PublicEntityProjectionDoc }[] = [];
      for (const [key, projection] of state.entities ?? []) {
        if (key.startsWith(`${releaseId}:`)) rows.push({ projection });
      }
      return rows;
    }
    if (sql.includes('published.search_index')) {
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
  const access = createPublicDataAccessFromReaders(readers);
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
  const access = createPublicDataAccessFromReaders(readers);
  const entity = await access.getEntity(RELEASE_ID, sampleProjection.id);
  assert.ok(entity);
  assert.equal(entity?.displayName, sampleProjection.displayName);
  assert.equal(entityV1Schema.safeParse(entity).success, true);
});

test('createPostgresDataAccessReaders hydrates relatedNeighbors via one ANY() batch', async () => {
  const neighbor: PublicEntityProjectionDoc = {
    ...sampleProjection,
    id: 'ent_seed_person_001',
    displayName: 'Seed Neighbor',
    nameLower: 'seed neighbor',
    kind: 'person',
    related: [
      {
        id: sampleProjection.id,
        type: 'related_to',
        direction: 'outgoing',
      },
    ],
  };
  const rooted: PublicEntityProjectionDoc = {
    ...sampleProjection,
    related: [
      {
        id: neighbor.id,
        type: 'related_to',
        direction: 'outgoing',
      },
    ],
  };

  let anyBatchCalls = 0;
  const baseQuery = createFakeQuery({
    entities: new Map([
      [`${RELEASE_ID}:${rooted.id}`, rooted],
      [`${RELEASE_ID}:${neighbor.id}`, neighbor],
    ]),
  });
  const countingQuery: PostgresQueryFn = async (sql, params) => {
    if (sql.includes('entity_id = ANY')) anyBatchCalls += 1;
    return baseQuery(sql, params);
  };

  const readers = createPostgresDataAccessReaders({ query: countingQuery });
  const access = createPublicDataAccessFromReaders(readers);
  const entity = await access.getEntity(RELEASE_ID, rooted.id);

  assert.ok(entity);
  assert.equal(anyBatchCalls, 1, 'one-hop only: no second ANY when two-hop set is empty');
  assert.equal(entity?.relatedNeighbors?.length, 1);
  assert.equal(entity?.relatedNeighbors?.[0]?.id, neighbor.id);
  assert.equal(entity?.relatedNeighbors?.[0]?.displayName, 'Seed Neighbor');
  assert.equal(entityV1Schema.safeParse(entity).success, true);
});

test('createPostgresDataAccessReaders skips neighbor hydrate when related is absent', async () => {
  let anyBatchCalls = 0;
  const baseQuery = createFakeQuery({
    entities: new Map([[`${RELEASE_ID}:${sampleProjection.id}`, sampleProjection]]),
  });
  const countingQuery: PostgresQueryFn = async (sql, params) => {
    if (sql.includes('entity_id = ANY')) anyBatchCalls += 1;
    return baseQuery(sql, params);
  };

  const readers = createPostgresDataAccessReaders({ query: countingQuery });
  const access = createPublicDataAccessFromReaders(readers);
  const entity = await access.getEntity(RELEASE_ID, sampleProjection.id);

  assert.ok(entity);
  assert.equal(anyBatchCalls, 0);
  assert.equal(entity?.relatedNeighbors, undefined);
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
  const access = createPublicDataAccessFromReaders(readers);
  const page = await access.search(
    { q: '', depth: 1, pageSize: 10, filters: [], sort: 'relevance' },
    { releaseId: RELEASE_ID },
  );
  assert.ok(page.results.length >= 1);
  assert.equal(page.results[0]?.id, sampleProjection.id);
});

test('createPostgresDataAccessReaders caches readEntities per release id', async () => {
  let queryCalls = 0;
  const baseQuery = createFakeQuery({
    entities: new Map([[`${RELEASE_ID}:${sampleProjection.id}`, sampleProjection]]),
  });
  const countingQuery: PostgresQueryFn = async (sql, params) => {
    if (sql.includes('published.release_entities') && sql.includes('ORDER BY entity_id')) {
      queryCalls += 1;
    }
    return baseQuery(sql, params);
  };

  const readers = createPostgresDataAccessReaders({ query: countingQuery });
  const access = createPublicDataAccessFromReaders(readers);

  const first = await access.listEntities(RELEASE_ID);
  const second = await access.listEntities(RELEASE_ID);

  assert.equal(queryCalls, 1, 'second call within the TTL window must hit the cache, not Postgres');
  assert.equal(first.length, 1);
  assert.deepEqual(second, first);
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
    evidenceInputs: {
      strongestClaimLevel: 'high',
      citedLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
      evidenceLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
    },
    geohash: 'dqcjq',
  });
  assert.equal(mapped.displayName, sampleProjection.displayName);
  assert.equal(mapped.jurisdictionState, 'DC');
  assert.deepEqual(mapped.evidenceInputs, {
    strongestClaimLevel: 'high',
    citedLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
    evidenceLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
  });
  assert.equal(mapped.geohash, 'dqcjq');
});

/**
 * The index-backed search path grades at READ time from the inputs the doc carries. The doc must
 * never hold a finished tier: a cached grade survives a rule change and strands the surface
 * reading it, which is why `search_index` projects `evidenceInputs` and nothing graded.
 */
function indexDoc(
  overrides: Partial<Parameters<typeof mapPublicSearchProjection>[0]> = {},
): ReturnType<typeof mapPublicSearchProjection> {
  return mapPublicSearchProjection({
    id: 'ent_index_001',
    releaseId: RELEASE_ID,
    kind: 'place',
    displayName: 'Dunbar High School',
    nameLower: 'dunbar high school',
    aliases: [],
    topicTags: [],
    topicIds: [],
    mentionedEntityIds: [],
    keywords: [],
    campaignIds: [],
    eraBuckets: ['1910s'],
    notabilityBasis: [],
    notabilityLabels: ['Community landmark.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    relatedCount: 0,
    claimCount: 2,
    summary: 'A school.',
    ...overrides,
  });
}

const INDEX_QUERY: CanonicalSearchQuery = {
  q: 'dunbar',
  filters: [],
  sort: 'relevance',
  pageSize: 20,
  depth: 1,
  shape: 'text_filters',
};

test('searchOverIndex derives the tier from the doc evidence inputs, never from a cached grade', () => {
  const page = searchOverIndex(
    [
      indexDoc({
        evidenceInputs: {
          strongestClaimLevel: 'high',
          citedLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
          evidenceLineageKeys: ['npgallery.nps.gov', 'catalog.archives.gov'],
        },
      }),
    ],
    INDEX_QUERY,
  );
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0]?.confidenceTier, 'high');
});

test('searchOverIndex applies the corroboration rule at read time, not the stored level', () => {
  // One corroborating lineage only. The stored `strongestClaimLevel` is `high`; the RULE steps it
  // down. A doc carrying a pre-graded tier could not express this, which is the whole point.
  const page = searchOverIndex(
    [
      indexDoc({
        evidenceInputs: {
          strongestClaimLevel: 'high',
          citedLineageKeys: ['npgallery.nps.gov'],
          evidenceLineageKeys: ['npgallery.nps.gov'],
        },
      }),
    ],
    INDEX_QUERY,
  );
  assert.equal(page.results[0]?.confidenceTier, 'medium');
});

test('searchOverIndex leaves the tier absent for a doc published before evidenceInputs existed', () => {
  const page = searchOverIndex([indexDoc()], INDEX_QUERY);
  assert.equal(page.results.length, 1);
  assert.ok(
    !('confidenceTier' in (page.results[0] ?? {})),
    'an ungradeable doc must report no grade rather than a fabricated `unrated`',
  );
});

test('searchOverIndex never projects the server-internal counts onto a result', () => {
  const page = searchOverIndex(
    [
      indexDoc({
        evidenceInputs: {
          strongestClaimLevel: 'medium',
          citedLineageKeys: ['a.example', 'b.example'],
          evidenceLineageKeys: ['a.example', 'b.example'],
        },
      }),
    ],
    INDEX_QUERY,
  );
  const result = (page.results[0] ?? {}) as Record<string, unknown>;
  for (const forbidden of ['evidenceCount', 'claimCount', 'relatedCount', 'score']) {
    assert.ok(!(forbidden in result), `${forbidden} must not reach a search result`);
  }
});
