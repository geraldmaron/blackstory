/**
 * The two things a record now tells a reader about its surroundings, over live Postgres readers
 * with an injected fake query:
 *
 *  - which published stories cite it ("Cited in"), and
 *  - how well evidenced each connected record is, carried as INPUTS so the grade stays derived.
 *
 * The load-bearing assertion here is the memo. `buildCitesEdge` folds over every article in the
 * release; without a release-keyed cache each record open would cost a full article scan, which
 * is the exact read pattern the entity-catalog cache in this module exists to prevent.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confidenceTierFromEvidenceInputs } from '@repo/public-contracts/evidence';
import type { PublicArticleProjectionDoc, PublicEntityProjectionDoc } from '@repo/schemas';
import { createPostgresDataAccessReaders } from './postgres-data-access.js';
import type { PostgresQueryFn } from './postgres-readers.js';

const RELEASE_ID = 'rel_story_links_001';

const SUMMARY =
  'A historically documented Black community place in the District of Columbia area, tied to ' +
  'education and mutual-aid networks with published archival claims for learners and researchers.';

function projection(over: Partial<PublicEntityProjectionDoc>): PublicEntityProjectionDoc {
  return {
    id: 'ent_a',
    releaseId: RELEASE_ID,
    kind: 'place',
    displayName: 'Fifteenth Street Presbyterian Church',
    nameLower: 'fifteenth street presbyterian church',
    summary: SUMMARY,
    claimIds: [],
    topicTags: ['community'],
    historicalContext: 'Reconstruction-era congregations organized schools and mutual aid.',
    eraBuckets: ['1860s'],
    ...over,
  } as PublicEntityProjectionDoc;
}

function article(over: Partial<PublicArticleProjectionDoc>): PublicArticleProjectionDoc {
  return {
    id: 'art_1',
    releaseId: RELEASE_ID,
    slug: 'redlining',
    title: 'Redlining',
    summary: 'A chapter.',
    publishedAt: '2026-01-01',
    eraLabel: '1930s',
    placeLabel: 'Washington',
    body: [{ type: 'paragraph', text: 'Prose.' }],
    references: [],
    relatedEntityIds: [],
    ...over,
  } as PublicArticleProjectionDoc;
}

type FakeState = {
  readonly entities?: ReadonlyMap<string, PublicEntityProjectionDoc>;
  readonly articles?: readonly PublicArticleProjectionDoc[];
  /** Incremented every time the article table is read, so the memo is observable. */
  readonly counts: { articleReads: number };
};

function createFakeQuery(state: FakeState): PostgresQueryFn {
  return async (sql, params = []) => {
    if (sql.includes('published.active_release')) {
      return [
        {
          release_id: RELEASE_ID,
          activated_at: '2026-01-01T00:00:00.000Z',
          search_index_version: 'v1',
          manifest_hash: 'a'.repeat(64),
        },
      ];
    }
    if (sql.includes('published.release_articles')) {
      state.counts.articleReads += 1;
      return (state.articles ?? []).map((payload) => ({ payload }));
    }
    if (sql.includes('published.release_entities') && sql.includes('entity_id = $2')) {
      const found = state.entities?.get(params[1] as string);
      return found ? [{ projection: found }] : [];
    }
    if (sql.includes('published.release_entities') && sql.includes('entity_id = ANY')) {
      const ids = (params[1] as readonly string[]) ?? [];
      const rows: { projection: PublicEntityProjectionDoc }[] = [];
      for (const id of ids) {
        const found = state.entities?.get(id);
        if (found) rows.push({ projection: found });
      }
      return rows;
    }
    if (sql.includes('published.release_entities')) {
      return [...(state.entities?.values() ?? [])].map((p) => ({ projection: p }));
    }
    return [];
  };
}

test('a record carries the stories that cite it, with the stronger relation winning', async () => {
  const counts = { articleReads: 0 };
  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      counts,
      entities: new Map([['ent_a', projection({})]]),
      articles: [
        article({ slug: 'zoning', title: 'Zoning', relatedEntityIds: ['ent_a'] }),
        article({
          slug: 'blockbusting',
          title: 'Blockbusting',
          relatedEntityIds: ['ent_a'],
          body: [{ type: 'mapInset', entityId: 'ent_a' }],
        }),
      ],
    }),
  });

  const entity = await readers.readEntity(RELEASE_ID, 'ent_a');
  assert.deepEqual(
    entity?.citingStories?.map((story) => [story.title, story.relation, story.href]),
    [
      ['Blockbusting', 'mapped in', '/stories/blockbusting'],
      ['Zoning', 'referenced in', '/stories/zoning'],
    ],
  );
});

