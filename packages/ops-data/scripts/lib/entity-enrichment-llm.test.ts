import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEnrichmentUserPrompt,
  SUMMARY_MIN_CHARS,
  validateEnrichmentResponse,
  type EnrichmentSubject,
} from './entity-enrichment-llm.ts';

const LONG_ENOUGH_SUMMARY =
  'John Doe operated a business at this site starting in 1925, documented in the National ' +
  'Register nomination for the property, which describes the founding and early decades in detail. ' +
  'The business served local residents during a formative period and its documented operations ' +
  'provide a record of community economic life.';
assert.ok(
  LONG_ENOUGH_SUMMARY.length >= SUMMARY_MIN_CHARS && LONG_ENOUGH_SUMMARY.length <= 400,
);

function atMinimumSummary(value: string): string {
  return value.padEnd(SUMMARY_MIN_CHARS, ' ');
}

function baseSubject(overrides: Partial<EnrichmentSubject> = {}): EnrichmentSubject {
  return {
    entityId: 'ent_test_1',
    displayName: 'Test Entity',
    kind: 'place',
    lane: 'nrhp-black-heritage',
    restrictedAddress: false,
    evidence: [
      {
        id: 'ev_1',
        sourceTier: 'tier1',
        title: 'Nomination',
        text: 'John Doe operated a business at this site starting in 1925. It closed in 1958.',
      },
    ],
    ...overrides,
  };
}

function validResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    summary: LONG_ENOUGH_SUMMARY,
    summaryCitations: [
      { evidenceId: 'ev_1', quote: 'operated a business at this site starting in 1925' },
    ],
    historicalContext: null,
    historicalContextCitations: [],
    topicIds: ['business'],
    eraBuckets: ['1920s'],
    keywords: ['entrepreneurship'],
    ...overrides,
  });
}

test('accepts a well-formed response with an anchored citation', () => {
  const attempt = validateEnrichmentResponse(baseSubject(), ['business'], validResponse());
  assert.equal(attempt.validation.ok, true);
  if (attempt.validation.ok) {
    assert.equal(attempt.validation.draft.summary, LONG_ENOUGH_SUMMARY);
    assert.deepEqual(attempt.validation.draft.topicIds, ['business']);
  }
});

test('rejects a 156-character summary below the 220-char floor', () => {
  const underFloorSummary =
    'John Doe operated a business at this site starting in 1925. The property records a documented local business history and its role in the neighborhood during that period.'.slice(
      0,
      156,
    );
  assert.equal(underFloorSummary.length, 156);
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({
      summary: underFloorSummary,
      summaryCitations: [
        { evidenceId: 'ev_1', quote: 'John Doe operated a business at this site starting in 1925' },
      ],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('length')));
  }
});

test('rejects a citation quote that does not appear verbatim in the named evidence', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({
      summaryCitations: [{ evidenceId: 'ev_1', quote: 'this sentence was never in the source' }],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(
      attempt.validation.errors.some((error) => error.includes('does not appear verbatim')),
    );
  }
});

test('rejects a citation that names an evidence id not offered to the model', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({
      summaryCitations: [{ evidenceId: 'ev_does_not_exist', quote: 'John Doe operated' }],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('unknown evidenceId')));
  }
});

test('rejects a topicId outside the controlled taxonomy', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({ topicIds: ['not-a-real-topic'] }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('controlled vocabulary')));
  }
});

test('rejects a topicId that is valid taxonomy but was not in allowedTopicIds', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['music'],
    validResponse({ topicIds: ['business'] }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(
      attempt.validation.errors.some((error) => error.includes('was not in the allowedTopicIds')),
    );
  }
});

test('rejects a malformed eraBucket label', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({ eraBuckets: ['nineteen-twenties'] }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('eraBuckets')));
  }
});

test('rejects a future decade label', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({ eraBuckets: ['2090s'] }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('eraBuckets')));
  }
});

