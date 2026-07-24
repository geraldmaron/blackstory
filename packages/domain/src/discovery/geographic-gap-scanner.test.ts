/**
 * Tests for the Geographic Gap Scanner: coverage_ratio math, ranking (lowest
 * coverage first), and empty-input behavior. Pure functions — no DB, no network.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPriorityDiscoveryZones,
  computeCoverageGaps,
  rankCoverageGaps,
  DEFAULT_MIN_BLACK_POPULATION,
  GAP_SCANNER_METHODOLOGY_DISCLAIMER,
  GAP_SCANNER_METHODOLOGY_VERSION,
  type CountyCensusDecadeRow,
  type CountyEntityCountRow,
} from './geographic-gap-scanner.js';

const COMPUTED_AT = '2026-07-24T00:00:00.000Z';

const CENSUS_ROWS: readonly CountyCensusDecadeRow[] = [
  {
    fips5: '01085',
    decade: 2020,
    blackPopulation: 7_500,
    countyName: 'Lowndes County',
    stateName: 'Alabama',
  },
  {
    fips5: '17031',
    decade: 2020,
    blackPopulation: 1_200_000,
    countyName: 'Cook County',
    stateName: 'Illinois',
  },
  {
    fips5: '28055',
    decade: 2010,
    blackPopulation: 1_100,
    countyName: 'Issaquena County',
    stateName: 'Mississippi',
  },
];

const ENTITY_COUNTS: readonly CountyEntityCountRow[] = [
  { fips5: '17031', entityCount: 240 },
  { fips5: '01085', entityCount: 3 },
  // 28055 intentionally absent — zero published entities.
];

test('computeCoverageGaps computes entity_count / black_population per county×decade', () => {
  const gaps = computeCoverageGaps({
    censusRows: CENSUS_ROWS,
    entityCounts: ENTITY_COUNTS,
    computedAt: COMPUTED_AT,
  });
  assert.equal(gaps.length, 3);

  const lowndes = gaps.find((gap) => gap.fips5 === '01085');
  assert.ok(lowndes);
  assert.equal(lowndes.coverageRatio, 3 / 7_500);
  assert.equal(lowndes.entitiesPer10k, 4);
  assert.equal(lowndes.decade, 2020);
  assert.equal(lowndes.methodologyVersion, GAP_SCANNER_METHODOLOGY_VERSION);
  assert.equal(lowndes.disclaimerId, GAP_SCANNER_METHODOLOGY_DISCLAIMER.id);
  assert.equal(lowndes.computedAt, COMPUTED_AT);

  const cook = gaps.find((gap) => gap.fips5 === '17031');
  assert.ok(cook);
  assert.equal(cook.coverageRatio, 240 / 1_200_000);
  assert.equal(cook.entitiesPer10k, 2);

  const issaquena = gaps.find((gap) => gap.fips5 === '28055');
  assert.ok(issaquena);
  assert.equal(issaquena.entityCount, 0);
  assert.equal(issaquena.coverageRatio, 0);
});

test('computeCoverageGaps skips zero/negative and below-floor denominators', () => {
  const gaps = computeCoverageGaps({
    censusRows: [
      { fips5: '01001', decade: 2020, blackPopulation: 0 },
      { fips5: '01003', decade: 2020, blackPopulation: -5 },
      { fips5: '01005', decade: 2020, blackPopulation: DEFAULT_MIN_BLACK_POPULATION - 1 },
      { fips5: '01007', decade: 2020, blackPopulation: DEFAULT_MIN_BLACK_POPULATION },
    ],
    entityCounts: [],
    computedAt: COMPUTED_AT,
  });
  assert.deepEqual(
    gaps.map((gap) => gap.fips5),
    ['01007'],
  );
});

test('computeCoverageGaps aggregates duplicate per-county entity count rows', () => {
  const gaps = computeCoverageGaps({
    censusRows: [{ fips5: '01085', decade: 2020, blackPopulation: 1_000 }],
    entityCounts: [
      { fips5: '01085', entityCount: 2 },
      { fips5: '01085', entityCount: 3 },
    ],
    computedAt: COMPUTED_AT,
  });
  assert.equal(gaps[0]?.entityCount, 5);
  assert.equal(gaps[0]?.coverageRatio, 0.005);
});

test('rankCoverageGaps returns lowest coverage first with deterministic tie-breaks', () => {
  const gaps = computeCoverageGaps({
    censusRows: CENSUS_ROWS,
    entityCounts: ENTITY_COUNTS,
    computedAt: COMPUTED_AT,
  });
  const ranked = rankCoverageGaps(gaps, 3);
  assert.deepEqual(
    ranked.map((gap) => gap.fips5),
    ['28055', '17031', '01085'],
  );
  // topN truncates.
  assert.equal(rankCoverageGaps(gaps, 2).length, 2);
  assert.deepEqual(rankCoverageGaps(gaps, 0), []);
  // Tie-break: identical ratio → larger Black population first.
  const tied = rankCoverageGaps(
    computeCoverageGaps({
      censusRows: [
        { fips5: '22001', decade: 2020, blackPopulation: 10_000 },
        { fips5: '22003', decade: 2020, blackPopulation: 40_000 },
      ],
      entityCounts: [
        { fips5: '22001', entityCount: 1 },
        { fips5: '22003', entityCount: 4 },
      ],
      computedAt: COMPUTED_AT,
    }),
    2,
  );
  assert.deepEqual(
    tied.map((gap) => gap.fips5),
    ['22003', '22001'],
  );
});

test('empty inputs yield empty outputs everywhere', () => {
  const gaps = computeCoverageGaps({
    censusRows: [],
    entityCounts: [],
    computedAt: COMPUTED_AT,
  });
  assert.deepEqual(gaps, []);
  assert.deepEqual(rankCoverageGaps([], 10), []);
  assert.deepEqual(buildPriorityDiscoveryZones([]), []);
});

test('buildPriorityDiscoveryZones seeds geographic hints for the directive loop', () => {
  const gaps = computeCoverageGaps({
    censusRows: CENSUS_ROWS,
    entityCounts: ENTITY_COUNTS,
    computedAt: COMPUTED_AT,
  });
  const zones = buildPriorityDiscoveryZones(gaps);
  assert.equal(zones.length, 3);
  // Worst coverage first.
  assert.equal(zones[0]?.fips5, '28055');
  assert.equal(zones[0]?.countyLabel, 'Issaquena County, Mississippi');
  assert.equal(zones[0]?.worstDecade, 2010);

  const regionHint = zones[0]?.geographicHints.find((hint) => hint.kind === 'region');
  assert.ok(regionHint);
  assert.equal(regionHint.text, 'Issaquena County, Mississippi');
  const stateHint = zones[0]?.geographicHints.find((hint) => hint.kind === 'state');
  assert.equal(stateHint?.text, 'Mississippi');

  assert.ok(zones[0]?.searchQueries.some((query) => query.includes('Issaquena County')));
  assert.equal(zones[0]?.disclaimerId, GAP_SCANNER_METHODOLOGY_DISCLAIMER.id);
});
