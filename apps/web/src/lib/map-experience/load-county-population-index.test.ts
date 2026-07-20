/**
 * Pins the static county population index wire format: compact `total`/`black` counts
 * (not fractions), fips5 string keys, and domain conversion to percent-scale share (0–100).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blackSharePercent,
  bucketBlackShareTier,
} from '@repo/domain/map/county-population';
import {
  parseCountyPopulationIndexFile,
  type CountyPopulationIndexFile,
} from './load-county-population-index';
import { buildCountyChoroplethLevels } from './county-choropleth';

const WIRE_FIXTURE: CountyPopulationIndexFile = {
  vintages: ['2000', '2010', '2020'],
  counties: {
    '17031': {
      '2010': { total: 1000, black: 200 },
      '2020': { total: 1100, black: 275 },
    },
    '01001': {
      '2020': { total: 58805, black: 11496 },
    },
  },
};

test('parseCountyPopulationIndexFile maps wire total/black counts onto domain records', () => {
  const index = parseCountyPopulationIndexFile(WIRE_FIXTURE);
  assert.deepEqual(index.vintages, ['2000', '2010', '2020']);
  assert.deepEqual(index.counties['17031']?.['2020'], {
    totalPopulation: 1100,
    blackPopulation: 275,
  });
  assert.equal(index.counties['01001']?.['2020']?.totalPopulation, 58805);
});

test('wire counts produce 0–100 share percent (not 0–1 fraction) for choropleth buckets', () => {
  const index = parseCountyPopulationIndexFile(WIRE_FIXTURE);
  const record = index.counties['17031']?.['2020'];
  const share = blackSharePercent(record);
  assert.equal(share, 25);
  assert.ok(share !== undefined && share > 1, 'share must be percent-scale, not a 0–1 fraction');
  assert.equal(bucketBlackShareTier(share), 'high');

  const levels = buildCountyChoroplethLevels({
    index,
    mode: 'blackShare',
    decade: '2020',
    fips5List: ['17031'],
  });
  assert.equal(levels[0]?.sharePercent, 25);
  assert.equal(levels[0]?.shareTier, 'high');
});

test('parseCountyPopulationIndexFile drops malformed decade rows without inventing zeros', () => {
  const index = parseCountyPopulationIndexFile({
    vintages: ['2020'],
    counties: {
      '99999': {
        '2020': { total: 100 },
        '2010': { total: -1, black: 10 },
      },
    },
  });
  assert.equal(index.counties['99999'], undefined);
});
