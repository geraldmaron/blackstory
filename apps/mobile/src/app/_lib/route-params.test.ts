/**
 * Standalone fuzz/property tests for the shared route-parameter parser (MOB-008). This is the
 * "evidence to close" corpus threat-model T4 calls for: malformed/hostile deep-link inputs must
 * be rejected or sanitized, never crash the parser and never pass through unchanged.
 */
import {
  ENTITY_KINDS,
  MAX_ENTITY_ID_LENGTH,
  MAX_ERA_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_URL_LENGTH,
  SAFE_DEFAULT_ROUTE,
  isSafeInternalPath,
  isUrlLengthSafe,
  parseEntityId,
  parseFilterState,
  parseRestoredRoute,
  parseReturnTo,
  parseSearchQuery,
} from './route-params';

describe('parseEntityId', () => {
  it('accepts a real-shaped id', () => {
    expect(parseEntityId('ent_caam_los_angeles_001')).toBe('ent_caam_los_angeles_001');
  });

  it('rejects missing/non-string input', () => {
    expect(parseEntityId(undefined)).toBeNull();
    expect(parseEntityId(null)).toBeNull();
    expect(parseEntityId(42)).toBeNull();
    expect(parseEntityId({})).toBeNull();
    expect(parseEntityId([])).toBeNull();
  });

  it('rejects the empty string', () => {
    expect(parseEntityId('')).toBeNull();
  });

  it('rejects an id past the max length', () => {
    expect(parseEntityId('a'.repeat(MAX_ENTITY_ID_LENGTH))).toBe('a'.repeat(MAX_ENTITY_ID_LENGTH));
    expect(parseEntityId('a'.repeat(MAX_ENTITY_ID_LENGTH + 1))).toBeNull();
  });

  it('rejects uppercase / unexpected charset', () => {
    expect(parseEntityId('ENT_CAAM_001')).toBeNull();
    expect(parseEntityId('ent caam 001')).toBeNull();
    expect(parseEntityId('ent.caam.001')).toBeNull();
  });

  it('rejects path-traversal-looking ids, raw and percent-encoded', () => {
    expect(parseEntityId('../../etc/passwd')).toBeNull();
    expect(parseEntityId('..%2f..%2fetc%2fpasswd')).toBeNull();
    expect(parseEntityId('%2e%2e%2f%2e%2e%2fetc')).toBeNull();
    expect(parseEntityId('%252e%252e%252f')).toBeNull(); // double-encoded traversal
    expect(parseEntityId('ent_caam/../../secret')).toBeNull();
    expect(parseEntityId('ent_caam\\..\\..\\secret')).toBeNull();
  });

  it('rejects malformed percent-encoding instead of throwing', () => {
    expect(() => parseEntityId('%')).not.toThrow();
    expect(parseEntityId('%')).toBeNull();
    expect(parseEntityId('%zz')).toBeNull();
    expect(parseEntityId('ent_caam_%')).toBeNull();
    expect(parseEntityId('%e0%e0')).toBeNull(); // incomplete/invalid UTF-8 escape
  });

  it('rejects whitespace-padded ids rather than silently trimming', () => {
    expect(parseEntityId(' ent_caam_001 ')).toBeNull();
    expect(parseEntityId('ent_caam_001\n')).toBeNull();
  });

  it('rejects unicode / emoji / null-byte payloads', () => {
    expect(parseEntityId('ent_caam_✅')).toBeNull();
    expect(parseEntityId('ent_caam_%00')).toBeNull();
  });

  it('rejects injection-shaped payloads', () => {
    expect(parseEntityId("'; DROP TABLE entities;--")).toBeNull();
    expect(parseEntityId('<script>alert(1)</script>')).toBeNull();
  });

  it('takes the first value of a duplicate-param array rather than joining/crashing', () => {
    expect(parseEntityId(['ent_caam_001', 'ent_moad_002'])).toBe('ent_caam_001');
  });

  it('rejects an entity id that is itself a full external URL', () => {
    expect(parseEntityId('https://evil.example.com/x')).toBeNull();
  });
});

