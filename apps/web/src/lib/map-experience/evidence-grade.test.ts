import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  applyEvidenceFloor,
  EVIDENCE_FLOORS,
  floorLabel,
  gradeDescription,
  gradeForConfidence,
  gradeLabel,
  meetsEvidenceFloor,
} from './evidence-grade';
import type { ConfidenceTier } from './build-explore-map-source';

const TIERS: readonly ConfidenceTier[] = ['high', 'medium', 'low', 'unrated'];

test('every stored confidence tier maps to a letter, except unrated', () => {
  assert.equal(gradeForConfidence('high'), 'A');
  assert.equal(gradeForConfidence('medium'), 'B');
  assert.equal(gradeForConfidence('low'), 'C');
  assert.equal(gradeForConfidence('unrated'), null);
});

test('an unknown tier is treated as ungraded rather than throwing', () => {
  assert.equal(gradeForConfidence('provisional'), null);
  assert.equal(gradeLabel(gradeForConfidence('provisional')), '·');
  assert.equal(gradeDescription(null), 'Evidence not graded');
});

test('the any floor admits every tier, including ungraded', () => {
  for (const tier of TIERS) {
    assert.equal(meetsEvidenceFloor(tier, 'any'), true, tier);
  }
});

test('a letter floor is and-up, and never admits an ungraded record', () => {
  assert.equal(meetsEvidenceFloor('high', 'A'), true);
  assert.equal(meetsEvidenceFloor('medium', 'A'), false);
  assert.equal(meetsEvidenceFloor('high', 'B'), true);
  assert.equal(meetsEvidenceFloor('medium', 'B'), true);
  assert.equal(meetsEvidenceFloor('low', 'B'), false);
  assert.equal(meetsEvidenceFloor('low', 'C'), true);
  for (const floor of ['A', 'B', 'C'] as const) {
    assert.equal(meetsEvidenceFloor('unrated', floor), false, floor);
  }
});

test('floor labels read as the chips do, with no em dash', () => {
  assert.deepEqual(EVIDENCE_FLOORS.map(floorLabel), ['Any', 'C and up', 'B and up', 'A only']);
  for (const floor of EVIDENCE_FLOORS) {
    assert.equal(floorLabel(floor).includes('—'), false);
  }
});

test('applyEvidenceFloor keeps the stronger grades and drops the weaker ones', () => {
  const features = TIERS.map((tier) => ({ properties: { confidenceTier: tier } }));

  assert.equal(applyEvidenceFloor(features, 'any').length, 4);
  assert.deepEqual(
    applyEvidenceFloor(features, 'B').map((feature) => feature.properties.confidenceTier),
    ['high', 'medium'],
  );
  assert.deepEqual(
    applyEvidenceFloor(features, 'A').map((feature) => feature.properties.confidenceTier),
    ['high'],
  );
});

test('the any floor returns the same array identity, so it cannot cost a re-render', () => {
  const features = [{ properties: { confidenceTier: 'high' as ConfidenceTier } }];
  assert.equal(applyEvidenceFloor(features, 'any'), features);
});
