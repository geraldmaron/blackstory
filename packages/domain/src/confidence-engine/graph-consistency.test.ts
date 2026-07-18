/**
 * Tests for `computeGraphConsistencySignal` (BB black-book-hx8j): a diagnostic, additive signal
 * that is never folded into `sourceAuthority`/`lineageIndependence` (`../claims/confidence.ts`),
 * and never allows a relationship to corroborate itself.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeGraphConsistencySignal, GRAPH_CONSISTENCY_SIGNAL_VERSION } from './engine.js';

test('computeGraphConsistencySignal is pure and deterministic', () => {
  const input = {
    relationshipId: 'rel-1',
    observations: [
      { relationshipId: 'rel-2', agrees: true },
      { relationshipId: 'rel-3', agrees: false },
    ],
  };
  const first = computeGraphConsistencySignal(input);
  const second = computeGraphConsistencySignal(input);
  assert.deepEqual(first, second);
  assert.equal(first.signalVersion, GRAPH_CONSISTENCY_SIGNAL_VERSION);
});

test('computeGraphConsistencySignal computes agreeing/conflicting ratio', () => {
  const signal = computeGraphConsistencySignal({
    relationshipId: 'rel-1',
    observations: [
      { relationshipId: 'rel-2', agrees: true },
      { relationshipId: 'rel-3', agrees: true },
      { relationshipId: 'rel-4', agrees: false },
    ],
  });
  assert.equal(signal.agreeingCount, 2);
  assert.equal(signal.conflictingCount, 1);
  assert.equal(signal.graphConsistency, 0.6667);
});

test('computeGraphConsistencySignal excludes the edge under evaluation from its own corroboration, even if present in observations', () => {
  const signal = computeGraphConsistencySignal({
    relationshipId: 'rel-1',
    observations: [
      { relationshipId: 'rel-1', agrees: true },
      { relationshipId: 'rel-2', agrees: true },
    ],
  });
  assert.equal(signal.agreeingCount, 1);
  assert.equal(signal.conflictingCount, 0);
  assert.equal(signal.graphConsistency, 1);
});

test('computeGraphConsistencySignal returns 0 with no independent observations (self-only or empty)', () => {
  const selfOnly = computeGraphConsistencySignal({
    relationshipId: 'rel-1',
    observations: [{ relationshipId: 'rel-1', agrees: true }],
  });
  assert.equal(selfOnly.graphConsistency, 0);

  const empty = computeGraphConsistencySignal({ relationshipId: 'rel-1', observations: [] });
  assert.equal(empty.graphConsistency, 0);
});

test('computeGraphConsistencySignal fingerprint is stable for identical inputs and differs when counts differ', () => {
  const a = computeGraphConsistencySignal({
    relationshipId: 'rel-1',
    observations: [{ relationshipId: 'rel-2', agrees: true }],
  });
  const b = computeGraphConsistencySignal({
    relationshipId: 'rel-1',
    observations: [{ relationshipId: 'rel-2', agrees: true }],
  });
  const c = computeGraphConsistencySignal({
    relationshipId: 'rel-1',
    observations: [{ relationshipId: 'rel-2', agrees: false }],
  });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.notEqual(a.fingerprint, c.fingerprint);
});
