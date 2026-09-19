import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_DECADES,
  crossesLivesRegimeBoundary,
  livesAcsVintage,
  livesHispanicCounting,
  livesIncomeReferenceYear,
  livesRegimeForDecade,
  livesRegimesShareIncomeFooting,
} from './lives-regimes.js';

test('timeline runs 1870s through 2020s, 1890 included', () => {
  assert.equal(LIVES_DECADES.length, 16);
  assert.equal(livesRegimeForDecade(1890), 'work_based');
});

test('each decade maps to the published-table regime the method binds', () => {
  assert.equal(livesRegimeForDecade(1870), 'work_based');
  assert.equal(livesRegimeForDecade(1930), 'work_based');
  assert.equal(livesRegimeForDecade(1940), 'wage_income');
  assert.equal(livesRegimeForDecade(1950), 'family_income');
  assert.equal(livesRegimeForDecade(1980), 'family_income');
  assert.equal(livesRegimeForDecade(1990), 'household_income');
  assert.equal(livesRegimeForDecade(2000), 'household_income');
  assert.equal(livesRegimeForDecade(2010), 'acs_household_income');
  assert.equal(livesRegimeForDecade(2020), 'acs_household_income');
});

test('boundaries separate different measures from same-unit method changes', () => {
  assert.equal(crossesLivesRegimeBoundary(1930, 1940), true);
  assert.equal(crossesLivesRegimeBoundary(1970, 1980), false);
  assert.equal(crossesLivesRegimeBoundary(1980, 1990), true);
  assert.equal(livesRegimesShareIncomeFooting('household_income', 'acs_household_income'), true);
  assert.equal(livesRegimesShareIncomeFooting('family_income', 'household_income'), false);
});

test('income years and ACS vintages', () => {
  assert.equal(livesIncomeReferenceYear(1920), null);
  assert.equal(livesIncomeReferenceYear(1940), 1939);
  assert.equal(livesIncomeReferenceYear(2020), 2023);
  assert.equal(livesAcsVintage(2010), '2008-2012');
  assert.equal(livesAcsVintage(2000), null);
});

test('Hispanic visibility follows what each census asked', () => {
  assert.equal(livesHispanicCounting(1920), 'not_counted');
  assert.equal(livesHispanicCounting(1930), 'mexican_race');
  assert.equal(livesHispanicCounting(1940), 'not_counted');
  assert.equal(livesHispanicCounting(1960), 'proxies');
  assert.equal(livesHispanicCounting(1970), 'sample_question');
  assert.equal(livesHispanicCounting(1980), 'counted');
});
