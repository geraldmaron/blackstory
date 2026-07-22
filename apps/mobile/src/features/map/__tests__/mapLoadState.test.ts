import { classifyMapError, MAP_FAILURE_COPY } from '../mapLoadState';

describe('classifyMapError', () => {
  it('offline connectivity -> offline-cold-start (checked before anything else)', () => {
    expect(classifyMapError({ offline: true })).toBe('offline-cold-start');
    // offline wins even if a stale status is also present
    expect(classifyMapError({ offline: true, httpStatus: 500 })).toBe('offline-cold-start');
  });

  it('HTTP 5xx / timeout / rate-limit -> provider-outage', () => {
    expect(classifyMapError({ httpStatus: 503 })).toBe('provider-outage');
    expect(classifyMapError({ httpStatus: 500 })).toBe('provider-outage');
    expect(classifyMapError({ httpStatus: 408 })).toBe('provider-outage');
    expect(classifyMapError({ httpStatus: 429 })).toBe('provider-outage');
    expect(classifyMapError({ reason: 'Connection timed out' })).toBe('provider-outage');
  });

  it('HTTP 416 range-not-satisfiable or a parse/unsupported reason -> corrupt-tiles', () => {
    expect(classifyMapError({ httpStatus: 416 })).toBe('corrupt-tiles');
    expect(classifyMapError({ reason: 'Failed to parse PMTiles header' })).toBe('corrupt-tiles');
    expect(classifyMapError({ reason: 'Unsupported archive version' })).toBe('corrupt-tiles');
    expect(classifyMapError({ reason: 'truncated range response' })).toBe('corrupt-tiles');
  });

  it('an unrecognized signal fails toward provider-outage, never a crash', () => {
    expect(classifyMapError({})).toBe('provider-outage');
    expect(classifyMapError({ reason: 'something weird' })).toBe('provider-outage');
  });

  it('every failure mode has non-empty, retryable copy', () => {
    for (const mode of ['provider-outage', 'corrupt-tiles', 'offline-cold-start'] as const) {
      expect(MAP_FAILURE_COPY[mode].title.length).toBeGreaterThan(0);
      expect(MAP_FAILURE_COPY[mode].description.length).toBeGreaterThan(0);
      expect(MAP_FAILURE_COPY[mode].retryable).toBe(true);
    }
  });
});