test('rejects address-shaped tokens in generated prose for a restricted-address property', () => {
  const subject = baseSubject({
    restrictedAddress: true,
    evidence: [
      {
        id: 'ev_1',
        sourceTier: 'tier1',
        title: 'Nomination',
        text: 'The property sits near 123 Main Street in the historic district, founded in 1925.',
      },
    ],
  });
  const summaryWithAddress =
    'The site at 123 Main Street was founded in 1925 and served the community for decades ' +
    'as documented in the National Register nomination form on file with the state office.';
  assert.ok(
    atMinimumSummary(summaryWithAddress).length >= SUMMARY_MIN_CHARS &&
      atMinimumSummary(summaryWithAddress).length <= 400,
  );
  const attempt = validateEnrichmentResponse(
    subject,
    ['business'],
    validResponse({
      summary: atMinimumSummary(summaryWithAddress),
      summaryCitations: [{ evidenceId: 'ev_1', quote: '123 Main Street in the historic district' }],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('address-shaped token')));
  }
});

test('rejects address-shaped tokens for a person entity even without restrictedAddress set', () => {
  const subject = baseSubject({
    kind: 'person',
    restrictedAddress: false,
    evidence: [
      {
        id: 'ev_1',
        sourceTier: 'tier2',
        title: 'Wikipedia',
        text: 'She lived at 456 Elm Street and worked as an organizer starting in 1962.',
      },
    ],
  });
  const summaryWithAddress =
    'She lived at 456 Elm Street and worked as a community organizer starting in 1962, ' +
    'according to the encyclopedia article documenting her decades of civic involvement.';
  assert.ok(
    atMinimumSummary(summaryWithAddress).length >= SUMMARY_MIN_CHARS &&
      atMinimumSummary(summaryWithAddress).length <= 400,
  );
  const attempt = validateEnrichmentResponse(
    subject,
    [],
    validResponse({
      summary: atMinimumSummary(summaryWithAddress),
      summaryCitations: [{ evidenceId: 'ev_1', quote: 'lived at 456 Elm Street' }],
      topicIds: [],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('address-shaped token')));
  }
});

test('allows a place entity (non-restricted, non-person) to keep a street address in prose', () => {
  const subject = baseSubject({ kind: 'place', restrictedAddress: false });
  const attempt = validateEnrichmentResponse(subject, ['business'], validResponse());
  assert.equal(attempt.validation.ok, true);
});

test('rejects historicalContext prose with no citations', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({
      historicalContext: 'It served the neighborhood for decades as a community anchor.',
      historicalContextCitations: [],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('no citations')));
  }
});

test('rejects non-JSON responses without throwing', () => {
  const attempt = validateEnrichmentResponse(baseSubject(), ['business'], 'not json at all');
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.deepEqual(attempt.validation.errors, ['response is not valid JSON']);
  }
});

test('rejects an address-shaped keyword for a person entity', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject({ kind: 'person' }),
    ['business'],
    validResponse({ keywords: ['entrepreneurship', '511 West South Street'] }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('keywords')));
  }
});

/**
 * repo-lm6h. The live failure this reproduces: nrhp-black-heritage-14000104 (Monte Verdi
 * Plantation) published with '...recognized under ethnic heritage (black) as well as agriculture.'
 * The phrase is a real substring of the NPS source, so the citation anchored and every other check
 * passed. Note the subject/evidence below make the quote genuinely verifiable — the point is that a
 * VALID citation is not enough, so a test that cheated the anchor would prove nothing.
 */
test('rejects a summary that copies raw registry vocabulary out of the source', () => {
  const subject = baseSubject({
    evidence: [
      {
        id: 'ev_1',
        sourceTier: 'tier1',
        title: 'Nomination',
        text: 'The property is recognized under ethnic heritage (black) as well as agriculture.',
      },
    ],
  });
  const summaryWithCode =
    'The plantation was home to a large African American community whose labor sustained one of ' +
    'the largest antebellum estates in the county, and it is recognized under ethnic heritage ' +
    '(black) as well as agriculture in the National Register listing for the site.';
  assert.ok(
    atMinimumSummary(summaryWithCode).length >= SUMMARY_MIN_CHARS &&
      atMinimumSummary(summaryWithCode).length <= 400,
  );
  const attempt = validateEnrichmentResponse(
    subject,
    ['business'],
    validResponse({
      summary: atMinimumSummary(summaryWithCode),
      summaryCitations: [
        { evidenceId: 'ev_1', quote: 'recognized under ethnic heritage (black) as well as' },
      ],
    }),
  );
  assert.equal(attempt.validation.ok, false);
  if (!attempt.validation.ok) {
    assert.ok(attempt.validation.errors.some((error) => error.includes('registry vocabulary')));
  }
});

