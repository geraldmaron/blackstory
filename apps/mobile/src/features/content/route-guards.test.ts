/**
 * Route-parameter validation tests (MOB-015 requirement #3/#9 — deep-link injection defense,
 * mirroring `_lib/route-params.test.ts`'s fuzz-corpus convention for `/entity/[id]`).
 */
import { KNOWN_SECTION_ROUTE_IDS, parseSectionParam, parseSlugParam } from './route-guards';

describe('parseSectionParam', () => {
  it('resolves a known section id', () => {
    expect(parseSectionParam('stories')?.routeId).toBe('stories');
    expect(parseSectionParam('methodology')?.routeId).toBe('methodology');
    // The retired sections resolve to nothing, so a stale deep link cannot reach a lookup.
    for (const retired of ['history', 'topics', 'myths', 'facts', 'legal']) {
      expect(parseSectionParam(retired)).toBeUndefined();
    }
  });

  it('takes the first value of a repeated/array param', () => {
    expect(parseSectionParam(['stories', 'methodology'])?.routeId).toBe('stories');
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
  const privacyRow = parseSectionParam('privacy')!;
  const storiesRow = parseSectionParam('stories')!;

  it('resolves a real slug that exists under the given section', () => {
    expect(parseSlugParam('privacy', privacyRow)).toBe('privacy');
    expect(parseSlugParam('dunbar-founded-1916', storiesRow)).toBe('dunbar-founded-1916');
  });

  it('returns undefined for a slug that does not exist under that section', () => {
    expect(parseSlugParam('privacy', storiesRow)).toBeUndefined();
    expect(parseSlugParam('not-a-real-slug', privacyRow)).toBeUndefined();
  });

  it('returns undefined for malformed/hostile input', () => {
    expect(parseSlugParam(undefined, privacyRow)).toBeUndefined();
    expect(parseSlugParam('../../../etc/passwd', privacyRow)).toBeUndefined();
    expect(parseSlugParam('privacy/../terms', privacyRow)).toBeUndefined();
    expect(parseSlugParam('a'.repeat(500), privacyRow)).toBeUndefined();
    expect(parseSlugParam({ toString: () => 'privacy' }, privacyRow)).toBeUndefined();
  });
});
