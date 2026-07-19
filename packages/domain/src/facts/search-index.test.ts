import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankRecords } from '../search/ranking.js';
import { buildFixtureCitation, buildFixtureFact } from './fixtures.js';
import { buildFactSearchIndexDoc, buildFactSearchIndexDocs } from './search-index.js';

test('a published, citation-complete fact produces a real search index doc', () => {
  const fact = buildFixtureFact();
  const result = buildFactSearchIndexDoc(fact, 'release-1');
  assert.ok(!('skipped' in result));
  if (!('skipped' in result)) {
    assert.equal(result.id, fact.id);
    assert.equal(result.kind, 'fact');
    assert.equal(result.releaseId, 'release-1');
    assert.equal(result.displayName, fact.shortStatement);
    assert.deepEqual(result.notabilityBasis, []);
    assert.equal(result.researchCoverage, 'substantial');
    assert.deepEqual(result.eraBuckets, ['1950s']);
  }
});

test('a draft fact is skipped, not indexed', () => {
  const fact = buildFixtureFact({ status: 'draft' });
  const result = buildFactSearchIndexDoc(fact, 'release-1');
  assert.ok('skipped' in result);
});

test('a published fact with an incomplete citation is skipped, not indexed', () => {
  const fact = buildFixtureFact({ citations: [buildFixtureCitation({ archivedUrl: undefined })] });
  const result = buildFactSearchIndexDoc(fact, 'release-1');
  assert.ok('skipped' in result);
});

test('buildFactSearchIndexDocs partitions good and bad facts without aborting the batch', () => {
  const good = buildFixtureFact();
  const bad = buildFixtureFact({ status: 'draft' });
  const { docs, skipped } = buildFactSearchIndexDocs('release-1', [good, bad]);
  assert.equal(docs.length, 1);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0]!.id, bad.id);
});

test('the produced doc is structurally compatible with the real  ranking pipeline', () => {
  const { docs } = buildFactSearchIndexDocs('release-1', [buildFixtureFact()]);
  const ranked = rankRecords('rosa parks', docs);
  assert.equal(ranked.length, 1);
});

test('confidence grade maps deterministically to researchCoverage', () => {
  const contested = buildFixtureFact({ confidence: 'contested', confidenceNote: 'Disputed.' });
  const result = buildFactSearchIndexDoc(contested, 'release-1');
  assert.ok(!('skipped' in result));
  if (!('skipped' in result)) {
    assert.equal(result.researchCoverage, 'minimal');
  }
});
