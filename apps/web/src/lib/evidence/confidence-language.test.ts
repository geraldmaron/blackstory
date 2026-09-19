/**
 * Unit tests for confidence/relevance/connection-strength/research-coverage copy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVIDENCE_DIMENSION_COPY, formatEvidenceScoreLabel } from './confidence-language';

test('formats an uncalibrated confidence label as an evidence score, never a probability', () => {
  const label = formatEvidenceScoreLabel(0.78, 'high');
  assert.match(label, /^Evidence score: high \(0\.78 of 1\.00\)$/);
  assert.doesNotMatch(label, /probability/i);
});

test('shows a qualitative grade when no valid measurement is supplied', () => {
  for (const score of [undefined, NaN, Infinity, -1, 2]) {
    assert.equal(formatEvidenceScoreLabel(score, 'low'), 'Evidence grade: low');
  }
  assert.equal(formatEvidenceScoreLabel(0, 'low'), 'Evidence score: low (0.00 of 1.00)');
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