test('a record no story cites carries no field at all — absent, not an empty list', async () => {
  const counts = { articleReads: 0 };
  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      counts,
      entities: new Map([['ent_a', projection({})]]),
      articles: [article({ relatedEntityIds: ['ent_somewhere_else'] })],
    }),
  });

  const entity = await readers.readEntity(RELEASE_ID, 'ent_a');
  assert.equal(entity?.citingStories, undefined);
});

test('the article fold happens once per release, not once per record open', async () => {
  const counts = { articleReads: 0 };
  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      counts,
      entities: new Map([
        ['ent_a', projection({})],
        ['ent_b', projection({ id: 'ent_b', displayName: 'Second Record' })],
      ]),
      articles: [article({ relatedEntityIds: ['ent_a'] })],
    }),
  });

  await readers.readEntity(RELEASE_ID, 'ent_a');
  await readers.readEntity(RELEASE_ID, 'ent_b');
  await readers.readEntity(RELEASE_ID, 'ent_a');
  await readers.readEntities(RELEASE_ID);
  assert.equal(counts.articleReads, 1);
});

test('an unreadable article table costs story links, never the record', async () => {
  const failing: PostgresQueryFn = async (sql, params = []) => {
    if (sql.includes('published.release_articles')) throw new Error('relation does not exist');
    return createFakeQuery({
      counts: { articleReads: 0 },
      entities: new Map([['ent_a', projection({})]]),
    })(sql, params);
  };
  const readers = createPostgresDataAccessReaders({ query: failing });

  const entity = await readers.readEntity(RELEASE_ID, 'ent_a');
  assert.equal(entity?.id, 'ent_a');
  assert.equal(entity?.citingStories, undefined);
});

test('a connected record carries evidence inputs, and the grade is derived from them', async () => {
  const counts = { articleReads: 0 };
  const neighbor = projection({
    id: 'ent_neighbor',
    displayName: 'Dunbar High School',
    nameLower: 'dunbar high school',
    claimIds: ['claim_1', 'claim_2'],
    claims: [
      {
        id: 'claim_1',
        predicate: 'founded_in',
        object: '1870',
        confidenceLevel: 'high',
        citationSource: 'loc.gov',
        citationLabel: 'Library of Congress',
        claimRole: 'evidence',
      },
      {
        id: 'claim_2',
        predicate: 'located_in',
        object: 'Washington',
        confidenceLevel: 'medium',
        citationSource: 'nps.gov',
        citationLabel: 'National Park Service',
        claimRole: 'evidence',
      },
    ],
  });
  const subject = projection({
    related: [{ id: 'ent_neighbor', type: 'founded_in', direction: 'outgoing' }],
  });

  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      counts,
      entities: new Map([
        ['ent_a', subject],
        ['ent_neighbor', neighbor],
      ]),
    }),
  });

  const entity = await readers.readEntity(RELEASE_ID, 'ent_a');
  const inputs = entity?.relatedNeighbors?.[0]?.evidenceInputs;
  assert.ok(inputs, 'the connected record should carry evidence inputs');
  // Two independent corroborating lineages, strongest claim high: grade A.
  assert.equal(confidenceTierFromEvidenceInputs(inputs), 'high');
  // And no graded letter travels on the wire for the row to read out.
  assert.equal(Object.keys(entity?.relatedNeighbors?.[0] ?? {}).includes('confidenceTier'), false);
});

test('one corroborating lineage steps a connected record down, by rule not by payload', async () => {
  const counts = { articleReads: 0 };
  const neighbor = projection({
    id: 'ent_neighbor',
    displayName: 'Single-source record',
    nameLower: 'single-source record',
    claimIds: ['claim_1'],
    claims: [
      {
        id: 'claim_1',
        predicate: 'founded_in',
        object: '1870',
        confidenceLevel: 'high',
        citationSource: 'loc.gov',
        citationLabel: 'Library of Congress',
        claimRole: 'evidence',
      },
    ],
  });
  const subject = projection({
    related: [{ id: 'ent_neighbor', type: 'founded_in', direction: 'outgoing' }],
  });

  const readers = createPostgresDataAccessReaders({
    query: createFakeQuery({
      counts,
      entities: new Map([
        ['ent_a', subject],
        ['ent_neighbor', neighbor],
      ]),
    }),
  });

  const entity = await readers.readEntity(RELEASE_ID, 'ent_a');
  const inputs = entity?.relatedNeighbors?.[0]?.evidenceInputs;
  assert.ok(inputs);
  assert.equal(confidenceTierFromEvidenceInputs(inputs), 'medium');
});
