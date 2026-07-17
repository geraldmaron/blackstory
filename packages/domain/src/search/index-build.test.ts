/**
 * Tests for the notability-basis inclusion gate holds AT THE SEARCH BOUNDARY as
 * defense-in-depth. A record lacking a notability basis is SKIPPED (not indexed) and reported,
 * and one bad record never aborts the whole batch.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicSearchIndexDocs } from './index-build.js';
import type { SearchableEntityRecord } from './types.js';

function record(
  overrides: Partial<SearchableEntityRecord> & Pick<SearchableEntityRecord, 'id' | 'displayName'>,
): SearchableEntityRecord {
  const displayName = overrides.displayName;
  return {
    kind: 'place',
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...overrides,
    id: overrides.id,
    displayName,
    nameLower: overrides.nameLower ?? displayName.toLowerCase(),
  };
}

test('a good record is indexed and a gate-failing record is skipped in the same batch, without throwing', () => {
  const good = record({ id: 'good', displayName: 'Documented Place' });
  const bad = record({ id: 'bad', displayName: 'Undocumented Place', notabilityBasis: [] });

  let result: ReturnType<typeof buildPublicSearchIndexDocs> | undefined;
  assert.doesNotThrow(() => {
    result = buildPublicSearchIndexDocs('rel-2026-07', [good, bad]);
  });
  assert.ok(result);

  assert.deepEqual(
    result.docs.map((d) => d.id),
    ['good'],
  );
  assert.equal(result.docs[0]?.releaseId, 'rel-2026-07');

  assert.deepEqual(
    result.skipped.map((s) => s.id),
    ['bad'],
  );
  assert.match(result.skipped[0]?.reason ?? '', /notabilityBasis/);
});

test('the indexed doc is a structural superset carrying releaseId plus every searchable field', () => {
  const rec = record({ id: 'e1', displayName: 'Alpha', aliases: ['beta'], topicTags: ['education'] });
  const { docs } = buildPublicSearchIndexDocs('rel-1', [rec]);
  const doc = docs[0];
  assert.ok(doc);
  assert.equal(doc.releaseId, 'rel-1');
  assert.equal(doc.nameLower, 'alpha');
  assert.deepEqual(doc.aliases, ['beta']);
  assert.deepEqual(doc.topicTags, ['education']);
});

test('an all-bad batch yields no docs and does not throw', () => {
  const bad1 = record({ id: 'b1', displayName: 'B1', notabilityBasis: [] });
  const bad2 = record({ id: 'b2', displayName: 'B2', notabilityBasis: [] });
  const { docs, skipped } = buildPublicSearchIndexDocs('rel-1', [bad1, bad2]);
  assert.equal(docs.length, 0);
  assert.deepEqual(
    skipped.map((s) => s.id),
    ['b1', 'b2'],
  );
});
