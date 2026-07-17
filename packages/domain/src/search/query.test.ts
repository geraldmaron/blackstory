/**
 * Integration tests for `runPublicSearch`: the full filter -> facet -> rank -> paginate ->
 * explain pipeline, plus (sparse records stay discoverable ranking orders, it
 * never filters low-richness records out).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicSearchIndexDocs } from './index-build.js';
import { runPublicSearch } from './query.js';
import type { PublicSearchIndexDoc, SearchExecutionInput, SearchableEntityRecord } from './types.js';

function record(
  overrides: Partial<SearchableEntityRecord> & Pick<SearchableEntityRecord, 'id' | 'displayName'>,
): SearchableEntityRecord {
  const displayName = overrides.displayName;
  return {
    kind: 'place',
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...overrides,
    id: overrides.id,
    displayName,
    nameLower: overrides.nameLower ?? displayName.toLowerCase(),
  };
}

function input(overrides: Partial<SearchExecutionInput> = {}): SearchExecutionInput {
  return {
    normalizedQuery: '',
    filters: [],
    sort: 'relevance',
    offset: 0,
    pageSize: 10,
    ...overrides,
  };
}

const INDEX: readonly PublicSearchIndexDoc[] = buildPublicSearchIndexDocs('rel-1', [
  record({
    id: 'ent_a',
    displayName: 'Alpha School',
    kind: 'school',
    status: 'active',
    eraBuckets: ['1950s'],
    topicTags: ['education'],
    jurisdictionState: 'Alabama',
    recordMaturity: 'partial_enrichment',
    researchCoverage: 'partial',
    relatedCount: 3,
  }),
  record({
    id: 'ent_b',
    displayName: 'Beta School',
    kind: 'school',
    status: 'historic',
    eraBuckets: ['1960s'],
    topicTags: ['education', 'community'],
    jurisdictionState: 'Georgia',
    recordMaturity: 'partial_enrichment',
    researchCoverage: 'substantial',
    relatedCount: 5,
  }),
  record({
    id: 'ent_c',
    displayName: 'Gamma School',
    kind: 'school',
    status: 'active',
    eraBuckets: ['1950s', '1960s'],
    topicTags: ['education'],
    jurisdictionState: 'Alabama',
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    relatedCount: 1,
  }),
  record({
    id: 'ent_d',
    displayName: 'Delta Place',
    kind: 'place',
    status: 'historic',
    eraBuckets: ['1940s'],
    topicTags: ['community'],
    jurisdictionState: 'Georgia',
    relatedCount: 8,
  }),
]).docs;

test('query + kind filter + pagination: order, facets, totalMatched, and hasMore', () => {
  const page1 = runPublicSearch(
    input({ normalizedQuery: 'school', filters: [{ field: 'kind', value: 'school' }], offset: 0, pageSize: 2 }),
    INDEX,
  );

  // Three schools contain "school" as a substring (equal text tier) -> ordered by relatedCount
  // desc: b(5), a(3), c(1). Page 1 (size 2) => [b, a].
  assert.deepEqual(
    page1.results.map((r) => r.id),
    ['ent_b', 'ent_a'],
  );
  assert.equal(page1.totalMatched, 3);
  assert.equal(page1.hasMore, true);

  // Facets are computed over the FILTERED set {a,b,c} (the place "ent_d" is excluded by the kind
  // filter), independent of pagination.
  assert.equal(page1.facets.kind.school, 3);
  assert.equal(page1.facets.kind.place, undefined);
  assert.equal(page1.facets.status.active, 2);
  assert.equal(page1.facets.status.historic, 1);
  assert.equal(page1.facets.era['1950s'], 2);
  assert.equal(page1.facets.era['1960s'], 2);
  assert.equal(page1.facets.theme.education, 3);
  assert.equal(page1.facets.state.Alabama, 2);

  // Each result carries a factual, non-numeric explanation.
  assert.equal(page1.results[0]?.explanation, 'Matched on name.');

  const page2 = runPublicSearch(
    input({ normalizedQuery: 'school', filters: [{ field: 'kind', value: 'school' }], offset: 2, pageSize: 2 }),
    INDEX,
  );
  assert.deepEqual(
    page2.results.map((r) => r.id),
    ['ent_c'],
  );
  assert.equal(page2.totalMatched, 3);
  assert.equal(page2.hasMore, false);
});

test('name_asc sort reorders the matched set deterministically', () => {
  const result = runPublicSearch(
    input({ normalizedQuery: 'school', filters: [{ field: 'kind', value: 'school' }], sort: 'name_asc' }),
    INDEX,
  );
  assert.deepEqual(
    result.results.map((r) => r.id),
    ['ent_a', 'ent_b', 'ent_c'],
  );
});

test('AC3: a sparse record (thin summary, only the minimum notability label) stays discoverable', () => {
  const rich = record({
    id: 'rich',
    displayName: 'Rich Historical Landmark',
    summary: 'An extensively documented landmark with deep research coverage.',
    notabilityLabels: ['A landmark on the National Register.', 'A documented community anchor.'],
    researchCoverage: 'substantial',
    relatedCount: 20,
  });
  const sparse = record({
    id: 'sparse',
    displayName: 'Sparse Rosewood Chapel',
    summary: undefined,
    notabilityLabels: ['A documented site.'], // exactly the one required basis label
    researchCoverage: 'minimal',
    relatedCount: 0,
  });
  const index = buildPublicSearchIndexDocs('rel-1', [rich, sparse]).docs;

  const result = runPublicSearch(input({ normalizedQuery: 'rosewood', pageSize: 10 }), index);
  assert.deepEqual(
    result.results.map((r) => r.id),
    ['sparse'],
  );
  assert.equal(result.totalMatched, 1);
  // The low-richness record still surfaced with its single notability label intact.
  assert.deepEqual(result.results[0]?.notabilityLabels, ['A documented site.']);
});

test('result views never expose relatedCount, claimCount, or any numeric ranking signal', () => {
  const result = runPublicSearch(input({ normalizedQuery: 'school' }), INDEX);
  for (const view of result.results) {
    assert.ok(!('relatedCount' in view));
    assert.ok(!('claimCount' in view));
    assert.ok(!('notabilityBasis' in view));
    assert.ok(!('score' in view));
  }
});

test('empty query browses all docs, ordered by connection strength then id', () => {
  const result = runPublicSearch(input({ normalizedQuery: '' }), INDEX);
  assert.deepEqual(
    result.results.map((r) => r.id),
    ['ent_d', 'ent_b', 'ent_a', 'ent_c'],
  );
  assert.equal(result.totalMatched, 4);
});
