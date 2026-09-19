import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLawEntityRow,
  checkCitedYears,
  countNarrativeParagraphs,
  documentKeyForUrl,
  predictedClaimId,
  validateLawEntity,
  type AuthoredLawEntity,
} from './law-entities.js';

const options = { runId: 'test_run' };

function authored(overrides: Partial<AuthoredLawEntity> = {}): AuthoredLawEntity {
  return {
    id: 'ent_law_example_act_1935',
    packetItem: 1,
    kind: 'law',
    displayName: 'Example Act of 1935',
    scope: { level: 'federal', jurisdictionId: 'nation:US', jurisdictionName: 'United States' },
    place: { state: 'DC', lat: 38.8977, lng: -77.0365, precision: 'city' },
    summary: 'x'.repeat(500),
    historicalContext: 'First paragraph of narrative prose.\n\nSecond paragraph of narrative prose.',
    impactStatement: 'What this rule did to Black Americans.',
    canonicalSource: { url: 'https://www.govinfo.gov/one.pdf', title: 'Statute page images, 1935' },
    evidence: [
      {
        sourceUrl: 'https://uscode.house.gov/two',
        title: 'Codifier note, exclusions ended 1951',
        quote: 'The exclusions ended January 1, 1951.',
        verbatim: true,
      },
    ],
    applicability: {
      id: 'lives-us-example-act-1935',
      jurisdictionId: 'nation:US',
      scopeLevel: 'federal',
      inForceFromEdtf: '1935-08-14',
      inForceToEdtf: '1951-01-01',
      lifeDomains: ['income_support', 'work'],
      textPosture: 'facially_neutral',
      appliesToSlices: ['all'],
      disputed: false,
    },
    ...overrides,
  };
}

test('a well-formed record validates and builds the row the publisher reads', () => {
  const result = validateLawEntity(authored(), options);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const row = result.row;
  assert.equal(row.lane, 'other');
  assert.equal(row.kind, 'law');
  assert.equal(row.status, 'pending');
  assert.equal(row.research_lane_only, true);
  assert.equal(row.source_item_id, row.id);
  assert.equal(row.source_program_id, 'law-editorial');
  assert.equal(row.canonical_url, 'https://www.govinfo.gov/one.pdf');
  // The three payload keys buildReleaseSourceFromLandscape actually reads for depth and prose.
  assert.equal(typeof row.payload.historicalContext, 'string');
  assert.equal(typeof row.payload.impactStatement, 'string');
  assert.equal((row.payload.evidenceCitations as unknown[]).length, 1);
  assert.equal(result.warnings.length, 0);
});

test('coordinates are required: the publisher skips a coordinate-less new record', () => {
  const result = validateLawEntity(
    authored({ place: { state: 'IL', lat: Number.NaN, lng: Number.NaN, precision: 'state' } }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('finite')));
});

test('an evidence citation on the canonical document is rejected, not silently dropped', () => {
  const result = validateLawEntity(
    authored({
      evidence: [
        {
          // Same document as canonicalSource once www. and the trailing slash are normalized away.
          sourceUrl: 'https://govinfo.gov/one.pdf',
          title: 'The same page again',
          quote: 'Something.',
          verbatim: true,
        },
      ],
    }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('same document as canonicalSource')));
});

test('a law or case record needs two distinct source documents', () => {
  const result = validateLawEntity(authored({ evidence: [] }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('distinct source document')));
});

test('an empty quote is rejected because the publisher would drop the citation', () => {
  const result = validateLawEntity(
    authored({
      evidence: [
        { sourceUrl: 'https://uscode.house.gov/two', title: 'Codifier note', quote: '  ', verbatim: false },
      ],
    }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('would drop this citation')));
});

test('a state rule cannot be authored against the nation', () => {
  const result = validateLawEntity(
    authored({
      id: 'ent_law_example_state_act_1853',
      scope: { level: 'state', jurisdictionId: 'nation:US', jurisdictionName: 'Illinois' },
      applicability: { ...authored().applicability, scopeLevel: 'state', jurisdictionId: 'nation:US' },
    }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('cannot sit on jurisdiction')));
});

test('scope level and jurisdiction must agree between the record and its applicability hint', () => {
  const result = validateLawEntity(
    authored({ applicability: { ...authored().applicability, jurisdictionId: 'state:17' } }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('disagrees with scope.jurisdictionId')));
});

test('a record carrying disputes must set the disputed flag', () => {
  const base = authored();
  const result = validateLawEntity(
    authored({
      disputes: [
        {
          id: 'dispute-example',
          question: 'Was the exclusion racially designed?',
          positions: [
            { label: 'A', claim: 'Yes.', heldBy: ['Someone'], citationUrl: base.evidence[0]!.sourceUrl },
            { label: 'B', claim: 'No.', heldBy: ['Someone else'], citationUrl: base.canonicalSource.url },
          ],
          handling: 'Name both positions. Do not adjudicate.',
        },
      ],
    }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('disputed is not true')));
});

