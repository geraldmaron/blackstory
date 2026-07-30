/**
 * Unit tests for harness adjudication staging rows.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shapeHarnessAdjudicationRows } from './harness-relationship-staging.js';

test('shapeHarnessAdjudicationRows drops none and quarantines low-confidence relations', () => {
  const rows = shapeHarnessAdjudicationRows(
    [
      {
        subjectAId: 'subj_a',
        subjectBId: 'subj_b',
        relationType: 'member_of',
        confidence: 0.8,
        rationale: 'Shared institutional timeline',
      },
      {
        subjectAId: 'subj_c',
        subjectBId: 'subj_d',
        relationType: 'none',
        confidence: 0.1,
        rationale: 'No connection',
      },
      {
        subjectAId: 'subj_e',
        subjectBId: 'subj_f',
        relationType: 'associated site',
        confidence: 0.2,
        rationale: 'Weak overlap',
      },
    ],
    'run_test',
    'redlining',
    'Chicago',
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.status, 'pending');
  assert.equal(rows[1]?.status, 'quarantined');
  assert.equal(rows[0]?.payload.tier, 'llm');
});
