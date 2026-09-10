import assert from 'node:assert/strict';
import test from 'node:test';
import { INVENTION_COHORT, type InventionCohortRecord } from '../data/invention-cohort.ts';
import {
  distinctEvidenceHosts,
  validateInventionCohort,
  validateInventionRow,
} from './invention-cohort-validate.ts';

/** A row that passes every check, so each test can break exactly one thing. */
function validRow(overrides: Partial<InventionCohortRecord> = {}): InventionCohortRecord {
  return {
    id: 'inv_example_device',
    displayName: 'Example Device',
    summary: 'A'.repeat(500),
    historicalContext: 'Why the scope of this grant matters.',
    impactStatement: 'What followed from the grant.',
    contributors: [{ name: 'A. Example', predicate: 'invented' }],
    city: 'Cleveland',
    state: 'OH',
    lat: 41.4993,
    lng: -81.6944,
    era: '1920s',
    canonicalUrl: 'https://patents.google.com/patent/US1475024A',
    patentNumber: '1475024',
    evidence: [
      {
        sourceUrl: 'https://patents.google.com/patent/US1475024A',
        title: 'US 1,475,024',
        quote: 'Traffic signal',
      },
    ],
    ...overrides,
  };
}

test('the shipped cohort has no mechanical defects', () => {
  assert.deepEqual(validateInventionCohort(INVENTION_COHORT), []);
});

test('a summary outside the publishable band is reported with its length', () => {
  const problems = validateInventionRow(validRow({ summary: 'too short' }));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /summary length 9 outside 400\.\.900/u);
});

test('co_invented on a row naming one person is reported, because a co-inventor was erased', () => {
  const problems = validateInventionRow(
    validRow({ contributors: [{ name: 'A. Example', predicate: 'co_invented' }] }),
  );
  assert.deepEqual(problems, [
    'inv_example_device: contributor A. Example is co_invented but no one else is named',
  ]);
});

test('co_invented is accepted once the other inventor is on the receipt', () => {
  const problems = validateInventionRow(
    validRow({
      contributors: [
        { name: 'A. Example', predicate: 'co_invented' },
        { name: 'B. Example', predicate: 'co_invented' },
      ],
    }),
  );
  assert.deepEqual(problems, []);
});

test('a patent number that does not appear in the URL it cites is reported', () => {
  const problems = validateInventionRow(validRow({ patentNumber: '9999999' }));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /does not appear in canonicalUrl/u);
});

test('a comma-formatted patent number is rejected, since the grant number has no commas', () => {
  const problems = validateInventionRow(validRow({ patentNumber: '1,475,024' }));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /must be digits/u);
});

test('an X-patent keeps its series letter', () => {
  assert.deepEqual(
    validateInventionRow(
      validRow({
        patentNumber: 'X3306',
        canonicalUrl: 'https://patents.google.com/patent/USX3306',
      }),
    ),
    [],
  );
});

test('a grantDate that agrees with the summary and falls inside the era is accepted', () => {
  const problems = validateInventionRow(
    validRow({
      summary:
        'US 1,475,024, titled "Traffic signal," names Garrett A. Morgan and was granted on 20 November 1923. '.repeat(
          4,
        ),
      era: '1920s',
      grantDate: '1923-11-20',
    }),
  );
  assert.deepEqual(problems, []);
});

test('a grantDate that does not read like YYYY-MM-DD is reported', () => {
  const problems = validateInventionRow(validRow({ grantDate: '11/20/1923' }));
  assert.deepEqual(problems, [
    'inv_example_device: grantDate 11/20/1923 must read like YYYY-MM-DD',
  ]);
});

test('a grantDate naming a calendar date that does not exist is reported', () => {
  const problems = validateInventionRow(validRow({ grantDate: '1923-02-30' }));
  assert.deepEqual(problems, [
    'inv_example_device: grantDate 1923-02-30 is not a real calendar date',
  ]);
});

test('a grantDate whose year falls outside the record era decade is reported', () => {
  const problems = validateInventionRow(validRow({ era: '1920s', grantDate: '1931-01-01' }));
  assert.deepEqual(problems, ['inv_example_device: grantDate 1931-01-01 falls outside era 1920s']);
});

test('a grantDate that disagrees with the summary\'s "granted on" date is reported', () => {
  const problems = validateInventionRow(
    validRow({
      summary:
        'US 1,475,024, titled "Traffic signal," names Garrett A. Morgan and was granted on 20 November 1923. '.repeat(
          4,
        ),
      era: '1920s',
      grantDate: '1923-11-21',
    }),
  );
  assert.deepEqual(problems, [
    'inv_example_device: grantDate 1923-11-21 disagrees with the summary\'s "granted on" date 1923-11-20',
  ]);
});

test('a summary with no "granted on" phrase has nothing to cross-check a grantDate against', () => {
  const problems = validateInventionRow(
    validRow({
      summary: 'A'.repeat(500),
      era: '1920s',
      grantDate: '1923-11-20',
    }),
  );
  assert.deepEqual(problems, []);
});

test('an empty evidence quote is reported, because an uncheckable citation is not evidence', () => {
  const problems = validateInventionRow(
    validRow({
      evidence: [{ sourceUrl: 'https://example.org/a', title: 'A source', quote: '  ' }],
    }),
  );
  assert.deepEqual(problems, ['inv_example_device: evidence A source has an empty quote']);
});

test('British spelling in reader-facing prose is reported with the American form to use', () => {
  const problems = validateInventionRow(
    validRow({ impactStatement: 'The process was commercialised.' }),
  );
  assert.deepEqual(problems, [
    'inv_example_device: impactStatement uses British spelling "commercialised"; write "commercialized"',
  ]);
});

test('a duplicate id is reported, because the staging upsert would silently overwrite', () => {
  const problems = validateInventionCohort([validRow(), validRow()]);
  assert.deepEqual(problems, ['inv_example_device: appears 2 times; ids must be unique']);
});

test('distinctEvidenceHosts counts one publisher for two patents on the same mirror', () => {
  const hosts = distinctEvidenceHosts(
    validRow({
      evidence: [
        { sourceUrl: 'https://patents.google.com/patent/US1475024A', title: 'a', quote: 'q' },
        { sourceUrl: 'https://www.patents.google.com/patent/US1090936A', title: 'b', quote: 'q' },
        { sourceUrl: 'https://www.nps.gov/people/example.htm', title: 'c', quote: 'q' },
      ],
    }),
  );
  assert.deepEqual(hosts, ['nps.gov', 'patents.google.com']);
});
