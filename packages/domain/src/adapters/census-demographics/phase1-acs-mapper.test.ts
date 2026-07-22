/**
 * Tests for Phase 1 ACS response parsing and observation mapping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PHASE1_ACS5_2024_VINTAGE } from './phase1-acs-variables.js';
import {
  mapPhase1AcsRowToObservations,
  parsePhase1AcsResponse,
} from './phase1-acs-mapper.js';

const VINTAGE = PHASE1_ACS5_2024_VINTAGE;
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

function fakeVariablesJson() {
  const variables: Record<string, { label: string; concept?: string }> = {
    B02001_001E: { label: 'Estimate!!Total:' },
    B02001_003E: { label: 'Estimate!!Total:!!Black or African American alone' },
    B19013B_001E: {
      label: 'Estimate!!Median household income in the past 12 months',
      concept: 'Median Household Income (Black or African American Alone Householder)',
    },
    B19013B_001M: {
      label: 'Margin of Error!!Median household income in the past 12 months',
      concept: 'Median Household Income (Black or African American Alone Householder)',
    },
    B19013A_001E: {
      label: 'Estimate!!Median household income in the past 12 months',
      concept: 'Median Household Income (White Alone Householder)',
    },
    B19013A_001M: {
      label: 'Margin of Error!!Median household income in the past 12 months',
      concept: 'Median Household Income (White Alone Householder)',
    },
    B17001B_001E: { label: 'Estimate!!Total:' },
    B17001B_002E: { label: 'Estimate!!Total:!!Income in the past 12 months below poverty level:' },
    B25003B_001E: { label: 'Estimate!!Total:' },
    B25003B_002E: { label: 'Estimate!!Total:!!Owner occupied' },
    C15002B_001E: { label: 'Estimate!!Total:' },
    C15002B_006E: { label: "Estimate!!Total:!!Male:!!Bachelor's degree or higher" },
    C15002B_011E: { label: "Estimate!!Total:!!Female:!!Bachelor's degree or higher" },
    C23002B_007E: {
      label: 'Estimate!!Total:!!Male:!!16 to 64 years:!!In labor force:!!Civilian:!!Employed',
    },
    C23002B_008E: {
      label: 'Estimate!!Total:!!Male:!!16 to 64 years:!!In labor force:!!Civilian:!!Unemployed',
    },
    C23002B_020E: {
      label: 'Estimate!!Total:!!Female:!!16 to 64 years:!!In labor force:!!Civilian:!!Employed',
    },
    C23002B_021E: {
      label: 'Estimate!!Total:!!Female:!!16 to 64 years:!!In labor force:!!Civilian:!!Unemployed',
    },
  };
  return { variables };
}

const VARIABLE_IDS = VINTAGE.variables.map((spec) => spec.id);

function countyHeader(): readonly string[] {
  return ['NAME', ...VARIABLE_IDS, 'state', 'county'];
}

function stateHeader(): readonly string[] {
  return ['NAME', ...VARIABLE_IDS, 'state'];
}

function countyRow(
  name: string,
  stateFips: string,
  countyFips: string,
  overrides: Record<string, string | null> = {},
): readonly (string | null)[] {
  return [
    name,
    ...VARIABLE_IDS.map((id) => (id in overrides ? overrides[id]! : '1000')),
    stateFips,
    countyFips,
  ];
}

function stateRow(
  name: string,
  stateFips: string,
  overrides: Record<string, string | null> = {},
): readonly (string | null)[] {
  return [name, ...VARIABLE_IDS.map((id) => (id in overrides ? overrides[id]! : '1000')), stateFips];
}

test('parsePhase1AcsResponse maps Montgomery County MD county row', () => {
  const { rows, rejected } = parsePhase1AcsResponse(
    VINTAGE,
    [
      countyHeader(),
      countyRow('Montgomery County, Maryland', '24', '031', {
        B02001_001E: '1060000',
        B02001_003E: '180000',
        B19013B_001E: '108421',
        B19013B_001M: '4120',
        B19013A_001E: '151892',
        B19013A_001M: '2890',
        B17001B_001E: '100000',
        B17001B_002E: '7000',
        B25003B_001E: '400000',
        B25003B_002E: '280000',
        C15002B_001E: '700000',
        C15002B_006E: '120000',
        C15002B_011E: '130000',
      }),
    ],
    'county',
  );
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 1);
  const observations = mapPhase1AcsRowToObservations(rows[0]!, VINTAGE, RETRIEVED_AT);
  const byMetric = new Map(observations.map((row) => [row.metricId, row]));

  assert.equal(byMetric.get('acs-black-population-share-county')!.estimate, 17);
  assert.equal(byMetric.get('acs-black-population-share-county')!.jurisdictionId, 'county:24031');
  assert.equal(byMetric.get('acs-median-hh-income-black-county')!.estimate, 108421);
  assert.equal(byMetric.get('acs-median-hh-income-black-county')!.marginOfError, 4120);
  assert.equal(byMetric.get('acs-median-hh-income-white-county')!.estimate, 151892);
  assert.equal(byMetric.get('acs-poverty-rate-black-county')!.estimate, 7);
  assert.equal(byMetric.get('acs-homeownership-rate-black-county')!.estimate, 70);
  assert.equal(byMetric.get('acs-ba-attainment-black-county')!.estimate, 35.7);
  assert.equal(byMetric.get('acs-black-population-share-county')!.referencePeriod, '2020-2024');
  assert.equal(byMetric.get('acs-black-population-share-county')!.source, 'acs-census-api');
  assert.ok(!byMetric.get('acs-black-population-share-county')!.sourceUrl.includes('api.census.gov'));
});

test('mapPhase1AcsRowToObservations computes Maryland state unemployment', () => {
  const { rows } = parsePhase1AcsResponse(
    VINTAGE,
    [
      stateHeader(),
      stateRow('Maryland', '24', {
        C23002B_007E: '800000',
        C23002B_008E: '40000',
        C23002B_020E: '850000',
        C23002B_021E: '45000',
      }),
    ],
    'state',
  );
  const observations = mapPhase1AcsRowToObservations(rows[0]!, VINTAGE, RETRIEVED_AT);
  assert.equal(observations.length, 1);
  assert.equal(observations[0]!.metricId, 'acs-unemployment-black-state');
  assert.equal(observations[0]!.jurisdictionId, 'state:24');
  assert.equal(observations[0]!.estimate, 4.9);
  assert.equal(observations[0]!.numerator, 85000);
  assert.equal(observations[0]!.denominator, 1735000);
});

test('suppressed median income is omitted from county observations', () => {
  const { rows } = parsePhase1AcsResponse(
    VINTAGE,
    [
      countyHeader(),
      countyRow('Loving County, Texas', '48', '301', {
        B19013B_001E: '-666666666',
      }),
    ],
    'county',
  );
  const observations = mapPhase1AcsRowToObservations(rows[0]!, VINTAGE, RETRIEVED_AT);
  assert.ok(!observations.some((row) => row.metricId === 'acs-median-hh-income-black-county'));
});

test('exported fake variables satisfy Phase 1 dictionary assertion labels', async () => {
  const { assertAcsVariableLabels } = await import('./acs-response-parser.js');
  assert.doesNotThrow(() => assertAcsVariableLabels(VINTAGE, fakeVariablesJson()));
});
