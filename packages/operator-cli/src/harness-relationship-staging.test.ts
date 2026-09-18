/**
 * Unit tests for harness adjudication staging rows.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shapeHarnessAdjudicationRows } from './harness-relationship-staging.js';

test('shapeHarnessAdjudicationRows drops none and quarantines all model proposals regardless of self-reported confidence', () => {
  const rows = shapeHarnessAdjudicationRows(
    [
      {
        subjectAId: 'subj_a',
        subjectBId: 'subj_b',
        relationType: 'member_of',
        confidence: 0.8,
        rationale: 'The minute book names the member.',
        evidence: [{ citationUrl: 'https://example.org/minutes', quote: 'A joined B.' }],
      },
      {
        subjectAId: 'subj_c',
        subjectBId: 'subj_d',
        relationType: 'none',
        confidence: 0.1,
        rationale: 'No connection',
        evidence: [],
      },
      {
        subjectAId: 'subj_e',
        subjectBId: 'subj_f',
        relationType: 'associated site',
        confidence: 0.2,
        rationale: 'Weak overlap',
        evidence: [{ citationUrl: 'https://example.org/record', quote: 'E visited F.' }],
      },
    ],
    'run_test',
    'redlining',
    'Chicago',
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.status, 'quarantined');
  assert.equal(rows[1]?.status, 'quarantined');
  assert.equal(rows[0]?.payload.tier, 'llm');
});

test('staging rejects an edge without evidence even when called without the bridge', () => {
  assert.throws(
    () =>
      shapeHarnessAdjudicationRows(
        [
          {
            subjectAId: 'a',
            subjectBId: 'b',
            relationType: 'member_of',
            confidence: 1,
            rationale: 'Unverified',
            evidence: [],
          },
        ],
        'run',
        'theme',
        'scope',
      ),
    /requires edge evidence/,
  );
});

test('punctuation, long endpoint ids, evidence revisions and different runs do not collide', () => {
  const relation = {
    subjectAId: `${'a'.repeat(200)}:b`,
    subjectBId: 'c',
    relationType: 'member_of',
    confidence: 0.5,
    rationale: 'A joined C.',
    evidence: [{ citationUrl: 'https://example.org/minutes', quote: 'A joined C.' }],
  };
  const rows = shapeHarnessAdjudicationRows(
    [relation, { ...relation, subjectAId: `${'a'.repeat(200)}_b` }],
    'run',
    'theme',
    'scope',
  );
  assert.notEqual(rows[0]?.id, rows[1]?.id);
  assert.notEqual(
    rows[0]?.id,
    shapeHarnessAdjudicationRows([relation], 'other-run', 'theme', 'scope')[0]?.id,
  );
});
