/**
 * Route-parameter validation tests (MOB-015 requirement #3/#9 — deep-link injection defense,
 * mirroring `_lib/route-params.test.ts`'s fuzz-corpus convention for `/entity/[id]`).
 */
import { KNOWN_SECTION_ROUTE_IDS, parseSectionParam, parseSlugParam } from './route-guards';

describe('parseSectionParam', () => {
  it('resolves a known section id', () => {
    expect(parseSectionParam('history')?.routeId).toBe('history');
    expect(parseSectionParam('legal')?.routeId).toBe('legal');
  });

  it('takes the first value of a repeated/array param', () => {
    expect(parseSectionParam(['history', 'legal'])?.routeId).toBe('history');
  });

  it('returns undefined for an unknown section id', () => {
    expect(parseSectionParam('not-a-real-section')).toBeUndefined();
  });

  it('returns undefined for malformed/hostile input', () => {
    expect(parseSectionParam(undefined)).toBeUndefined();
    expect(parseSectionParam(null)).toBeUndefined();
    expect(parseSectionParam(42)).toBeUndefined();
    expect(parseSectionParam('../../../etc/passwd')).toBeUndefined();
    expect(parseSectionParam('javascript:alert(1)')).toBeUndefined();
    expect(parseSectionParam('a'.repeat(5000))).toBeUndefined();
    expect(parseSectionParam('%zz-malformed-percent')).toBeUndefined();
  });

  it('every registered route id is a non-empty, reasonably-bounded string', () => {
    for (const id of KNOWN_SECTION_ROUTE_IDS) {
      expect(id.length).toBeGreaterThan(0);
      expect(id.length).toBeLessThan(100);
    }
  });
});

describe('parseSlugParam', () => {
  const legalRow = parseSectionParam('legal')!;
  const historyRow = parseSectionParam('history')!;

  it('resolves a real slug that exists under the given section', () => {
    expect(parseSlugParam('privacy', legalRow)).toBe('privacy');
  });

  it('returns undefined for a slug that does not exist under that section', () => {
    expect(parseSlugParam('privacy', historyRow)).toBeUndefined();
    expect(parseSlugParam('not-a-real-slug', legalRow)).toBeUndefined();
  });

  it('returns undefined for malformed/hostile input', () => {
    expect(parseSlugParam(undefined, legalRow)).toBeUndefined();
    expect(parseSlugParam('../../../etc/passwd', legalRow)).toBeUndefined();
    expect(parseSlugParam('privacy/../terms', legalRow)).toBeUndefined();
    expect(parseSlugParam('a'.repeat(500), legalRow)).toBeUndefined();
    expect(parseSlugParam({ toString: () => 'privacy' }, legalRow)).toBeUndefined();
  });
});
