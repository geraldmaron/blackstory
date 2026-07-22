import {
  DEFAULT_SEARCH_PAGE_SIZE,
  RankingSignalLeakError,
  assertNoRankingSignal,
  buildQueryShapeKey,
  buildSearchRequestPath,
} from '../search-contracts';

describe('buildSearchRequestPath', () => {
  it('is deterministic: the same params always build the same path', () => {
    const params = { query: 'harriet tubman', kind: 'person' };
    expect(buildSearchRequestPath(params)).toBe(buildSearchRequestPath({ ...params }));
  });

  it('includes q and, when provided, kind/cursor/pageSize', () => {
    const path = buildSearchRequestPath({ query: 'tubman', kind: 'person', cursor: 'abc', pageSize: 10 });
    const url = new URL(`https://example.test${path}`);
    expect(url.pathname).toBe('/v1/search');
    expect(url.searchParams.get('q')).toBe('tubman');
    expect(url.searchParams.get('kind')).toBe('person');
    expect(url.searchParams.get('cursor')).toBe('abc');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  it('omits kind/cursor when absent, rather than sending an empty string', () => {
    const path = buildSearchRequestPath({ query: 'tubman' });
    const url = new URL(`https://example.test${path}`);
    expect(url.searchParams.has('kind')).toBe(false);
    expect(url.searchParams.has('cursor')).toBe(false);
  });

  it('never sends an `era` filter param -- apps/api-public/src/search-guardrails.ts does not accept one', () => {
    const path = buildSearchRequestPath({ query: 'tubman' });
    expect(path).not.toContain('era=');
  });

  it('uses the same default page size as the server guardrail', () => {
    expect(DEFAULT_SEARCH_PAGE_SIZE).toBe(20);
  });
});

describe('buildQueryShapeKey', () => {
  it('is deterministic and distinguishes different filter combinations for the same text', () => {
    const noFilter = buildQueryShapeKey({ query: 'tubman' });
    const withFilter = buildQueryShapeKey({ query: 'tubman', kind: 'person' });
    expect(noFilter).not.toBe(withFilter);
    expect(buildQueryShapeKey({ query: 'tubman', kind: 'person' })).toBe(withFilter);
  });
});

describe('assertNoRankingSignal — negative-snapshot backstop', () => {
  it('does not throw for a clean, contract-shaped result', () => {
    expect(() =>
      assertNoRankingSignal([
        {
          id: 'ent_1',
          kind: 'person',
          displayName: 'Harriet Tubman',
          matchedOn: 'displayName',
          matchedText: 'Harriet Tubman',
          explanation: 'Matched on name.',
          eraBuckets: [],
          notabilityLabels: [],
        },
      ]),
    ).not.toThrow();
  });

  const forbiddenFieldCases = [
    'relevanceScore',
    'relevance_score',
    'score',
    'search_score',
    'rank',
    'ranking',
    'claimCount',
    'claim_count',
    'relatedCount',
    'related_count',
    'evidenceCount',
    'evidence_count',
  ];

  it.each(forbiddenFieldCases)(
    'throws RankingSignalLeakError if a result carries a forbidden field "%s" (simulating a compromised/buggy server or a schema regression)',
    (field) => {
      const hostile = [
        {
          id: 'ent_1',
          kind: 'person',
          displayName: 'Harriet Tubman',
          matchedOn: 'displayName',
          matchedText: 'Harriet Tubman',
          explanation: 'Matched on name.',
          eraBuckets: [],
          notabilityLabels: [],
          [field]: 0.987,
        },
      ];
      expect(() => assertNoRankingSignal(hostile)).toThrow(RankingSignalLeakError);
    },
  );

  it('checks every result in the array, not just the first', () => {
    const hostile = [
      { id: 'ent_1', kind: 'person', displayName: 'A' },
      { id: 'ent_2', kind: 'person', displayName: 'B', relevanceScore: 0.5 },
    ];
    expect(() => assertNoRankingSignal(hostile)).toThrow(RankingSignalLeakError);
  });
});
