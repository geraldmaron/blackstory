/**
 * Unit tests for dispute/contradiction presentation (disagreement is visible rather than
 * silently resolved).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDisputeView, buildDisputeViewFromContradictionSet } from './contradiction-view';

test('a non-disputed claim with no alternates reports hasDispute false', () => {
  const view = buildDisputeView({ primaryValue: '1868' });
  assert.equal(view.hasDispute, false);
  assert.equal(view.alternates.length, 0);
});

test('a seed-depth disputed claim preserves its dispute note', () => {
  const view = buildDisputeView({
    primaryValue: '1867',
    disputed: true,
    disputeNote:
      'A credible alternate founding year (1868) is preserved; both values remain visible.',
  });
  assert.equal(view.hasDispute, true);
  assert.equal(view.primaryValue, '1867');
  assert.match(view.note ?? '', /1868/);
});

test('explicit alternate values are preserved even when the disputed flag is absent', () => {
  const view = buildDisputeView({
    primaryValue: '1867',
    alternates: [{ value: '1868', credible: true, kind: 'contradicting' }],
  });
  assert.equal(view.hasDispute, true);
  assert.equal(view.alternates.length, 1);
  assert.equal(view.alternates[0]?.value, '1868');
});

test('a full ContradictionSet preserves every non-primary value, never collapsing to one answer', () => {
  const view = buildDisputeViewFromContradictionSet({
    claimId: 'claim_seed_001',
    primaryValue: '1867',
    hasCredibleContradiction: true,
    values: [
      { value: '1867', evidenceLinkIds: ['ev_1'], credible: true, kind: 'primary' },
      { value: '1868', evidenceLinkIds: ['ev_2'], credible: true, kind: 'contradicting' },
      { value: '1869', evidenceLinkIds: ['ev_3'], credible: false, kind: 'alternative' },
    ],
  });
  assert.equal(view.hasDispute, true);
  assert.equal(view.primaryValue, '1867');
  assert.equal(view.alternates.length, 2);
  assert.deepEqual(
    view.alternates.map((a) => a.value),
    ['1868', '1869'],
  );
  assert.equal(view.alternates.find((a) => a.value === '1868')?.kind, 'contradicting');
  assert.equal(view.alternates.find((a) => a.value === '1869')?.kind, 'alternative');
});

test('a ContradictionSet with only a primary value reports no dispute', () => {
  const view = buildDisputeViewFromContradictionSet({
    claimId: 'claim_seed_002',
    primaryValue: '1954',
    hasCredibleContradiction: false,
    values: [{ value: '1954', evidenceLinkIds: ['ev_1'], credible: true, kind: 'primary' }],
  });
  assert.equal(view.hasDispute, false);
  assert.equal(view.alternates.length, 0);
});
