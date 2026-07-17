/**
 * Tests for Layer 4 presence/affirmation counterweight layer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computePresenceAffirmationLayerSignal,
  PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS,
} from './presence-affirmation.js';

const PLACE = 'place_presence_1';
const CITATION = {
  claimId: 'claim_presence_1',
  sourceLabel: 'Green Book',
  retrievedAt: '2026-01-01T00:00:00.000Z',
};

test('returns undefined with no presence records — absence is not a zero claim', () => {
  assert.equal(
    computePresenceAffirmationLayerSignal({
      placeEntityId: PLACE,
      records: [],
      asOf: '2026-01-01T00:00:00.000Z',
    }),
    undefined,
  );
});

test('HBCU category carries the highest published weight', () => {
  const weights = Object.values(PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS);
  assert.equal(PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS.hbcu, Math.max(...weights));
});

test('computePresenceAffirmationLayerSignal aggregates multiple markers with saturating density', () => {
  const signal = computePresenceAffirmationLayerSignal({
    placeEntityId: PLACE,
    asOf: '2026-01-01T00:00:00.000Z',
    records: [
      {
        id: 'p1',
        placeEntityId: PLACE,
        category: 'green_book_site',
        proximityWeight: 1,
        citation: CITATION,
      },
      {
        id: 'p2',
        placeEntityId: PLACE,
        category: 'historic_black_church',
        proximityWeight: 1,
        citation: { ...CITATION, claimId: 'claim_presence_2' },
      },
    ],
  });
  assert.equal(signal?.layerId, 'presence_affirmation');
  assert.ok((signal?.value ?? 0) > PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS.green_book_site);
  assert.ok((signal?.value ?? 0) <= 1);
});
