import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dwellingTenureFromOwnershp,
  householdOccupationalStratum,
  occ1950MajorGroup,
  occupationalStratum,
} from './strata.js';

test('major-group ranges follow the 1950 classification', () => {
  assert.equal(occ1950MajorGroup(0), 'professional');
  assert.equal(occ1950MajorGroup(99), 'professional');
  assert.equal(occ1950MajorGroup(100), 'farmer');
  assert.equal(occ1950MajorGroup(123), 'farm_manager');
  assert.equal(occ1950MajorGroup(290), 'manager_official_proprietor');
  assert.equal(occ1950MajorGroup(390), 'clerical');
  assert.equal(occ1950MajorGroup(490), 'sales');
  assert.equal(occ1950MajorGroup(594), 'craft');
  assert.equal(occ1950MajorGroup(595), 'armed_forces');
  assert.equal(occ1950MajorGroup(690), 'operative');
  assert.equal(occ1950MajorGroup(720), 'private_household');
  assert.equal(occ1950MajorGroup(790), 'service');
  assert.equal(occ1950MajorGroup(840), 'farm_laborer');
  assert.equal(occ1950MajorGroup(970), 'laborer');
  assert.equal(occ1950MajorGroup(980), 'non_occupational');
  assert.equal(occ1950MajorGroup(999), 'non_occupational');
});

test('tenant farmers are lower, farm owners middle, unknown tenure unclassified', () => {
  assert.equal(occupationalStratum(100, 'rented').stratum, 'lower');
  assert.equal(occupationalStratum(100, 'owned').stratum, 'middle');
  assert.equal(occupationalStratum(100, 'unknown').stratum, 'unclassified');
});

test('non-farm groups map to the bound strata regardless of tenure', () => {
  assert.equal(occupationalStratum(10, 'rented').stratum, 'upper');
  assert.equal(occupationalStratum(250, 'unknown').stratum, 'upper');
  assert.equal(occupationalStratum(650, 'owned').stratum, 'middle');
  assert.equal(occupationalStratum(123, 'unknown').stratum, 'middle');
  assert.equal(occupationalStratum(710, 'owned').stratum, 'lower');
  assert.equal(occupationalStratum(820, 'unknown').stratum, 'lower');
  assert.equal(occupationalStratum(595, 'owned').stratum, 'unclassified');
  assert.equal(occupationalStratum(984, 'owned').stratum, 'unclassified');
});

test('OWNERSHP codes map to dwelling tenure', () => {
  assert.equal(dwellingTenureFromOwnershp(1), 'owned');
  assert.equal(dwellingTenureFromOwnershp(2), 'rented');
  assert.equal(dwellingTenureFromOwnershp(0), 'unknown');
  assert.equal(dwellingTenureFromOwnershp(null), 'unknown');
});

test('household uses the head, then the first adult with an occupation', () => {
  const widowHeadedFarm = [
    { pernum: 1, age: 58, occ1950: 980 },
    { pernum: 2, age: 15, occ1950: 820 },
    { pernum: 3, age: 24, occ1950: 100 },
  ];
  const assignment = householdOccupationalStratum(widowHeadedFarm, 'rented');
  assert.equal(assignment.stratum, 'lower');
  assert.match(assignment.reason, /first adult/);

  const professionalHead = [
    { pernum: 2, age: 40, occ1950: 710 },
    { pernum: 1, age: 45, occ1950: 30 },
  ];
  assert.equal(householdOccupationalStratum(professionalHead, 'owned').stratum, 'upper');

  const noOccupation = [{ pernum: 1, age: 70, occ1950: 984 }];
  assert.equal(householdOccupationalStratum(noOccupation, 'owned').stratum, 'unclassified');
});
