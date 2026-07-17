/**
 * Tests for kind-specific entity status vocabularies, time-scoped status history, the
 * notability-basis rubric, and the sensitivity schema.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CULTURAL_FIGURE_NOTABILITY_CALIBRATION,
  LAW_STATUSES,
  MOVEMENT_STATUSES,
  NOTABILITY_CRITERIA,
  NOTABILITY_RUBRIC,
  PLACE_LIKE_STATUSES,
  SENSITIVITY_CLASSES,
  currentStatus,
  hasRequiredNotabilityBasis,
  personStatusFromLiving,
  statusAsOf,
  type StatusHistoryEntry,
} from './entity-status.js';

test('kind-specific status vocabularies match the BB-090 spec exactly', () => {
  assert.deepEqual(PLACE_LIKE_STATUSES, ['active', 'historic', 'inactive']);
  assert.deepEqual(LAW_STATUSES, ['in_force', 'amended', 'repealed', 'struck_down', 'enjoined']);
  // Movements conclude, they don't pause no "inactive".
  assert.deepEqual(MOVEMENT_STATUSES, ['active', 'historic']);
});

test('currentStatus derives from the open-ended record only, never a hand-edited scalar', () => {
  const history: readonly StatusHistoryEntry[] = [
    { status: 'active', validFrom: '1868', validTo: '1954', datePrecision: 'year', basisClaimIds: ['c1'] },
    { status: 'historic', validFrom: '1954', validTo: null, datePrecision: 'year', basisClaimIds: ['c2'] },
  ];
  assert.equal(currentStatus(history), 'historic');
  assert.equal(currentStatus([]), undefined);
  assert.equal(currentStatus(undefined), undefined);
});

test('currentStatus prefers the latest-starting open-ended record when more than one exists', () => {
  const history: readonly StatusHistoryEntry[] = [
    { status: 'historic', validFrom: '1960', datePrecision: 'year', basisClaimIds: [] },
    { status: 'active', validFrom: '1990', datePrecision: 'year', basisClaimIds: [] },
  ];
  assert.equal(currentStatus(history), 'active');
});

test('statusAsOf answers "what was this entity\'s status in decade D" point-in-time queries', () => {
  const history: readonly StatusHistoryEntry[] = [
    { status: 'active', validFrom: '1868', validTo: '1954', datePrecision: 'year', basisClaimIds: ['c1'] },
    { status: 'historic', validFrom: '1954', validTo: null, datePrecision: 'year', basisClaimIds: ['c2'] },
  ];

  // Decade-anchored point-in-time reads: 1930s -> still "active"; 1980s -> "historic".
  assert.equal(statusAsOf(history, '1930'), 'active');
  assert.equal(statusAsOf(history, '1980'), 'historic');
  // Exactly on the boundary belongs to the record that starts there.
  assert.equal(statusAsOf(history, '1954'), 'historic');
  // Before any recorded designation.
  assert.equal(statusAsOf(history, '1800'), undefined);
});

test('personStatusFromLiving derives status from livingStatus, unknown treated as living', () => {
  assert.equal(personStatusFromLiving('living'), 'living');
  assert.equal(personStatusFromLiving('deceased'), 'deceased');
  assert.equal(personStatusFromLiving('unknown'), 'living');
  assert.equal(personStatusFromLiving(undefined), 'living');
});

test('hasRequiredNotabilityBasis requires at least one record', () => {
  assert.equal(hasRequiredNotabilityBasis(undefined), false);
  assert.equal(hasRequiredNotabilityBasis([]), false);
  assert.equal(
    hasRequiredNotabilityBasis([{ criterion: 'first_to_do_x', note: 'n', evidenceIds: ['e1'] }]),
    true,
  );
});

test('NOTABILITY_RUBRIC documents reviewable rubric text for every criterion', () => {
  assert.equal(NOTABILITY_CRITERIA.length, 8);
  for (const criterion of NOTABILITY_CRITERIA) {
    assert.equal(typeof NOTABILITY_RUBRIC[criterion], 'string');
    assert.ok(NOTABILITY_RUBRIC[criterion].length > 20, `${criterion} rubric text is too thin`);
    // Rubric text is prose, never a numeric formula.
    assert.doesNotMatch(NOTABILITY_RUBRIC[criterion], /\bscore\b/i);
  }
});

test('cultural-figure calibration ships as icons-and-firsts-only', () => {
  assert.equal(CULTURAL_FIGURE_NOTABILITY_CALIBRATION, 'icons_and_firsts_only');
});

test('sensitivity classes match the BB-090 spec exactly', () => {
  assert.deepEqual(SENSITIVITY_CLASSES, [
    'contested_legacy',
    'perpetrator_associated',
    'violence_associated',
    'enslaver_or_segregationist',
  ]);
});
