/**
 * Tests for the BB-054 / BB-090 public notabilityBasis renderer (BB-054 acceptance criterion 5).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOTABILITY_RUBRIC } from '../entity-status.js';
import {
  assertPublicNotabilityBasisNeverScored,
  buildPublicNotabilityBasis,
} from './why-public-basis.js';

test('buildPublicNotabilityBasis renders an empty array for undefined or empty input', () => {
  assert.deepEqual(buildPublicNotabilityBasis(undefined), []);
  assert.deepEqual(buildPublicNotabilityBasis([]), []);
});

test('buildPublicNotabilityBasis renders the approved label, full rubric, note, and evidenceIds', () => {
  const items = buildPublicNotabilityBasis([
    {
      criterion: 'documented_site',
      note: 'Primary-source evidence ties this site to a documented sit-in.',
      evidenceIds: ['ev-1', 'ev-2'],
    },
  ]);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item?.criterion, 'documented_site');
  assert.equal(item?.criterionLabel, 'Documented site');
  assert.equal(item?.rubric, NOTABILITY_RUBRIC.documented_site);
  assert.equal(item?.note, 'Primary-source evidence ties this site to a documented sit-in.');
  assert.deepEqual(item?.evidenceIds, ['ev-1', 'ev-2']);
});

test('assertPublicNotabilityBasisNeverScored does not throw for a well-formed rendering', () => {
  const items = buildPublicNotabilityBasis([
    { criterion: 'court_precedent', note: 'Set binding precedent.', evidenceIds: ['ev-1'] },
  ]);
  assert.doesNotThrow(() => assertPublicNotabilityBasisNeverScored(items));
});

test('assertPublicNotabilityBasisNeverScored throws if a score-shaped field is smuggled in', () => {
  const tainted = [
    {
      criterion: 'court_precedent',
      criterionLabel: 'Court precedent',
      rubric: NOTABILITY_RUBRIC.court_precedent,
      note: 'Set binding precedent.',
      evidenceIds: ['ev-1'],
      notabilityScore: 0.9,
    },
  ] as unknown as Parameters<typeof assertPublicNotabilityBasisNeverScored>[0];
  assert.throws(() => assertPublicNotabilityBasisNeverScored(tainted), /never expose "score"/);
});
