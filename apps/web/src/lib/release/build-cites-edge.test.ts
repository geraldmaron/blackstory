/**
 * The story-cites-record edge. The load-bearing assertion is the relation precedence: a story
 * that both maps a record and lists it as related must read "mapped in", because telling a reader
 * a story merely "referenced" a record it drew a map of understates the archive's own evidence.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicArticleProjectionDoc } from '@repo/schemas';
import { articleCitedEntities, buildCitesEdge, storiesCiting } from './build-cites-edge';

function doc(over: Partial<PublicArticleProjectionDoc>): PublicArticleProjectionDoc {
  return {
    id: 'art_1',
    releaseId: 'rel_1',
    slug: 'redlining',
    title: 'Redlining',
    summary: 'A chapter.',
    publishedAt: '2026-01-01',
    eraLabel: '1930s',
    placeLabel: 'Chicago',
    body: [{ type: 'paragraph', text: 'Prose.' }],
    references: [],
    relatedEntityIds: [],
    ...over,
  } as PublicArticleProjectionDoc;
}

test('a mapInset block cites its entity as "mapped in"', () => {
  const cited = articleCitedEntities(doc({ body: [{ type: 'mapInset', entityId: 'ent_a' }] }));
  assert.equal(cited.get('ent_a'), 'mapped in');
});

test('relatedEntityIds cite as the weaker "referenced in"', () => {
  const cited = articleCitedEntities(doc({ relatedEntityIds: ['ent_a'] }));
  assert.equal(cited.get('ent_a'), 'referenced in');
});

test('mapping a record outranks merely relating it, in either declaration order', () => {
  const mapped = articleCitedEntities(
    doc({ relatedEntityIds: ['ent_a'], body: [{ type: 'mapInset', entityId: 'ent_a' }] }),
  );
  assert.equal(mapped.get('ent_a'), 'mapped in');
});

test('the index inverts articles onto records, sorted by story title', () => {
  const index = buildCitesEdge([
    doc({ slug: 'zoning', title: 'Zoning', relatedEntityIds: ['ent_a'] }),
    doc({
      slug: 'blockbusting',
      title: 'Blockbusting',
      body: [{ type: 'mapInset', entityId: 'ent_a' }],
    }),
  ]);
  assert.deepEqual(
    index['ent_a']?.map((c) => [c.title, c.relation, c.href]),
    [
      ['Blockbusting', 'mapped in', '/stories/blockbusting'],
      ['Zoning', 'referenced in', '/stories/zoning'],
    ],
  );
});

test('a record no story cites is absent, and reads as an empty list', () => {
  const index = buildCitesEdge([doc({ relatedEntityIds: ['ent_a'] })]);
  assert.equal(index['ent_b'], undefined);
  assert.deepEqual(storiesCiting(index, 'ent_b'), []);
  assert.deepEqual(storiesCiting(index, undefined), []);
});

test('blank entity ids never become an edge', () => {
  const index = buildCitesEdge([doc({ relatedEntityIds: ['  '] })]);
  assert.deepEqual(Object.keys(index), []);
});