test('rejects raw registry vocabulary in historicalContext and in keywords', () => {
  const subject = baseSubject({
    evidence: [
      {
        id: 'ev_1',
        sourceTier: 'tier1',
        title: 'Nomination',
        text:
          'John Doe operated a business at this site starting in 1925. It closed in 1958. ' +
          'Areas of significance: ETHNIC HERITAGE-BLACK; ENTERTAINMENT/RECREATION.',
      },
    ],
  });
  const contextAttempt = validateEnrichmentResponse(
    subject,
    ['business'],
    validResponse({
      historicalContext:
        'The nomination records the site under ETHNIC HERITAGE-BLACK, alongside its commercial role.',
      historicalContextCitations: [{ evidenceId: 'ev_1', quote: 'ETHNIC HERITAGE-BLACK' }],
    }),
  );
  assert.equal(contextAttempt.validation.ok, false);
  if (!contextAttempt.validation.ok) {
    assert.ok(
      contextAttempt.validation.errors.some(
        (error) => error.startsWith('historicalContext') && error.includes('registry vocabulary'),
      ),
    );
  }

  const keywordAttempt = validateEnrichmentResponse(
    subject,
    ['business'],
    validResponse({ keywords: ['ENTERTAINMENT/RECREATION'] }),
  );
  assert.equal(keywordAttempt.validation.ok, false);
  if (!keywordAttempt.validation.ok) {
    assert.ok(
      keywordAttempt.validation.errors.some(
        (error) => error.startsWith('keywords') && error.includes('registry vocabulary'),
      ),
    );
  }
});

/**
 * The guard has to leave ordinary English alone: "ethnic heritage" as words in a sentence is not
 * the registry field, and a pattern that cannot tell them apart costs a redraft cycle on every
 * legitimate entry that uses the phrase.
 */
test('accepts prose that uses the words "ethnic heritage" naturally', () => {
  const subject = baseSubject({
    evidence: [
      {
        id: 'ev_1',
        sourceTier: 'tier1',
        title: 'Nomination',
        text: 'The congregation preserved its ethnic heritage through music and language after 1925.',
      },
    ],
  });
  const summary =
    'The congregation preserved its ethnic heritage through music and language after 1925, and ' +
    'the church remained the center of Black community life in the district for several decades.';
  assert.ok(
    atMinimumSummary(summary).length >= SUMMARY_MIN_CHARS &&
      atMinimumSummary(summary).length <= 400,
  );
  const attempt = validateEnrichmentResponse(
    subject,
    ['business'],
    validResponse({
      summary: atMinimumSummary(summary),
      summaryCitations: [
        { evidenceId: 'ev_1', quote: 'preserved its ethnic heritage through music and language' },
      ],
    }),
  );
  assert.equal(attempt.validation.ok, true);
});

test('user prompt tells the drafter not to copy registry classification fields', () => {
  const prompt = buildEnrichmentUserPrompt(baseSubject(), ['business']);
  assert.ok(prompt.includes('never copy a registry classification field into prose'));
});

test('user prompt carries the privacy rule for person subjects and omits it for plain places', async () => {
  const { buildEnrichmentUserPrompt } = await import('./entity-enrichment-llm.ts');
  const personPrompt = buildEnrichmentUserPrompt(baseSubject({ kind: 'person' }), ['business']);
  const restrictedPrompt = buildEnrichmentUserPrompt(baseSubject({ restrictedAddress: true }), [
    'business',
  ]);
  const placePrompt = buildEnrichmentUserPrompt(baseSubject(), ['business']);
  assert.ok(personPrompt.includes('PRIVACY'));
  assert.ok(restrictedPrompt.includes('PRIVACY'));
  assert.ok(!placePrompt.includes('PRIVACY'));
});
