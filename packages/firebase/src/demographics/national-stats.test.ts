/**
 * Unit tests for publicSourceUrl and pure population-change helpers — no live Firestore.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateCountiesByState,
  aggregateOpportunityAtlasCoverage,
  buildStateFipsNameMap,
  computeNationalPopulationChangesFromDecades,
  computePopulationDecadeChange,
  computeStatePopulationChange,
  computeStatePopulationChangesFromDecades,
  hateCrimeAntiBlackShare,
  POPULATION_DECADE_COMPARABILITY_NOTE,
  publicSourceUrl,
  resolveStateFipsName,
  US_TERRITORY_FIPS_NAMES,
} from './national-stats.js';

test('publicSourceUrl maps census API URLs to decade dataset landing pages', () => {
  assert.equal(
    publicSourceUrl({
      source: 'us-census-decennial-2020-pl',
      sourceUrl: 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*',
      decade: '2020',
    }),
    'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
  );
});

test('publicSourceUrl maps ACS API URLs to the ACS program page', () => {
  assert.equal(
    publicSourceUrl({
      source: 'us-census-acs5-2024',
      sourceUrl: 'https://api.census.gov/data/2024/acs/acs5?get=NAME&for=county:*',
    }),
    'https://www.census.gov/programs-surveys/acs',
  );
});

test('publicSourceUrl maps CDE signedurl to the FBI hate-crime hub', () => {
  assert.equal(
    publicSourceUrl({
      source: 'fbi-ucr-hate-crime',
      sourceUrl: 'https://cde.ucr.cjis.gov/LATEST/s3/signedurl?key=additional-datasets/hate-crime/hate_crime.zip',
    }),
    'https://ucr.fbi.gov/hate-crime',
  );
});

test('publicSourceUrl maps Opportunity Atlas S3 CSV to opportunityinsights.org/data/', () => {
  assert.equal(
    publicSourceUrl({
      source: 'opportunity-insights-tract-outcomes',
      sourceUrl:
        'https://opportunityinsightsstatic.s3.us-east-1.amazonaws.com/assets/tract_outcomes_early.csv',
    }),
    'https://opportunityinsights.org/data/',
  );
});

test('aggregateCountiesByState sums counties into state rollups', () => {
  const rows = aggregateCountiesByState(
    [
      { stateFips: '06', totalPopulation: 100, blackPopulation: 10 },
      { stateFips: '06', totalPopulation: 200, blackPopulation: 20 },
      { stateFips: '48', totalPopulation: 300, blackPopulation: 30 },
    ],
    '2020',
  );
  assert.deepEqual(rows, [
    {
      stateFips: '06',
      decade: '2020',
      countyCount: 2,
      totalPopulation: 300,
      blackPopulation: 30,
    },
    {
      stateFips: '48',
      decade: '2020',
      countyCount: 1,
      totalPopulation: 300,
      blackPopulation: 30,
    },
  ]);
});

test('computePopulationDecadeChange uses growth math and share percentage points', () => {
  const change = computePopulationDecadeChange({
    fromDecade: '2000',
    toDecade: '2010',
    blackPopulationFrom: 100,
    blackPopulationTo: 125,
    totalPopulationFrom: 1_000,
    totalPopulationTo: 1_250,
    source: 'us-census-decennial-2010-sf1',
    sourceUrl: 'https://www.census.gov/data/datasets/2010/dec/summary-file-1.html',
  });
  assert.equal(change.blackAbsoluteChange, 25);
  assert.equal(change.blackPercentChange, 25);
  assert.equal(change.shareFrom, 10);
  assert.equal(change.shareTo, 10);
  assert.equal(change.shareChangePp, 0);
  assert.equal(change.comparabilityNote, POPULATION_DECADE_COMPARABILITY_NOTE);
});

test('computeNationalPopulationChangesFromDecades builds adjacent decade pairs', () => {
  const changes = computeNationalPopulationChangesFromDecades([
    {
      decade: '2000',
      countyCount: 3_141,
      totalPopulation: 281_000_000,
      blackPopulation: 34_000_000,
      source: 'us-census-decennial-2000-sf1',
      sourceUrl: 'https://www.census.gov/data/datasets/2000/dec/summary-file-1.html',
    },
    {
      decade: '2010',
      countyCount: 3_143,
      totalPopulation: 308_000_000,
      blackPopulation: 38_000_000,
      source: 'us-census-decennial-2010-sf1',
      sourceUrl: 'https://www.census.gov/data/datasets/2010/dec/summary-file-1.html',
    },
    {
      decade: '2020',
      countyCount: 3_143,
      totalPopulation: 331_000_000,
      blackPopulation: 41_000_000,
      source: 'us-census-decennial-2020-pl',
      sourceUrl: 'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
    },
  ]);
  assert.equal(changes.length, 2);
  assert.equal(changes[0]!.fromDecade, '2000');
  assert.equal(changes[0]!.toDecade, '2010');
  assert.equal(changes[1]!.fromDecade, '2010');
  assert.equal(changes[1]!.toDecade, '2020');
});

test('computeStatePopulationChangesFromDecades ranks by absolute Black population change', () => {
  const rows = [
    { stateFips: '06', decade: '2010' as const, countyCount: 58, totalPopulation: 37_000_000, blackPopulation: 2_000_000 },
    { stateFips: '06', decade: '2020' as const, countyCount: 58, totalPopulation: 39_000_000, blackPopulation: 2_200_000 },
    { stateFips: '48', decade: '2010' as const, countyCount: 254, totalPopulation: 25_000_000, blackPopulation: 3_000_000 },
    { stateFips: '48', decade: '2020' as const, countyCount: 254, totalPopulation: 29_000_000, blackPopulation: 3_500_000 },
  ];
  const changes = computeStatePopulationChangesFromDecades(rows, '2010', '2020');
  assert.equal(changes.length, 2);
  assert.equal(changes[0]!.stateFips, '48');
  assert.equal(changes[0]!.blackAbsoluteChange, 500_000);
  assert.equal(changes[1]!.stateFips, '06');
});

test('computeStatePopulationChange preserves endpoint populations', () => {
  const change = computeStatePopulationChange(
    { stateFips: '36', decade: '2010', countyCount: 62, totalPopulation: 19_000_000, blackPopulation: 3_000_000 },
    { stateFips: '36', decade: '2020', countyCount: 62, totalPopulation: 20_000_000, blackPopulation: 3_100_000 },
  );
  assert.equal(change.blackPopulationFrom, 3_000_000);
  assert.equal(change.blackPopulationTo, 3_100_000);
  assert.equal(change.totalPopulationFrom, 19_000_000);
  assert.equal(change.totalPopulationTo, 20_000_000);
});

test('buildStateFipsNameMap labels Puerto Rico and other territory FIPS', () => {
  const map = buildStateFipsNameMap([{ fips: '06', name: 'California' }]);
  assert.equal(map['06'], 'California');
  assert.equal(map['72'], US_TERRITORY_FIPS_NAMES['72']);
  assert.equal(resolveStateFipsName('72', map), 'Puerto Rico');
  assert.equal(resolveStateFipsName('99', map), 'State 99');
});

test('hateCrimeAntiBlackShare returns null when incidents are zero', () => {
  assert.equal(
    hateCrimeAntiBlackShare({ incidents: 0, antiBlackIncidents: 0 }),
    null,
  );
  assert.equal(
    hateCrimeAntiBlackShare({ incidents: 100, antiBlackIncidents: 62 }).toFixed(2),
    '0.62',
  );
});

test('aggregateOpportunityAtlasCoverage counts outcome fields and histogram bins', () => {
  const aggregate = aggregateOpportunityAtlasCoverage([
    { outcomes: { kfrBlackP25: 0.15, kfrWhiteP25: 0.4, jailBlackP25: 0.02 } },
    { outcomes: { kfrBlackP25: 0.55, kfrPooledP25: 0.5 } },
    { outcomes: { kfrBlackP25: 0.95 } },
  ]);
  assert.equal(aggregate.tractCount, 3);
  assert.equal(
    aggregate.outcomeFieldCoverage.find((row) => row.field === 'kfrBlackP25')?.tractCount,
    3,
  );
  assert.equal(
    aggregate.outcomeFieldCoverage.find((row) => row.field === 'kfrWhiteP25')?.tractCount,
    1,
  );
  assert.equal(
    aggregate.kfrBlackP25Histogram.find((bin) => bin.id === '0-20')?.tractCount,
    1,
  );
  assert.equal(
    aggregate.kfrBlackP25Histogram.find((bin) => bin.id === '40-60')?.tractCount,
    1,
  );
  assert.equal(
    aggregate.kfrBlackP25Histogram.find((bin) => bin.id === '80-100')?.tractCount,
    1,
  );
});
