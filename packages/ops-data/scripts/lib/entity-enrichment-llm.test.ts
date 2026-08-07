import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEnrichmentResponse, type EnrichmentSubject } from './entity-enrichment-llm.ts';

const LONG_ENOUGH_SUMMARY =
  'John Doe operated a business at this site starting in 1925, documented in the National ' +
  'Register nomination for the property, which describes the founding and early decades in detail.';
assert.ok(LONG_ENOUGH_SUMMARY.length >= 120 && LONG_ENOUGH_SUMMARY.length <= 400);

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

test('rejects a summary shorter than the 120-char floor', () => {
  const attempt = validateEnrichmentResponse(
    baseSubject(),
    ['business'],
    validResponse({
      summary: 'Too short.',
      summaryCitations: [{ evidenceId: 'ev_1', quote: 'John Doe' }],
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
  assert.ok(summaryWithAddress.length >= 120 && summaryWithAddress.length <= 400);
  const attempt = validateEnrichmentResponse(
    subject,
    ['business'],
    validResponse({
      summary: summaryWithAddress,
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
  assert.ok(summaryWithAddress.length >= 120 && summaryWithAddress.length <= 400);
  const attempt = validateEnrichmentResponse(
    subject,
    [],
    validResponse({
      summary: summaryWithAddress,
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
