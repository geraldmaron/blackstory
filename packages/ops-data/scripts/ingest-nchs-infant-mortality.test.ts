import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseDatasetRows,
  parseFixtureCsv,
  raceBasis,
  toFixtureCsv,
} from './ingest-nchs-infant-mortality.ts';

test('the dataset’s trailing-space race label is trimmed, and an unknown label is rejected', () => {
  const { parsed, rejected } = parseDatasetRows([
    { year: '2013', race: 'Black ', infant_mortality_rate: '10.81' },
    { year: '2013', race: 'White', infant_mortality_rate: '5.07' },
    { year: '2013', race: 'All races', infant_mortality_rate: '5.96' },
    { year: '1914', race: 'Black', infant_mortality_rate: '200' },
    { year: '1950', race: 'Black', infant_mortality_rate: '' },
  ]);
  assert.deepEqual(parsed, [
    { year: 2013, race: 'Black', rate: 10.81 },
    { year: 2013, race: 'White', rate: 5.07 },
  ]);
  assert.equal(rejected.length, 3);
});

test('the fixture round-trips without touching a value', () => {
  const rows = [
    { year: 1915, race: 'Black' as const, rate: 195.2 },
    { year: 1915, race: 'White' as const, rate: 98.6 },
  ];
  assert.deepEqual(parseFixtureCsv(toFixtureCsv(rows)), rows);
});

test('the race basis changes at 1980, as NCHS states', () => {
  assert.equal(raceBasis(1979), 'race of child');
  assert.equal(raceBasis(1980), 'race of mother');
});