describe('parseSearchQuery', () => {
  it('trims and returns a normal query', () => {
    expect(parseSearchQuery('  civil rights  ')).toBe('civil rights');
  });

  it('returns empty string for non-string / missing input', () => {
    expect(parseSearchQuery(undefined)).toBe('');
    expect(parseSearchQuery(123)).toBe('');
    expect(parseSearchQuery({})).toBe('');
  });

  it('rejects an overlong query outright rather than truncating', () => {
    const tooLong = 'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    expect(parseSearchQuery(tooLong)).toBe('');
    expect(parseSearchQuery('a'.repeat(MAX_SEARCH_QUERY_LENGTH))).toBe('a'.repeat(MAX_SEARCH_QUERY_LENGTH));
  });

  it('strips control characters (including CR/LF header-injection-shaped input) but keeps normal spaces', () => {
    expect(parseSearchQuery('civil\r\nrights')).toBe('civilrights');
    expect(parseSearchQuery('civil rights')).toBe('civil rights');
  });

  it('does not throw on malformed percent-encoding and returns empty string', () => {
    expect(() => parseSearchQuery('civil%rights')).not.toThrow();
    expect(parseSearchQuery('civil%rights')).toBe('');
    expect(parseSearchQuery('%zz')).toBe('');
  });

  it('rejects an open-redirect-shaped query (absolute/scheme/protocol-relative URL)', () => {
    expect(parseSearchQuery('https://evil.example.com')).toBe('');
    expect(parseSearchQuery('javascript:alert(1)')).toBe('');
    expect(parseSearchQuery('//evil.example.com')).toBe('');
    expect(parseSearchQuery('data:text/html,evil')).toBe('');
  });

  it('takes the first value for a duplicate query param', () => {
    expect(parseSearchQuery(['first term', 'second term'])).toBe('first term');
  });
});

describe('parseFilterState', () => {
  it('keeps a valid kind and discards an unknown one', () => {
    expect(parseFilterState({ kind: 'place' })).toEqual({ kind: 'place' });
    expect(parseFilterState({ kind: 'not-a-real-kind' })).toEqual({});
    for (const kind of ENTITY_KINDS) {
      expect(parseFilterState({ kind })).toEqual({ kind });
    }
  });

  it('discards a too-long or malformed era', () => {
    expect(parseFilterState({ era: '1950s' })).toEqual({ era: '1950s' });
    expect(parseFilterState({ era: 'a'.repeat(MAX_ERA_LENGTH + 1) })).toEqual({});
    expect(parseFilterState({ era: '1950s; DROP TABLE' })).toEqual({});
  });

  it('discards unknown keys entirely (no passthrough)', () => {
    const result = parseFilterState({ kind: 'place', evil: 'payload' } as never);
    expect(result).toEqual({ kind: 'place' });
    expect((result as Record<string, unknown>).evil).toBeUndefined();
  });

  it('handles missing/null/non-object input without throwing', () => {
    expect(parseFilterState(undefined)).toEqual({});
    expect(parseFilterState(null)).toEqual({});
  });
});

