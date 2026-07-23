/**
 * Deterministic filter tests (MOB-012 / Explore v7 Phase C). "Deterministic" = same inputs, same
 * ordered output and same count, every time.
 */
import { applyFilters, buildExploreFacetOptions, countMatches, matchesFilters } from '../explore-filter';
import { makeFeature, SEPARATED } from '../__fixtures__/features';

describe('applyFilters — determinism + stable order', () => {
  it('returns the full population (stably ordered) for empty filters', () => {
    const out = applyFilters(SEPARATED, {});
    expect(out.map((f) => f.id)).toEqual(['a', 'b', 'c']); // sorted by label Alpha/Bravo/Charlie
  });

  it('produces identical output across repeated runs (deterministic)', () => {
    const a = applyFilters(SEPARATED, { kind: 'place' });
    const b = applyFilters(SEPARATED, { kind: 'place' });
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
    expect(a.map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('filters by era membership when features carry eras', () => {
    const features = [
      makeFeature('x', [-80, 35], { label: 'X', properties: { eraBuckets: ['1950s'] } as never }),
      makeFeature('y', [-81, 36], { label: 'Y', properties: { eraBuckets: ['1900s'] } as never }),
    ];
    expect(applyFilters(features, { era: '1950s' }).map((f) => f.id)).toEqual(['x']);
  });
});

describe('applyFilters — kind families', () => {
  it('filters by kind family slug', () => {
    expect(applyFilters(SEPARATED, { kind: 'places' }).map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(applyFilters(SEPARATED, { kind: 'place' }).map((f) => f.id)).toEqual(['a', 'c']);
  });
});

describe('applyFilters — web parity facets', () => {
  const features = [
    makeFeature('a', [-77, 38], {
      label: 'Alpha',
      kind: 'place',
      properties: {
        eraBuckets: ['1950s'],
        mapTone: 'plantation',
        topicIds: ['education'],
        status: 'historic',
        confidenceTier: 'high',
        statePostalCode: 'DC',
      } as never,
    }),
    makeFeature('b', [-95, 29], {
      label: 'Bravo',
      kind: 'school',
      properties: {
        eraBuckets: ['1960s'],
        confidenceTier: 'low',
        status: 'active',
        statePostalCode: 'TX',
      } as never,
    }),
  ];

  it('filters by tone, theme, status, confidence, and state in web order', () => {
    expect(applyFilters(features, { tone: 'plantation' }).map((f) => f.id)).toEqual(['a']);
    expect(applyFilters(features, { theme: 'education' }).map((f) => f.id)).toEqual(['a']);
    expect(applyFilters(features, { status: 'active' }).map((f) => f.id)).toEqual(['b']);
    expect(applyFilters(features, { confidence: 'high' }).map((f) => f.id)).toEqual(['a']);
    expect(applyFilters(features, { state: 'TX' }).map((f) => f.id)).toEqual(['b']);
  });

  it('builds facet options from the current feature set', () => {
    const facets = buildExploreFacetOptions(features);
    expect(facets.tone.some((option) => option.value === 'plantation')).toBe(true);
    expect(facets.theme.some((option) => option.value === 'education')).toBe(true);
    expect(facets.state.some((option) => option.value === 'DC')).toBe(true);
  });
});

describe('countMatches — reflects filters', () => {
  it('counts the filtered result set', () => {
    expect(countMatches(SEPARATED, {})).toBe(3);
    expect(countMatches(SEPARATED, { kind: 'place' })).toBe(2);
    expect(countMatches(SEPARATED, { kind: 'school' })).toBe(1);
  });
});

describe('matchesFilters', () => {
  it('ignores absent filters and requires present ones', () => {
    const f = makeFeature('z', [-80, 35], { kind: 'event' });
    expect(matchesFilters(f, {})).toBe(true);
    expect(matchesFilters(f, { kind: 'event' })).toBe(true);
    expect(matchesFilters(f, { kind: 'place' })).toBe(false);
  });
});
