/**
 * Unit tests for decade-over-decade population change strip helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  nationalChangeStripItems,
  rankStateMovers,
  type PopulationChangeLike,
  type StateChangeLike,
} from './population-change';

const SAMPLE_CHANGES: readonly PopulationChangeLike[] = [
  {
    fromDecade: '2000',
    toDecade: '2010',
    blackAbsoluteChange: 4_271_069,
    blackPercentChange: 12.3,
    shareChangePp: 0.1,
    source: 'U.S. Census Bureau, Summary File 1',
    sourceUrl: 'https://www.census.gov/data/datasets/2010/dec/summary-file-1.html',
  },
  {
    fromDecade: '2010',
    toDecade: '2020',
    blackAbsoluteChange: 2_175_348,
    blackPercentChange: 5.6,
    shareChangePp: -0.2,
    source: 'U.S. Census Bureau, Decennial Census P.L. 94-171',
    sourceUrl: 'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
  },
];

test('nationalChangeStripItems formats signed Δ Black and share note', () => {
  const items = nationalChangeStripItems(SAMPLE_CHANGES);
  assert.equal(items.length, 2);
  assert.match(items[0]!.value, /^\+/);
  assert.match(items[0]!.label, /2000→2010/);
  assert.match(items[0]!.note, /pp/);
  assert.match(items[1]!.note, /−/);
});

test('rankStateMovers separates gains and losses by absolute Black change', () => {
  const rows: readonly StateChangeLike[] = [
    {
      stateFips: '06',
      blackAbsoluteChange: 100_000,
      shareChangePp: 0.2,
      blackPopulationTo: 2_000_000,
    },
    {
      stateFips: '36',
      blackAbsoluteChange: 50_000,
      shareChangePp: 0.1,
      blackPopulationTo: 3_000_000,
    },
    {
      stateFips: '26',
      blackAbsoluteChange: -80_000,
      shareChangePp: -0.5,
      blackPopulationTo: 1_200_000,
    },
    { stateFips: '17', blackAbsoluteChange: 0, shareChangePp: 0, blackPopulationTo: 1_800_000 },
  ];
  const { gains, losses } = rankStateMovers(rows, 8);
  assert.equal(gains[0]!.stateFips, '06');
  assert.equal(gains[1]!.stateFips, '36');
  assert.equal(losses[0]!.stateFips, '26');
  assert.equal(gains.length, 2);
  assert.equal(losses.length, 1);
});
