/**
 * Contract tests for learning-index summary bars, primary-image rights, and 2-hop continue-learning.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicRelatedEntry } from '../graph/adjacency.js';
import {
  assertLearningIndexProjection,
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  hasPreferredTopicTags,
  LEARNING_CONTINUE_LEARNING_CAP,
  LEARNING_SUMMARY_MIN_CHARS,
  sanitizePrimaryImageForRelease,
  validateLearningSummary,
  validatePrimaryImageForPublication,
  type NeighborLookup,
} from './index.js';

const LONG_ENOUGH =
  'A historically documented Black community place in the District of Columbia, ' +
  'tied to education and mutual-aid networks with published archival claims.';

test('validateLearningSummary rejects missing and short summaries', () => {
  assert.equal(validateLearningSummary(undefined)[0]?.code, 'summary_missing');
  assert.equal(validateLearningSummary('too short')[0]?.code, 'summary_too_short');
  assert.equal(validateLearningSummary(LONG_ENOUGH).length, 0);
  assert.ok(LONG_ENOUGH.length >= LEARNING_SUMMARY_MIN_CHARS);
});

test('validatePrimaryImageForPublication requires rights alt credit url', () => {
  assert.equal(validatePrimaryImageForPublication(undefined).length, 0);
  const bad = validatePrimaryImageForPublication({
    url: '',
    alt: '',
    credit: '',
    rightsStatus: 'unknown' as 'public_domain',
  });
  assert.ok(bad.some((i) => i.code === 'primary_image_url'));
  assert.ok(bad.some((i) => i.code === 'primary_image_alt'));
  assert.ok(bad.some((i) => i.code === 'primary_image_credit'));

  const ok = validatePrimaryImageForPublication({
    url: 'https://cdn.example/photo.jpg',
    alt: 'Exterior of Seed Freedmen School campus',
    credit: 'Library of Congress (public domain)',
    rightsStatus: 'public_domain',
  });
  assert.equal(ok.length, 0);
});

test('sanitizePrimaryImageForRelease drops uncleared images', () => {
  assert.equal(
    sanitizePrimaryImageForRelease({
      url: 'https://cdn.example/x.jpg',
      alt: 'x',
      credit: 'y',
      rightsStatus: 'restricted' as 'public_domain',
    }),
    undefined,
  );
});

test('assertLearningIndexProjection throws on short summary', () => {
  assert.throws(() => assertLearningIndexProjection({ summary: 'short' }), /rejected/);
  assert.doesNotThrow(() =>
    assertLearningIndexProjection({
      summary: LONG_ENOUGH,
      topicTags: ['education'],
    }),
  );
});

test('hasPreferredTopicTags soft-preference', () => {
  assert.equal(hasPreferredTopicTags([]), false);
  assert.equal(hasPreferredTopicTags(['education']), true);
});

test('buildRelatedNeighborStubs denormalizes and caps', () => {
  const related: PublicRelatedEntry[] = [
    { id: 'b', type: 'located_at', direction: 'outgoing' },
    { id: 'c', type: 'related_to', direction: 'incoming' },
    { id: 'missing', type: 'related_to', direction: 'outgoing' },
  ];
  const map = new Map<string, NeighborLookup>([
    ['b', { id: 'b', displayName: 'B', kind: 'school', summary: 'School summary text here for learning.' }],
    ['c', { id: 'c', displayName: 'C', kind: 'event', summary: 'Event summary text here for learning.' }],
  ]);
  const stubs = buildRelatedNeighborStubs(related, map, { displayCap: 1 });
  assert.equal(stubs.length, 1);
  assert.equal(stubs[0]?.id, 'b');
  assert.equal(stubs[0]?.relationType, 'located_at');
});

test('composeContinueLearningStubs excludes self and 1-hop; caps', () => {
  const oneHop = buildRelatedNeighborStubs(
    [{ id: 'school', type: 'located_at', direction: 'outgoing' }],
    new Map([
      [
        'school',
        {
          id: 'school',
          displayName: 'School',
          kind: 'school',
          summary: 'School summary long enough for learning index display.',
          related: [
            { id: 'place', type: 'located_at', direction: 'incoming' },
            { id: 'event', type: 'occurred_at', direction: 'incoming' },
            { id: 'institution', type: 'commemorates', direction: 'incoming' },
          ],
        },
      ],
    ]),
  );

  const neighbors = new Map<string, NeighborLookup>([
    [
      'school',
      {
        id: 'school',
        displayName: 'School',
        kind: 'school',
        summary: 'School summary long enough for learning index display.',
        related: [
          { id: 'place', type: 'located_at', direction: 'incoming' },
          { id: 'event', type: 'occurred_at', direction: 'incoming' },
          { id: 'institution', type: 'commemorates', direction: 'incoming' },
        ],
      },
    ],
    [
      'place',
      {
        id: 'place',
        displayName: 'Place',
        kind: 'place',
        summary: 'Place summary long enough for learning index display.',
        related: [{ id: 'school', type: 'located_at', direction: 'outgoing' }],
      },
    ],
    [
      'event',
      {
        id: 'event',
        displayName: 'Event',
        kind: 'event',
        summary: 'Event summary long enough for learning index display.',
      },
    ],
    [
      'institution',
      {
        id: 'institution',
        displayName: 'Institution',
        kind: 'institution',
        summary: '',
      },
    ],
  ]);

  const twoHop = composeContinueLearningStubs('place', oneHop, neighbors, { cap: 2 });
  assert.ok(twoHop.every((s) => s.id !== 'place' && s.id !== 'school'));
  assert.ok(twoHop.length <= 2);
  assert.ok(twoHop.length <= LEARNING_CONTINUE_LEARNING_CAP);
  // Prefer non-empty summaries: event before empty institution when both fit
  assert.equal(twoHop[0]?.id, 'event');
});
