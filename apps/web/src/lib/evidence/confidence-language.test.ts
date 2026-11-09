/**
 * Unit tests for confidence/relevance/connection-strength/research-coverage copy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EVIDENCE_DIMENSION_COPY,
  assessmentScoreNote,
  claimGradeLabel,
} from './confidence-language';

test('spells a claim grade in the contract language shared with the map sheet and the app', () => {
  assert.equal(claimGradeLabel('high'), 'Grade A');
  assert.equal(claimGradeLabel('medium', 2), 'Grade B · 2 sources');
  assert.equal(claimGradeLabel('low', 1), 'Grade C · 1 source');
  for (const label of [claimGradeLabel('high'), claimGradeLabel('low', 3)]) {
    assert.doesNotMatch(label, /probability|confidence|\b(high|medium|low)\b/i);
  }
});

test('words a supplied score as an assessment score, never a probability', () => {
  const note = assessmentScoreNote(0.78);
  assert.equal(note, 'Assessment score 0.78 of 1.00');
  assert.doesNotMatch(note ?? '', /probability/i);
  assert.equal(assessmentScoreNote(0), 'Assessment score 0.00 of 1.00');
});

test('prints no score note when no valid measurement is supplied', () => {
  for (const score of [undefined, NaN, Infinity, -1, 2]) {
    assert.equal(assessmentScoreNote(score), undefined);
  }
});

test('EVIDENCE_DIMENSION_COPY gives confidence, relevance, connection strength, and research coverage each a distinct label and description', () => {
  const keys = Object.keys(EVIDENCE_DIMENSION_COPY);
  assert.deepEqual(
    keys.sort(),
    ['confidence', 'connectionStrength', 'relevance', 'researchCoverage'].sort(),
  );
  const labels = new Set(Object.values(EVIDENCE_DIMENSION_COPY).map((entry) => entry.label));
  const descriptions = new Set(
    Object.values(EVIDENCE_DIMENSION_COPY).map((entry) => entry.description),
  );
  assert.equal(labels.size, 4, 'every dimension must have a unique label');
  assert.equal(descriptions.size, 4, 'every dimension must have a unique description');
  // The confidence description explicitly clarifies it is a score, not a probability —
  // the negation itself is the guard; other dimensions must not mention probability at all.
  assert.match(
    EVIDENCE_DIMENSION_COPY.confidence.description,
    /Neither is a calibrated.*probability/i,
  );
  assert.doesNotMatch(EVIDENCE_DIMENSION_COPY.relevance.description, /probability/i);
  assert.doesNotMatch(EVIDENCE_DIMENSION_COPY.connectionStrength.description, /probability/i);
  assert.doesNotMatch(EVIDENCE_DIMENSION_COPY.researchCoverage.description, /probability/i);
});
