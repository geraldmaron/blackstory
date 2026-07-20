import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACT_CONFIDENCE_GRADES,
  FACT_CONFIDENCE_DEFINITIONS,
  assertFactConfidenceValid,
  assertStatusConfidenceAxesIndependent,
  confidenceGradeRequiresNote,
  isFactConfidenceGrade,
} from './confidence.js';

test('every confidence grade has a published methodology definition', () => {
  for (const grade of FACT_CONFIDENCE_GRADES) {
    assert.ok(FACT_CONFIDENCE_DEFINITIONS[grade].length > 0);
  }
});

test('isFactConfidenceGrade recognizes the closed vocabulary', () => {
  assert.equal(isFactConfidenceGrade('established'), true);
  assert.equal(isFactConfidenceGrade('probable'), false);
});

test('single-source and contested require a confidenceNote; established/corroborated do not', () => {
  assert.equal(confidenceGradeRequiresNote('single-source'), true);
  assert.equal(confidenceGradeRequiresNote('contested'), true);
  assert.equal(confidenceGradeRequiresNote('established'), false);
  assert.equal(confidenceGradeRequiresNote('corroborated'), false);
});

test('assertFactConfidenceValid fails closed when a note is required but missing', () => {
  assert.throws(() => assertFactConfidenceValid({ confidence: 'contested' }));
  assert.throws(() =>
    assertFactConfidenceValid({ confidence: 'contested', confidenceNote: '   ' }),
  );
  assert.doesNotThrow(() =>
    assertFactConfidenceValid({
      confidence: 'contested',
      confidenceNote: 'Two credible sources disagree.',
    }),
  );
  assert.doesNotThrow(() => assertFactConfidenceValid({ confidence: 'established' }));
});

test('assertFactConfidenceValid rejects an unknown grade', () => {
  assert.throws(() => assertFactConfidenceValid({ confidence: 'maybe' }));
});

test('status and confidence axes never derive from one another', () => {
  assert.doesNotThrow(() =>
    assertStatusConfidenceAxesIndependent({ status: 'published', confidence: 'contested' }),
  );
  assert.doesNotThrow(() =>
    assertStatusConfidenceAxesIndependent({ status: 'draft', confidence: 'established' }),
  );
  assert.throws(() =>
    assertStatusConfidenceAxesIndependent({ status: 'published', confidence: 'unknown-grade' }),
  );
});