test('a one-sided dispute is a finding and is rejected', () => {
  const base = authored();
  const result = validateLawEntity(
    authored({
      applicability: { ...base.applicability, disputed: true },
      disputes: [
        {
          id: 'dispute-example',
          question: 'Was the exclusion racially designed?',
          positions: [{ label: 'A', claim: 'Yes.', heldBy: ['Someone'], citationUrl: base.canonicalSource.url }],
          handling: 'Name the position.',
        },
      ],
    }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('fewer than two positions')));
});

test('a dispute position must cite one of the record’s own sources', () => {
  const base = authored();
  const result = validateLawEntity(
    authored({
      applicability: { ...base.applicability, disputed: true },
      disputes: [
        {
          id: 'dispute-example',
          question: 'Was the exclusion racially designed?',
          positions: [
            { label: 'A', claim: 'Yes.', heldBy: ['Someone'], citationUrl: 'https://example.org/elsewhere' },
            { label: 'B', claim: 'No.', heldBy: ['Someone else'], citationUrl: base.canonicalSource.url },
          ],
          handling: 'Name both positions. Do not adjudicate.',
        },
      ],
    }),
    options,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('not one of this record')));
});

test('a summary outside the publisher bounds fails', () => {
  assert.equal(validateLawEntity(authored({ summary: 'too short' }), options).ok, false);
  assert.equal(validateLawEntity(authored({ summary: 'x'.repeat(901) }), options).ok, false);
});

test('a record whose every claim is a paraphrase warns; every claim publishes under "source states"', () => {
  const base = authored();
  const result = validateLawEntity(
    authored({ evidence: [{ ...base.evidence[0]!, verbatim: false }] }),
    options,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.warnings.some((warning) => warning.includes('verbatim source text')));
});

test('a single-paragraph narrative warns rather than fails', () => {
  const result = validateLawEntity(authored({ historicalContext: 'One paragraph only.' }), options);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.warnings.some((warning) => warning.includes('paragraph')));
});

test('predicted claim ids follow the publisher’s own numbering', () => {
  assert.equal(predictedClaimId('ent_law_example_act_1935', 0), 'claim_law_example_act_1935_01');
  assert.equal(predictedClaimId('ent_case_example_v_texas_1954', 1), 'claim_case_example_v_texas_1954_02');
});

test('cited-year check finds the start and end years in claim text', () => {
  const claimText = new Map([
    ['claim_a', 'Approved August 14, 1935. www.govinfo.gov'],
    ['claim_b', 'The exclusions ended January 1, 1951. Codifier note'],
  ]);
  const checks = checkCitedYears({
    inForceFromEdtf: '1935-08-14',
    inForceToEdtf: '1951-01-01',
    claimText,
  });
  assert.deepEqual(
    checks.map((check) => [check.role, check.year, check.cited]),
    [
      ['start', 1935, true],
      ['end', 1951, true],
    ],
  );
  assert.deepEqual(checks[0]!.citedBy, ['claim_a']);
});

test('an uncited end year is reported as a bind failure', () => {
  const checks = checkCitedYears({
    inForceFromEdtf: '1935-08-14',
    inForceToEdtf: '1951-01-01',
    claimText: new Map([['claim_a', 'Approved August 14, 1935.']]),
  });
  assert.equal(checks[1]!.cited, false);
});

test('an open-ended window checks only the start year', () => {
  const checks = checkCitedYears({
    inForceFromEdtf: '1935-07-05',
    inForceToEdtf: null,
    claimText: new Map([['claim_a', 'Approved July 5, 1935.']]),
  });
  assert.equal(checks.length, 1);
});

test('document keys match on host and path, ignoring www and a trailing slash', () => {
  assert.equal(documentKeyForUrl('https://www.example.gov/a/b/'), documentKeyForUrl('https://example.gov/a/b'));
  assert.notEqual(documentKeyForUrl('https://example.gov/a'), documentKeyForUrl('https://example.gov/b'));
  assert.equal(documentKeyForUrl('not a url'), null);
});

test('narrative paragraphs are counted on blank lines', () => {
  assert.equal(countNarrativeParagraphs('one\n\ntwo\n\nthree'), 3);
  assert.equal(countNarrativeParagraphs('one line only'), 1);
  assert.equal(countNarrativeParagraphs('   '), 0);
});

test('the row carries the authored applicability and disputes for the binder downstream', () => {
  const base = authored();
  const row = buildLawEntityRow(
    authored({
      applicability: { ...base.applicability, disputed: true },
      disputes: [
        {
          id: 'dispute-example',
          question: 'Was the exclusion racially designed?',
          positions: [
            { label: 'A', claim: 'Yes.', heldBy: ['Someone'], citationUrl: base.canonicalSource.url },
            { label: 'B', claim: 'No.', heldBy: ['Someone else'], citationUrl: base.evidence[0]!.sourceUrl },
          ],
          handling: 'Name both positions. Do not adjudicate.',
        },
      ],
    }),
    options,
  );
  const authoredBlock = row.payload.authored as Record<string, unknown>;
  assert.equal((authoredBlock.disputes as unknown[]).length, 1);
  assert.equal(
    (authoredBlock.applicability as Record<string, unknown>).id,
    'lives-us-example-act-1935',
  );
});
