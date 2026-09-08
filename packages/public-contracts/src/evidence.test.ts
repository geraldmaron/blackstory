/**
 * The evidence language both platforms print from. The two rules under test are the ones the
 * product keeps re-breaking: unrated is not a fourth grade, and a floor is a claim about assessed
 * strength that an unassessed record cannot satisfy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyEvidenceFloor,
  evidenceLabel,
  evidenceMeterLabel,
  floorLabel,
  gradeDescription,
  gradeForConfidence,
  gradeLabel,
  meetsEvidenceFloor,
  meterLevelForCoverage,
  meterLevelForTier,
} from './evidence.js';

test('a tier maps to one letter, and unrated to none', () => {
  assert.equal(gradeForConfidence('high'), 'A');
  assert.equal(gradeForConfidence('medium'), 'B');
  assert.equal(gradeForConfidence('low'), 'C');
  assert.equal(gradeForConfidence('unrated'), null);
  assert.equal(gradeForConfidence('nonsense'), null);
});

test('unrated fills no segment and prints a placeholder, never a D', () => {
  assert.equal(meterLevelForTier('unrated'), 0);
  assert.equal(gradeLabel(gradeForConfidence('unrated')), '·');
  assert.equal(gradeDescription(null), 'Evidence not graded');
});

test('the visible label carries the grade and, when known, the count', () => {
  assert.equal(evidenceLabel('high', 2), 'Grade A · 2 sources');
  assert.equal(evidenceLabel('low', 1), 'Grade C · 1 source');
  assert.equal(evidenceLabel('unrated', 0), 'Not graded · 0 sources');
  assert.equal(evidenceLabel('medium'), 'Grade B');
});

test('the spoken label says nothing about a count the surface does not have', () => {
  assert.equal(evidenceMeterLabel('high', 4), 'Evidence grade A, 4 sources');
  assert.equal(evidenceMeterLabel('high'), 'Evidence grade A');
  assert.equal(evidenceMeterLabel('high', -1), 'Evidence grade A');
});

test('coverage is a three-step scale of its own', () => {
  assert.equal(meterLevelForCoverage('substantial'), 3);
  assert.equal(meterLevelForCoverage('partial'), 2);
  assert.equal(meterLevelForCoverage('minimal'), 1);
});

test('a letter floor excludes ungraded records; any admits them', () => {
  assert.equal(meetsEvidenceFloor('unrated', 'any'), true);
  assert.equal(meetsEvidenceFloor('unrated', 'C'), false);
  assert.equal(meetsEvidenceFloor('high', 'B'), true);
  assert.equal(meetsEvidenceFloor('low', 'B'), false);
  assert.equal(floorLabel('any'), 'Any');
  assert.equal(floorLabel('A'), 'A only');
  assert.equal(floorLabel('B'), 'B and up');
});

test('the floor predicate keeps stronger grades rather than matching exactly', () => {
  const features = [
    { properties: { confidenceTier: 'high' as const } },
    { properties: { confidenceTier: 'medium' as const } },
    { properties: { confidenceTier: 'unrated' as const } },
  ];
  assert.deepEqual(applyEvidenceFloor(features, 'B'), [features[0], features[1]]);
  assert.equal(applyEvidenceFloor(features, 'any').length, 3);
});
