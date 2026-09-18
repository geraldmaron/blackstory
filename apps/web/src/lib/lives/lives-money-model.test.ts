/**
 * Tests for Lives derived-income and affordance resolution from published dollar fixtures.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVES_NATIONAL, buildLivesAreaBundle } from '@repo/domain/statistics/lives';
import { LIVES_NATIONAL_DOLLAR_FIXTURES } from './lives-dollar-fixtures';
import { resolveLivesDecadeMoneyModel } from './lives-money-model';

function decadeBundle(decade: number) {
  const bundle = buildLivesAreaBundle({
    area: LIVES_NATIONAL,
    jurisdictions: [{ id: 'nation:US', name: 'United States' }],
    observations: [],
    coverage: [],
    countNotes: [],
    applicability: [],
    frames: [],
  });
  return bundle.decades.find((entry) => entry.decade === decade)!;
}

test('1930 stores rent and value but refuses affordance without same-year income', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1930),
    emphasis: 'black',
    unit: 'household',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });
  assert.equal(model.derivedIncome, null);
  assert.equal(model.affordance, null);
});

test('1970 Black household gets same-year rent affordance', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1970),
    emphasis: 'black',
    unit: 'household',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });
  assert.ok(model.derivedIncome);
  assert.equal(model.derivedIncome.status, 'derived');
  assert.equal(model.derivedIncome.originalAmount, 6067);
  assert.equal(model.derivedIncome.originalYear, 1969);
  assert.ok(model.derivedIncome.comparisonAmount > model.derivedIncome.originalAmount);
  assert.ok(model.affordance);
  assert.equal(model.affordance.kind, 'rent_to_income');
  assert.equal(model.affordance.status, 'modeled');
  // $71 monthly / ($6067/12) ≈ 0.140
  assert.ok(model.affordance.value > 0.13 && model.affordance.value < 0.15);
});

test('child unit refuses affordance even when income exists', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1970),
    emphasis: 'black',
    unit: 'child',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });
  assert.ok(model.derivedIncome);
  assert.equal(model.affordance, null);
});

test('woman unit refuses affordance even when income exists', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1970),
    emphasis: 'black',
    unit: 'woman',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });
  assert.ok(model.derivedIncome);
  assert.equal(model.affordance, null);
});

test('white lens keeps derived income but refuses affordance without white rent', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1970),
    emphasis: 'white',
    unit: 'household',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });
  assert.ok(model.derivedIncome);
  assert.equal(model.derivedIncome.originalAmount, 9961);
  // HC(1)-A has Total and Negro rent only; do not pair white income with all-race rent.
  assert.equal(model.affordance, null);
});

test('all-race lens affordance uses matching all-race rent', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1970),
    emphasis: 'all',
    unit: 'household',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });
  assert.ok(model.affordance);
  assert.equal(model.affordance.kind, 'rent_to_income');
  // $89 / ($9590/12) ≈ 0.111
  assert.ok(model.affordance.value > 0.1 && model.affordance.value < 0.12);
});

test('1870 has no derived income before CPI begins', () => {
  const model = resolveLivesDecadeMoneyModel({
    decade: decadeBundle(1870),
    emphasis: 'black',
    unit: 'household',
    observations: [
      {
        metricId: 'lives-income-median',
        jurisdictionId: 'nation:US',
        referencePeriod: '1870',
        raceEthnicitySlice: 'black',
        estimate: 100,
        source: 'fixture',
        sourceUrl: 'https://www.census.gov/',
      },
    ],
  });
  assert.equal(model.derivedIncome, null);
});
