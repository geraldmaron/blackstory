import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_CONDITIONS,
  incomeBracketSeriesId,
  livesConditionLabel,
  livesConditionPublishedIn,
  livesDecadeForReferencePeriod,
  parseIncomeBracketSeriesId,
  workClassSeriesId,
} from './lives-metrics.js';

test('income bracket series ids round-trip, including the open top bracket', () => {
  assert.equal(incomeBracketSeriesId(10_000, 15_000), 'lives-income-bracket-10000-15000');
  assert.deepEqual(parseIncomeBracketSeriesId('lives-income-bracket-10000-15000'), {
    lower: 10_000,
    upper: 15_000,
  });
  assert.deepEqual(parseIncomeBracketSeriesId(incomeBracketSeriesId(200_000, null)), {
    lower: 200_000,
    upper: null,
  });
  assert.equal(parseIncomeBracketSeriesId('lives-income-bracket-5-1'), null);
  assert.equal(parseIncomeBracketSeriesId('lives-population'), null);
  assert.equal(workClassSeriesId('lower'), 'lives-class-work-lower');
});

test('conditions are published only in the decades the census tabulated them by race', () => {
  const literacy = LIVES_CONDITIONS.find((c) => c.key === 'literacy')!;
  assert.equal(livesConditionPublishedIn(literacy, 1930), true);
  assert.equal(livesConditionPublishedIn(literacy, 1940), false);
  const income = LIVES_CONDITIONS.find((c) => c.key === 'income_to_national_median')!;
  assert.equal(income.seriesId, null);
  assert.equal(livesConditionPublishedIn(income, 1930), false);
});

test('the income label follows the decade’s income unit', () => {
  assert.match(livesConditionLabel('income_to_national_median', 'wage_income'), /wages/);
  assert.match(livesConditionLabel('income_to_national_median', 'family_income'), /family/);
  assert.match(
    livesConditionLabel('income_to_national_median', 'acs_household_income'),
    /household/,
  );
});

test('reference periods map to decades', () => {
  assert.equal(livesDecadeForReferencePeriod('1960'), 1960);
  assert.equal(livesDecadeForReferencePeriod('1965'), null);
  assert.equal(livesDecadeForReferencePeriod('2019-2023'), 2020);
  assert.equal(livesDecadeForReferencePeriod('2008-2012'), 2010);
  assert.equal(livesDecadeForReferencePeriod('2018-2022'), null);
});
