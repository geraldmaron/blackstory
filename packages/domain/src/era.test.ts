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
  isDesignationClaim,
  isDesignationOnlyYear,
  maxDecadeInclusive,
  resolveEraBucketsFromEvidence,
  resolveEraEvidence,
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

/*
 * Era evidence. The NRHP case these guard: the NPS weekly-list feed publishes a listing date
 * and no period of significance, so a site's only structured date is the year its paperwork
 * cleared. Reading that as the site's era labelled a lowcountry cemetery "2000s".
 */

const NRHP_CLAIMS = [
  {
    predicate: 'listing',
    object: 'on the National Register of Historic Places on April 12, 2001, reference #01000382',
  },
  { predicate: 'significant for', object: 'architecture, Black heritage, and social history' },
];

test('isDesignationClaim spots listings by predicate and by prose', () => {
  assert.equal(isDesignationClaim(NRHP_CLAIMS[0]!), true);
  assert.equal(isDesignationClaim(NRHP_CLAIMS[1]!), false);
  assert.equal(
    isDesignationClaim({ predicate: 'recognition', object: 'named a National Historic Landmark' }),
    true,
  );
});

test('isDesignationOnlyYear needs the year attested, and attested only by designations', () => {
  assert.equal(isDesignationOnlyYear('2001', NRHP_CLAIMS), true);
  // A year no claim mentions is not designation-only — absence must not suppress authored dates.
  assert.equal(isDesignationOnlyYear('1907', NRHP_CLAIMS), false);
  // One historical claim carrying the year is enough to redeem it.
  assert.equal(
    isDesignationOnlyYear('1901', [
      ...NRHP_CLAIMS,
      { predicate: 'founded', object: 'the congregation built the sanctuary in 1901' },
    ]),
    false,
  );
});

test('resolveEraBucketsFromEvidence drops a status span dated only by its listing', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      statusHistory: [{ validFrom: '2001', datePrecision: 'year' }],
      claims: NRHP_CLAIMS,
    }),
    [],
  );
});

test('resolveEraBucketsFromEvidence keeps a historical year that is not the listing year', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      statusHistory: [{ validFrom: '1928', datePrecision: 'year' }],
      claims: [
        {
          predicate: 'listing',
          object: 'on the National Register of Historic Places on September 12, 2002',
        },
      ],
    }),
    ['1920s'],
  );
});

test('resolveEraBucketsFromEvidence prefers authored buckets over any span', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      eraBuckets: ['1890s'],
      statusHistory: [{ validFrom: '2001', datePrecision: 'year' }],
      claims: NRHP_CLAIMS,
    }),
    ['1890s'],
  );
});

test('resolveEraBucketsFromEvidence spans an event window across decades', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      eventWindow: { validFrom: '1955-12-05', validTo: '1956-12-20', datePrecision: 'day' },
    }),
    ['1950s'],
  );
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      eventWindow: { validFrom: '1948', validTo: '1972', datePrecision: 'year' },
    }),
    ['1940s', '1950s', '1960s', '1970s'],
  );
});

test('resolveEraBucketsFromEvidence ignores undated spans and future decades', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      statusHistory: [{ validFrom: 'undated', datePrecision: 'circa' }],
    }),
    [],
  );
  assert.deepEqual(resolveEraBucketsFromEvidence({ eraBuckets: ['2050s'] }), []);
});

test('resolveEraBucketsFromEvidence reads decades named by historical claims', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      claims: [
        { predicate: 'first_black_graduate', object: 'earned his law degree in 1962' },
        { predicate: 'elected_position', object: 'president of the bar association in 1988' },
      ],
    }),
    // Not 1970s: the record attests two decades, not the span between them.
    ['1960s', '1980s'],
  );
});

test('claim years never rescue a record whose only year is its listing', () => {
  assert.deepEqual(resolveEraBucketsFromEvidence({ claims: NRHP_CLAIMS }), []);
});

test('structured spans outrank claim years', () => {
  assert.deepEqual(
    resolveEraBucketsFromEvidence({
      statusHistory: [{ validFrom: '1912', datePrecision: 'year' }],
      claims: [{ predicate: 'note', object: 'a 1975 restoration' }],
    }),
    ['1910s'],
  );
});

test('resolveEraEvidence separates a research gap from a genuinely undated record', () => {
  // A suppressed listing date proves an era exists and simply has not been ingested.
  assert.deepEqual(
    resolveEraEvidence({
      statusHistory: [{ validFrom: '2001', datePrecision: 'year' }],
      claims: NRHP_CLAIMS,
    }),
    { buckets: [], state: 'awaiting_research' },
  );
  assert.deepEqual(resolveEraEvidence({}), { buckets: [], state: 'undocumented' });
  assert.deepEqual(resolveEraEvidence({ eraBuckets: ['1930s'] }), {
    buckets: ['1930s'],
    state: 'documented',
  });
});

test('an authored bucket that is entirely in the future is not treated as documented', () => {
  assert.deepEqual(resolveEraEvidence({ eraBuckets: ['2050s'] }), {
    buckets: [],
    state: 'undocumented',
  });
});