describe('isSafeInternalPath / parseReturnTo (open-redirect defense)', () => {
  it('accepts the four tab roots and Data', () => {
    expect(isSafeInternalPath('/explore')).toBe(true);
    expect(isSafeInternalPath('/search')).toBe(true);
    expect(isSafeInternalPath('/learn')).toBe(true);
    expect(isSafeInternalPath('/more')).toBe(true);
    expect(isSafeInternalPath('/data')).toBe(true);
  });

  it('accepts an entity route with a valid id and rejects one with an invalid id', () => {
    expect(isSafeInternalPath('/entity/ent_caam_001')).toBe(true);
    expect(isSafeInternalPath('/entity/../../secret')).toBe(false);
    expect(isSafeInternalPath('/entity/')).toBe(false);
  });

  it('rejects an unenumerated route', () => {
    expect(isSafeInternalPath('/admin')).toBe(false);
    expect(isSafeInternalPath('/')).toBe(false);
  });

  it('rejects an absolute external URL (open-redirect attempt)', () => {
    expect(isSafeInternalPath('https://evil.example.com/explore')).toBe(false);
    expect(parseReturnTo('https://evil.example.com/explore')).toBeNull();
  });

  it('rejects a protocol-relative URL (open-redirect attempt)', () => {
    expect(isSafeInternalPath('//evil.example.com')).toBe(false);
    expect(parseReturnTo('//evil.example.com')).toBeNull();
  });

  it('rejects a javascript: scheme payload', () => {
    expect(isSafeInternalPath('javascript:alert(1)')).toBe(false);
    expect(parseReturnTo('javascript:alert(1)')).toBeNull();
  });

  it('parseReturnTo accepts a valid internal target and returns null for anything else', () => {
    expect(parseReturnTo('/explore')).toBe('/explore');
    expect(parseReturnTo(undefined)).toBeNull();
    expect(parseReturnTo(42)).toBeNull();
    expect(parseReturnTo(['https://evil.example.com', '/explore'])).toBeNull();
  });
});

describe('isUrlLengthSafe', () => {
  it('accepts a normal-length URL and rejects an overlong one', () => {
    expect(isUrlLengthSafe('https://blackbook.app/explore')).toBe(true);
    expect(isUrlLengthSafe('https://blackbook.app/entity/' + 'a'.repeat(MAX_URL_LENGTH))).toBe(false);
  });

  it('rejects non-string / empty input', () => {
    expect(isUrlLengthSafe(undefined)).toBe(false);
    expect(isUrlLengthSafe('')).toBe(false);
  });
});

describe('parseRestoredRoute (cold-start / process-restoration safety)', () => {
  it('restores a valid persisted static route', () => {
    expect(parseRestoredRoute({ pathname: '/search' })).toEqual({ pathname: '/search' });
  });

  it('restores a valid persisted entity route', () => {
    expect(parseRestoredRoute({ pathname: '/entity/ent_caam_001' })).toEqual({
      pathname: '/entity/ent_caam_001',
    });
  });

  it('falls back to the safe default when the persisted entity id format is stale/invalid', () => {
    expect(parseRestoredRoute({ pathname: '/entity/no longer valid id!!' })).toEqual(SAFE_DEFAULT_ROUTE);
  });

  it('falls back to the safe default for a completely malformed blob, never throwing', () => {
    expect(() => parseRestoredRoute(null)).not.toThrow();
    expect(parseRestoredRoute(null)).toEqual(SAFE_DEFAULT_ROUTE);
    expect(parseRestoredRoute(undefined)).toEqual(SAFE_DEFAULT_ROUTE);
    expect(parseRestoredRoute('a plain string')).toEqual(SAFE_DEFAULT_ROUTE);
    expect(parseRestoredRoute(42)).toEqual(SAFE_DEFAULT_ROUTE);
    expect(parseRestoredRoute([])).toEqual(SAFE_DEFAULT_ROUTE);
    expect(parseRestoredRoute({})).toEqual(SAFE_DEFAULT_ROUTE);
  });

  it('falls back to the safe default for an open-redirect-shaped persisted pathname', () => {
    expect(parseRestoredRoute({ pathname: 'https://evil.example.com' })).toEqual(SAFE_DEFAULT_ROUTE);
    expect(parseRestoredRoute({ pathname: '//evil.example.com' })).toEqual(SAFE_DEFAULT_ROUTE);
  });

  it('falls back to the safe default for a prototype-pollution-shaped blob without throwing', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "pathname": "/explore"}');
    expect(() => parseRestoredRoute(hostile)).not.toThrow();
    expect(parseRestoredRoute(hostile)).toEqual({ pathname: '/explore' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
