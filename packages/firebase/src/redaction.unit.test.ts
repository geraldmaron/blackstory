/**
 * Verifies the public entity projection converter routes writes through the central
 * redaction assertion (@black-book/security) so no prohibited precision or residential
 * address can be persisted to a public projection (BB-015).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicEntityProjectionConverter } from './firestore/index.js';

test('public projection converter accepts a safe, coarse projection', () => {
  const safe = {
    id: 'ent_1',
    releaseId: 'rel_1',
    kind: 'place' as const,
    displayName: 'Public Place',
    nameLower: 'public place',
    location: { lat: 38.91, lng: -77.04, geohash: 'dqcj', precision: 'city' },
    claimIds: [],
  };
  const stored = publicEntityProjectionConverter.toFirestore(safe);
  assert.equal((stored as { id: string }).id, 'ent_1');
});

test('public projection converter rejects prohibited precision', () => {
  const unsafe = {
    id: 'ent_2',
    releaseId: 'rel_1',
    kind: 'person' as const,
    displayName: 'Living Subject',
    nameLower: 'living subject',
    location: { lat: 40.74, lng: -73.99, geohash: 'dr5r', precision: 'street_address' },
    claimIds: [],
  };
  assert.throws(() => publicEntityProjectionConverter.toFirestore(unsafe), /prohibited precision/);
});

test('public projection converter rejects exact coordinates', () => {
  const unsafe = {
    id: 'ent_3',
    releaseId: 'rel_1',
    kind: 'person' as const,
    displayName: 'Living Subject',
    nameLower: 'living subject',
    location: { lat: 40.741895, lng: -73.989308, geohash: 'dr5ru', precision: 'city' },
    claimIds: [],
  };
  assert.throws(() => publicEntityProjectionConverter.toFirestore(unsafe), /exact coordinate/);
});
