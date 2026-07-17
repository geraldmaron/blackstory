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

test('mapProjectionToPublicEntityView enriches known seed ids', () => {
  const view = mapProjectionToPublicEntityView({
    id: 'ent_seed_place_001',
    releaseId: 'rel_seed_001',
    kind: 'place',
    displayName: 'Seed Historical Place',
    nameLower: 'seed historical place',
    summary: 'Fixture projection for emulator reads.',
    claimIds: ['claim_seed_001'],
  });
  assert.equal(view.id, 'ent_seed_place_001');
  assert.ok(view.claims.length > 0);
  assert.equal(view.revision.releaseId, 'rel_seed_001');
});
