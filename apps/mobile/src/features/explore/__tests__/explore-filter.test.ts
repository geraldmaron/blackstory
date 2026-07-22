/**
 * Deterministic filter tests (MOB-012). "Deterministic" = same inputs, same
 * ordered output and same count, every time.
 */
import { applyFilters, countMatches, matchesFilters } from '../explore-filter';
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
      makeFeature('x', [-80, 35], { label: 'X', properties: { eraBuckets: ['1950'] } as never }),
      makeFeature('y', [-81, 36], { label: 'Y', properties: { eraBuckets: ['1900'] } as never }),
    ];
    expect(applyFilters(features, { era: '1950' }).map((f) => f.id)).toEqual(['x']);
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
