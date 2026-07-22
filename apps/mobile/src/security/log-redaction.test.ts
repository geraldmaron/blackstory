import {
  redactForLog,
  redactedLogLine,
  isSensitiveKey,
  REDACTED,
} from './log-redaction';

describe('log redaction — sensitive categories never survive', () => {
  it('redacts search query text by key', () => {
    const out = redactForLog({
      searchQuery: 'Tulsa massacre 1921',
      queryText: 'lynching records',
      q: 'sundown towns',
    }) as Record<string, unknown>;
    expect(out.searchQuery).toBe(REDACTED);
    expect(out.queryText).toBe(REDACTED);
    expect(out.q).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('Tulsa');
    expect(JSON.stringify(out)).not.toContain('lynching');
    expect(JSON.stringify(out)).not.toContain('sundown');
  });

  it('redacts correction content', () => {
    const raw = 'The date on this record is wrong, it should be 1863.';
    const out = redactForLog({ correctionContent: raw, correction: raw }) as Record<
      string,
      unknown
    >;
    expect(out.correctionContent).toBe(REDACTED);
    expect(out.correction).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('1863');
  });

  it('redacts precise location by key and by value pattern', () => {
    const out = redactForLog({
      location: { latitude: 40.7128, longitude: -74.006 },
      note: 'seen near 40.7128,-74.0060 downtown',
    }) as Record<string, unknown>;
    expect(out.location).toBe(REDACTED);
    // The lat,lng value pattern is caught even under an innocuous key.
    expect(out.note).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('40.7128');
  });

  it('redacts citation / source URLs', () => {
    const out = redactForLog({
      citationUrl: 'https://archives.gov/evidence/12345',
      sourceUrl: 'https://loc.gov/item/abc',
    }) as Record<string, unknown>;
    expect(out.citationUrl).toBe(REDACTED);
    expect(out.sourceUrl).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('archives.gov');
  });

  it('redacts sensitive entity classifications', () => {
    const out = redactForLog({
      classification: 'protected-living-person',
      protectedStatus: 'restricted',
      era: 'antebellum',
    }) as Record<string, unknown>;
    expect(out.classification).toBe(REDACTED);
    expect(out.protectedStatus).toBe(REDACTED);
    expect(out.era).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('protected-living-person');
  });

  it('redacts raw App Check tokens by key and by JWT value pattern', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcHBjaGVjayJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const out = redactForLog({
      appCheckToken: jwt,
      // Same token smuggled under an innocuous key — caught by value pattern.
      debugField: `attaching header ${jwt}`,
    }) as Record<string, unknown>;
    expect(out.appCheckToken).toBe(REDACTED);
    expect(out.debugField).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('scrubs sensitive values carried inside an Error message/stack', () => {
    const err = new Error(
      'request failed for query "Tulsa massacre" at 40.7128,-74.0060',
    );
    const out = redactForLog(err) as Record<string, unknown>;
    // The lat,lng pattern in the message triggers whole-message redaction.
    expect(out.message).toBe(REDACTED);
    expect(out.name).toBe('Error');
    const line = redactedLogLine(err);
    expect(line).not.toContain('40.7128');
  });

  it('preserves non-sensitive fields and structure', () => {
    const out = redactForLog({
      status: 200,
      route: '/v1/entity/abc',
      durationMs: 42,
      ok: true,
      nested: { retryCount: 1 },
    }) as Record<string, unknown>;
    expect(out.status).toBe(200);
    expect(out.route).toBe('/v1/entity/abc');
    expect(out.durationMs).toBe(42);
    expect(out.ok).toBe(true);
    expect(out.nested).toEqual({ retryCount: 1 });
  });

  it('handles cyclic structures without throwing', () => {
    const cyclic: Record<string, unknown> = { safe: 'value' };
    cyclic.self = cyclic;
    expect(() => redactForLog(cyclic)).not.toThrow();
  });

  it('isSensitiveKey recognizes each protected category', () => {
    for (const key of [
      'searchQuery',
      'correctionContent',
      'location',
      'longitude',
      'citationUrl',
      'classification',
      'appCheckToken',
    ]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
    expect(isSensitiveKey('status')).toBe(false);
    expect(isSensitiveKey('durationMs')).toBe(false);
  });
});
