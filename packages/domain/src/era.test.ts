/**
 * Tests for the shared date-precision/era-bucket model.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DATE_PRECISIONS,
  buildInclusiveDecadeRange,
  calendarDecadeStartYear,
  deriveDecadeLabel,
  deriveEraBuckets,
  filterDecadesAtOrBeforeCurrent,
  isDatePrecision,
  isDecadeAtOrBeforeCurrent,
  maxDecadeInclusive,
} from './era.js';

test('DATE_PRECISIONS carries the full day|month|year|decade|circa vocabulary', () => {
  assert.deepEqual(DATE_PRECISIONS, ['day', 'month', 'year', 'decade', 'circa']);
  assert.equal(isDatePrecision('circa'), true);
  assert.equal(isDatePrecision('century'), false);
});

test('deriveDecadeLabel buckets a single year', () => {
  assert.equal(deriveDecadeLabel(1957), '1950s');
  assert.equal(deriveDecadeLabel(1900), '1900s');
});

test('deriveEraBuckets maps a multi-decade span to every overlapping decade', () => {
  assert.deepEqual(
    deriveEraBuckets({ validFrom: '1948', validTo: '1972', datePrecision: 'year' }),
    ['1940s', '1950s', '1960s', '1970s'],
  );
});

test('deriveEraBuckets yields exactly one bucket for a single-point span', () => {
  assert.deepEqual(deriveEraBuckets({ validFrom: '1957', datePrecision: 'year' }), ['1950s']);
  assert.deepEqual(deriveEraBuckets({ validFrom: '1957', validTo: null, datePrecision: 'year' }), [
    '1950s',
  ]);
});

test('deriveEraBuckets resolves day/month precision dates by their year component', () => {
  assert.deepEqual(deriveEraBuckets({ validFrom: '1963-08-28', datePrecision: 'day' }), ['1960s']);
});

test('deriveEraBuckets tolerates a reversed or out-of-order range', () => {
  assert.deepEqual(
    deriveEraBuckets({ validFrom: '1972', validTo: '1948', datePrecision: 'year' }),
    ['1940s', '1950s', '1960s', '1970s'],
  );
});

test('deriveEraBuckets returns an empty array with no resolvable date', () => {
  assert.deepEqual(deriveEraBuckets({ validFrom: '', datePrecision: 'year' }), []);
});

test('calendarDecadeStartYear and maxDecadeInclusive resolve the current decade ceiling', () => {
  assert.equal(calendarDecadeStartYear('2026-07-23'), 2020);
  assert.equal(maxDecadeInclusive('2026-07-23'), '2020s');
  assert.equal(maxDecadeInclusive('2031-01-01'), '2030s');
});

test('filterDecadesAtOrBeforeCurrent drops decades that have not started yet', () => {
  assert.deepEqual(
    filterDecadesAtOrBeforeCurrent(['1990s', '2020s', '2030s', '2040s'], '2026-07-23'),
    ['1990s', '2020s'],
  );
});

test('buildInclusiveDecadeRange fills gaps but never extends past the current decade', () => {
  assert.deepEqual(buildInclusiveDecadeRange('1990s', '2050s', '2026-07-23'), [
    '1990s',
    '2000s',
    '2010s',
    '2020s',
  ]);
  assert.deepEqual(buildInclusiveDecadeRange('2020s', '1990s', '2026-07-23'), [
    '1990s',
    '2000s',
    '2010s',
    '2020s',
  ]);
});

test('isDecadeAtOrBeforeCurrent accepts only started decades', () => {
  assert.equal(isDecadeAtOrBeforeCurrent('2020s', '2026-07-23'), true);
  assert.equal(isDecadeAtOrBeforeCurrent('2030s', '2026-07-23'), false);
});
