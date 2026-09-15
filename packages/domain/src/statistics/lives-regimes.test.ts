import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_DECADES,
  crossesLivesRegimeBoundary,
  livesHispanicOriginImputed,
  livesIncomeReferenceYear,
  livesRegimeForDecade,
  livesRegimesShareIncomeFooting,
} from './lives-regimes.js';

test('timeline runs 1870s through 2020s in ten-year steps', () => {
  assert.equal(LIVES_DECADES[0], 1870);
  assert.equal(LIVES_DECADES.at(-1), 2020);
  assert.equal(LIVES_DECADES.length, 16);
});

test('each decade maps to the regime the method binds', () => {
  assert.equal(livesRegimeForDecade(1870), 'occupational_strata');
  assert.equal(livesRegimeForDecade(1890), 'no_microdata');
  assert.equal(livesRegimeForDecade(1930), 'occupational_strata');
  assert.equal(livesRegimeForDecade(1940), 'earnings');
  assert.equal(livesRegimeForDecade(1950), 'sample_line_income');
  assert.equal(livesRegimeForDecade(1960), 'constructed_household_income');
  assert.equal(livesRegimeForDecade(1970), 'constructed_household_income');
  assert.equal(livesRegimeForDecade(1980), 'household_income');
  assert.equal(livesRegimeForDecade(2000), 'household_income');
  assert.equal(livesRegimeForDecade(2010), 'acs_household_income');
  assert.equal(livesRegimeForDecade(2020), 'acs_household_income');
});

test('the 1890 gap is a boundary on both sides', () => {
  assert.equal(crossesLivesRegimeBoundary(1880, 1890), true);
  assert.equal(crossesLivesRegimeBoundary(1890, 1900), true);
  assert.equal(crossesLivesRegimeBoundary(1880, 1900), false);
});

test('work-based class and income tiers never compare', () => {
  assert.equal(crossesLivesRegimeBoundary(1930, 1940), true);
  assert.equal(crossesLivesRegimeBoundary(1940, 1950), true);
  assert.equal(crossesLivesRegimeBoundary(1950, 1960), true);
});

test('only household-income regimes share an income footing', () => {
  assert.equal(livesRegimesShareIncomeFooting('household_income', 'acs_household_income'), true);
  assert.equal(
    livesRegimesShareIncomeFooting('constructed_household_income', 'household_income'),
    true,
  );
  assert.equal(livesRegimesShareIncomeFooting('earnings', 'household_income'), false);
  assert.equal(livesRegimesShareIncomeFooting('occupational_strata', 'occupational_strata'), false);
});

test('Hispanic origin is flagged as imputed before 1970', () => {
  assert.equal(livesHispanicOriginImputed(1960), true);
  assert.equal(livesHispanicOriginImputed(1970), false);
});

test('income refers to the year before a census, and to the final ACS year', () => {
  assert.equal(livesIncomeReferenceYear(1930), null);
  assert.equal(livesIncomeReferenceYear(1890), null);
  assert.equal(livesIncomeReferenceYear(1940), 1939);
  assert.equal(livesIncomeReferenceYear(2000), 1999);
  assert.equal(livesIncomeReferenceYear(2020), 2023);
});
