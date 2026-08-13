import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decadeBucketsForPeriod,
  extractPeriodOfSignificance,
} from './nrhp-period-of-significance.ts';

test('reads the transcribed form field, which is the registered answer', () => {
  const period = extractPeriodOfSignificance(
    'Period of Significance 1929-1950 Significant Dates 1929 Significant Person N/A',
  );
  assert.equal(period?.method, 'field');
  assert.equal(period?.startYear, 1929);
  assert.equal(period?.endYear, 1950);
});

test('reads the Section 8 justification prose when the field did not transcribe', () => {
  const period = extractPeriodOfSignificance(
    'Period of Significance (justification) The period of significance is the years 1910-1955 ' +
      "because they delineate Alonzo's residence.",
  );
  assert.equal(period?.method, 'justification');
  assert.equal(period?.startYear, 1910);
  assert.equal(period?.endYear, 1955);
});

test('an open-ended justification yields the single year it states', () => {
  const period = extractPeriodOfSignificance(
    'The period of significance begins in 1906 with the recording of the first plat.',
  );
  assert.equal(period?.method, 'justification');
  assert.equal(period?.startYear, 1906);
  assert.equal(period?.endYear, 1906);
});

/**
 * Construction is off by default because it is not an era. Across the 345 captured nominations
 * stating both, the construction year sits inside the stated period only 38.3% of the time — it
 * predates it in 41.7% of cases, by a median of 30 years.
 */
test('a construction date does NOT become an era by default', () => {
  const text =
    'Goodwin Memorial AME Zion Church is a Craftsman-style building constructed in 1910.';
  assert.equal(extractPeriodOfSignificance(text), undefined);
});

test('construction is available only when a caller opts in explicitly', () => {
  const text =
    'Goodwin Memorial AME Zion Church is a Craftsman-style building constructed in 1910.';
  const period = extractPeriodOfSignificance(text, { allowConstructionFallback: true });
  assert.equal(period?.method, 'construction');
  assert.equal(period?.startYear, 1910);
});

test('circa construction dates are read at year precision when opted in', () => {
  const opt = { allowConstructionFallback: true } as const;
  assert.equal(extractPeriodOfSignificance('The hall was built c. 1888.', opt)?.startYear, 1888);
  assert.equal(extractPeriodOfSignificance('erected circa 1902 by freedmen', opt)?.startYear, 1902);
});

/** nrhp-black-heritage-00000731: built 1873, significant 1964. The period must govern. */
test('a stated period wins over a construction date even when both appear', () => {
  const period = extractPeriodOfSignificance(
    'The church was built in 1873. Period of Significance 1964-1964',
    { allowConstructionFallback: true },
  );
  assert.equal(period?.method, 'field');
  assert.equal(period?.startYear, 1964);
});

/**
 * The whole reason this module exists. A listing date is a fact about paperwork, and reading it
 * as era is what put 19th-century churches in the 2000s.
 */
test('the listing date is never read as a period', () => {
  const text =
    'St. Paul AME Zion Church is a building in Johnson City, Tennessee listed on the National ' +
    'Register of Historic Places on April 12, 2001 for its significance in architecture.';
  assert.equal(extractPeriodOfSignificance(text), undefined);
});

test('a calendar-dated year inside the period window is discarded, not read', () => {
  const period = extractPeriodOfSignificance('Period of Significance January 15, 2001');
  assert.equal(period, undefined, 'a full calendar date is a listing date, not a period');
});

test('a nomination stating no period returns undefined rather than guessing', () => {
  assert.equal(
    extractPeriodOfSignificance('Area of Significance: ethnic heritage, Black.'),
    undefined,
  );
  assert.equal(extractPeriodOfSignificance(''), undefined);
  assert.equal(extractPeriodOfSignificance('   '), undefined);
});

test('implausible spans are rejected rather than published', () => {
  // Two unrelated years swept up by one window must not become a 400-year era.
  assert.equal(extractPeriodOfSignificance('Period of Significance 1600-2020')?.endYear, undefined);
  // A reversed range is OCR damage, not a period.
  const reversed = extractPeriodOfSignificance('Period of Significance 1950-1929');
  assert.notEqual(reversed?.endYear, 1929);
});

test('a year beyond the reference date is not accepted', () => {
  assert.equal(
    extractPeriodOfSignificance('Period of Significance 2028-2030', { maxYear: 2026 }),
    undefined,
  );
});

test('decade buckets cover every decade the period touches', () => {
  assert.deepEqual(
    decadeBucketsForPeriod({ startYear: 1929, endYear: 1950, method: 'field', evidence: '' }),
    ['1920s', '1930s', '1940s', '1950s'],
  );
  assert.deepEqual(
    decadeBucketsForPeriod({ startYear: 1906, endYear: 1906, method: 'field', evidence: '' }),
    ['1900s'],
  );
});
