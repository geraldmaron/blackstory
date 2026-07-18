/**
 * Verifies the public entity projection converter routes writes through the central
 * redaction assertion (@blap/security) and learning-index gates so no prohibited
 * precision, residential address, short summary, or uncleared primaryImage can persist.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicEntityProjectionConverter } from './firestore/index.js';

const LEARNING_SUMMARY =
  'A historically documented public place in the Black Book learning index, with published ' +
  'claims and provenance suitable for educators and researchers.';

test('public projection converter accepts a safe, coarse projection', () => {
  const safe = {
    id: 'ent_1',
    releaseId: 'rel_1',
    kind: 'place' as const,
    displayName: 'Public Place',
    nameLower: 'public place',
    summary: LEARNING_SUMMARY,
    location: { lat: 38.91, lng: -77.04, geohash: 'dqcj', precision: 'city' },
    claimIds: [],
    topicTags: ['community'],
  };
  const stored = publicEntityProjectionConverter.toFirestore(safe);
  assert.equal((stored as { id: string }).id, 'ent_1');
  assert.equal((stored as { summary: string }).summary, LEARNING_SUMMARY);
});

test('public projection converter rejects summaries below the learning-index minimum', () => {
  const shortSummary = {
    id: 'ent_short',
    releaseId: 'rel_1',
    kind: 'place' as const,
    displayName: 'Public Place',
    nameLower: 'public place',
    summary: 'too short',
    claimIds: [],
  };
  assert.throws(
    () => publicEntityProjectionConverter.toFirestore(shortSummary),
    /Learning-index projection rejected|at least 120/,
  );
});

test('public projection converter drops incomplete primaryImage instead of persisting it', () => {
  const withBadImage = {
    id: 'ent_img',
    releaseId: 'rel_1',
    kind: 'school' as const,
    displayName: 'School',
    nameLower: 'school',
    summary: LEARNING_SUMMARY,
    claimIds: [],
    topicTags: ['education'],
    primaryImage: {
      url: 'https://cdn.example/photo.jpg',
      alt: '   ',
      credit: 'Archive',
      rightsStatus: 'public_domain' as const,
    },
  };
  const stored = publicEntityProjectionConverter.toFirestore(withBadImage);
  assert.equal(Object.hasOwn(stored, 'primaryImage'), false);
});

test('public projection converter rejects prohibited precision', () => {
  const unsafe = {
    id: 'ent_2',
    releaseId: 'rel_1',
    kind: 'person' as const,
    displayName: 'Living Subject',
    nameLower: 'living subject',
    summary: LEARNING_SUMMARY,
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
    summary: LEARNING_SUMMARY,
    location: { lat: 40.741895, lng: -73.989308, geohash: 'dr5ru', precision: 'city' },
    claimIds: [],
  };
  assert.throws(() => publicEntityProjectionConverter.toFirestore(unsafe), /exact coordinate/);
});
