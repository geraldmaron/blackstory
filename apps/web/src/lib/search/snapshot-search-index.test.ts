/**
 * Confirms the seed-catalog adapter produces a real, gate-passing search index.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { getSnapshotSearchIndex, resetSnapshotSearchIndexCache } from './snapshot-search-index';

test('every seed fixture with a notabilityLabel survives the real AC5 gate and lands in the index', () => {
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const seedIds = listPublicEntities().map((entity) => entity.id);
  assert.deepEqual(index.map((doc) => doc.id).sort(), [...seedIds].sort());
});

test('the index is memoized across calls', () => {
  resetSnapshotSearchIndexCache();
  const first = getSnapshotSearchIndex();
  const second = getSnapshotSearchIndex();
  assert.equal(first, second);
});

test('notabilityBasis resolves the real rubric criterion since seed labels now quote NOTABILITY_RUBRIC verbatim', () => {
  // Unlike the old fictional fixture (which paraphrased NOTABILITY_RUBRIC and always fell back to
  // documented_site), the real Dunbar cluster's notabilityLabels are verbatim NOTABILITY_RUBRIC
  // strings (see public-seed.ts), so the adapter's exact-string reverse-lookup now genuinely
  // resolves each entity's real criterion.
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const byId = new Map(index.map((doc) => [doc.id, doc]));
  assert.equal(
    byId.get('ent_15th_st_church_001')?.notabilityBasis[0]?.criterion,
    'community_anchor',
  );
  assert.equal(byId.get('ent_dunbar_school_001')?.notabilityBasis[0]?.criterion, 'first_to_do_x');
  assert.equal(
    byId.get('ent_dc_landmark_listing_1975')?.notabilityBasis[0]?.criterion,
    'landmark_or_national_register',
  );
  assert.equal(
    byId.get('ent_dunbar_alumni_federation_001')?.notabilityBasis[0]?.criterion,
    'community_anchor',
  );
  for (const doc of index) {
    assert.ok(
      (doc.notabilityBasis[0]?.evidenceIds.length ?? 0) > 0,
      `${doc.id} must attach cited claim ids to inclusion evidence`,
    );
    assert.match(doc.notabilityBasis[0]!.note, /Cited from /);
  }
});

test('relatedCount and claimCount are populated from the seed fixture, never left at a stale default', () => {
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const place = index.find((doc) => doc.id === 'ent_15th_st_church_001');
  assert.ok(place);
  assert.equal(place.relatedCount, 1);
  // The church carries 2 accepted claims: its 1841 founding, and hosting the school's 1870
  // founding in its basement.
  assert.equal(place.claimCount, 2);
});
