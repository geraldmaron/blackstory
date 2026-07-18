/**
 * Unit tests for live/snapshot public-data source selection.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUseLivePublicProjections } from './live-policy';
import { mapProjectionToPublicEntityView } from './map-projection';

test('shouldUseLivePublicProjections is off by default in development', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'development',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
    }),
    false,
  );
});

test('shouldUseLivePublicProjections respects PUBLIC_READ_API_DISABLED', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
      PUBLIC_READ_API_DISABLED: '1',
    }),
    false,
  );
});

test('shouldUseLivePublicProjections enables production project reads', () => {
  assert.equal(
    shouldUseLivePublicProjections({
      NODE_ENV: 'production',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'black-book-efaaf',
      PUBLIC_READ_API_DISABLED: '0',
    }),
    true,
  );
});

test('mapProjectionToPublicEntityView renders claims carried by the projection itself', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_15th_st_church_001',
    releaseId: 'rel_seed_001',
    kind: 'place',
    displayName: 'Fifteenth Street Presbyterian Church',
    nameLower: 'fifteenth street presbyterian church',
    summary: 'Fixture projection for emulator reads.',
    claimIds: ['claim_seed_001'],
    claims: [
      {
        id: 'claim_seed_001',
        predicate: 'founded_in',
        object: '1841',
        confidenceLevel: 'high',
        citationSource: 'nps.gov',
        citationLabel: 'National Park Service',
      },
    ],
  });
  assert.equal(view.id, 'ent_15th_st_church_001');
  assert.equal(view.claims.length, 1);
  assert.equal(view.claims[0]!.object, '1841');
  assert.equal(view.revision.releaseId, 'rel_seed_001');
});

test('mapProjectionToPublicEntityView does not backfill from the bundled seed catalog even when the id matches', () => {
  // `ent_15th_st_church_001` is a real bundled seed id with its own summary/claims. A live
  // projection sharing that id must render only its own (thinner) data — never silently pull
  // in the seed's summary/topicTags/claims (black-book-dnli fixed this seed-enrichment bug).
  const view = mapProjectionToPublicEntityView({
    id: 'ent_15th_st_church_001',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'Fifteenth Street Presbyterian Church',
    nameLower: 'fifteenth street presbyterian church',
    summary: '',
    claimIds: [],
  });
  assert.equal(view.claims.length, 0);
  assert.deepEqual(view.topicTags, []);
});

test('live-only projections get a default notability label for search-pool parity', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_national_example_001',
    releaseId: 'rel_live_001',
    kind: 'place',
    displayName: 'Example National Site',
    nameLower: 'example national site',
    summary: 'A live-only catalog projection without curated notability.',
    claimIds: [],
    jurisdictionLabel: 'Oklahoma',
    locationLabel: 'Tulsa, Oklahoma',
  });
  assert.ok(view.notabilityLabels && view.notabilityLabels.length >= 1);
  assert.match(view.notabilityLabels![0]!, /documented site/i);
});
