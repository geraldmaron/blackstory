import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import {
  MAX_SEARCH_RESULTS_PER_RESPONSE,
  searchRequestV1Schema,
  searchResponseV1Schema,
  searchResultV1Schema,
} from './search.js';

test('round-trips a valid search response', () => {
  const fixture = loadFixture<Record<string, unknown>>('search-response.v1.current.json');
  const parsed = searchResponseV1Schema.parse(fixture);
  assert.equal(parsed.results.length, 1);
  assert.deepEqual(parsed, fixture);
});

test('defaults sort to "relevance" on a request with no sort specified', () => {
  const parsed = searchRequestV1Schema.parse({ query: 'Dunbar' });
  assert.equal(parsed.sort, 'relevance');
});

test('rejects an unknown filter field (adversarial: unknown enum value)', () => {
  assert.throws(() =>
    searchRequestV1Schema.parse({
      query: 'x',
      filters: [{ field: 'notabilityScore', value: '5' }],
    }),
  );
});

test('rejects a results array beyond MAX_SEARCH_RESULTS_PER_RESPONSE (adversarial: unbounded array)', () => {
  const oneResult = {
    id: 'x',
    kind: 'place',
    displayName: 'X',
    matchedOn: 'displayName' as const,
    matchedText: 'X',
    explanation: 'e',
    eraBuckets: [],
    notabilityLabels: [],
  };
  const oversized = {
    results: Array.from({ length: MAX_SEARCH_RESULTS_PER_RESPONSE + 1 }, () => oneResult),
    facets: {
      kind: {},
      status: {},
      era: {},
      theme: {},
      state: {},
      recordMaturity: {},
      researchCoverage: {},
    },
    totalMatched: MAX_SEARCH_RESULTS_PER_RESPONSE + 1,
    hasMore: false,
  };
  assert.throws(() => searchResponseV1Schema.parse(oversized));
});

test('drops relatedCount/claimCount/relevanceScore/rankingSignal on parse (sensitive-field negative snapshot)', () => {
  const fixture = loadFixture<Record<string, unknown>>('search-result.v1.sensitive-leak.json');
  const parsed = searchResultV1Schema.parse(fixture);
  assert.equal(parsed.id, fixture.id);
  for (const forbiddenKey of ['relatedCount', 'claimCount', 'relevanceScore', 'rankingSignal']) {
    assert.ok(
      !(forbiddenKey in parsed),
      `${forbiddenKey} must not survive parsing (raw ranking-signal ban)`,
    );
  }
});

test('accepts a graded confidenceTier on a result and keeps the value intact', () => {
  const parsed = searchResultV1Schema.parse({
    id: 'ent_1',
    kind: 'place',
    displayName: 'Dunbar High School',
    matchedOn: 'displayName',
    matchedText: 'Dunbar High School',
    explanation: 'Matched on name.',
    eraBuckets: [],
    notabilityLabels: [],
    confidenceTier: 'high',
  });
  assert.equal(parsed.confidenceTier, 'high');
});

test('leaves confidenceTier absent — not "unrated" — when a payload predates the field', () => {
  const parsed = searchResultV1Schema.parse({
    id: 'ent_1',
    kind: 'place',
    displayName: 'Dunbar High School',
    matchedOn: 'displayName',
    matchedText: 'Dunbar High School',
    explanation: 'Matched on name.',
    eraBuckets: [],
    notabilityLabels: [],
  });
  assert.ok(!('confidenceTier' in parsed), 'an ungraded payload must not be graded on parse');
});

test('rejects a confidenceTier outside the shared four-value vocabulary', () => {
  assert.throws(() =>
    searchResultV1Schema.parse({
      id: 'ent_1',
      kind: 'place',
      displayName: 'Dunbar High School',
      matchedOn: 'displayName',
      matchedText: 'Dunbar High School',
      explanation: 'Matched on name.',
      eraBuckets: [],
      notabilityLabels: [],
      confidenceTier: 'A',
    }),
  );
});

test('a TIER is admitted while an evidence COUNT is still stripped (assessment vs ranking signal)', () => {
  const parsed = searchResultV1Schema.parse({
    id: 'ent_1',
    kind: 'place',
    displayName: 'Dunbar High School',
    matchedOn: 'displayName',
    matchedText: 'Dunbar High School',
    explanation: 'Matched on name.',
    eraBuckets: [],
    notabilityLabels: [],
    confidenceTier: 'medium',
    evidenceCount: 7,
    connectionCount: 3,
  });
  assert.equal(parsed.confidenceTier, 'medium');
  for (const forbiddenKey of ['evidenceCount', 'connectionCount']) {
    assert.ok(!(forbiddenKey in parsed), `${forbiddenKey} must not survive parsing`);
  }
});
