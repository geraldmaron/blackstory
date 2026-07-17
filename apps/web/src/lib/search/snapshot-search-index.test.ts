/**
 * Confirms the seed-catalog adapter produces a real, gate-passing search index (BB-049).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { getSnapshotSearchIndex, resetSnapshotSearchIndexCache } from './snapshot-search-index';

test('every seed fixture with a notabilityLabel survives the real AC5 gate and lands in the index', () => {
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const seedIds = listPublicEntities().map((entity) => entity.id);
  assert.deepEqual(
    index.map((doc) => doc.id).sort(),
    [...seedIds].sort(),
  );
});

test('the index is memoized across calls', () => {
  resetSnapshotSearchIndexCache();
  const first = getSnapshotSearchIndex();
  const second = getSnapshotSearchIndex();
  assert.equal(first, second);
});

test('synthesized notabilityBasis falls back to documented_site for hand-authored seed prose that paraphrases (not quotes) the rubric', () => {
  // The seed catalog's labels are paraphrases of NOTABILITY_RUBRIC text, not verbatim quotes, so
  // the exact-string reverse-lookup in the adapter is expected to miss and fall back — this test
  // documents that behavior rather than asserting a criterion the seed data can't actually prove.
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  for (const doc of index) {
    assert.equal(doc.notabilityBasis[0]?.criterion, 'documented_site');
    assert.equal(doc.notabilityBasis[0]?.evidenceIds.length, 0);
  }
});

test('relatedCount and claimCount are populated from the seed fixture, never left at a stale default', () => {
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const place = index.find((doc) => doc.id === 'ent_seed_place_001');
  assert.ok(place);
  assert.equal(place.relatedCount, 1);
  assert.equal(place.claimCount, 1);
});
