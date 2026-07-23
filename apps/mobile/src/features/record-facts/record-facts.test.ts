/**
 * Tests for mobile record fact helpers (era/status/kind labels).
 */
import { plainRangeText, recordEraLabel, recordKindLabel, recordStatusLabel } from './record-facts';

describe('recordKindLabel', () => {
  it('maps known kinds to display labels', () => {
    expect(recordKindLabel('person')).toBe('Person');
    expect(recordKindLabel('law')).toBe('Law');
  });

  it('humanizes unknown kinds', () => {
    expect(recordKindLabel('custom_kind')).toBe('Custom Kind');
  });
});

describe('recordEraLabel', () => {
  it('prefers eraBuckets over empty fallback', () => {
    expect(recordEraLabel({ eraBuckets: ['1950s', '1960s'] })).toBe('1950s to 1960s');
  });

  it('derives decade buckets from legacy era year spans', () => {
    expect(recordEraLabel({ eraBuckets: [], era: '1870 to 1891' })).toBe('1870s to 1890s');
  });

  it('returns Undated when no era signals exist', () => {
    expect(recordEraLabel({ eraBuckets: [] })).toBe('Undated');
  });
});

describe('recordStatusLabel', () => {
  it('humanizes snake_case status tokens', () => {
    expect(recordStatusLabel('in_force')).toBe('In Force');
  });

  it('returns undefined for empty status', () => {
    expect(recordStatusLabel(undefined)).toBeUndefined();
  });
});

describe('plainRangeText', () => {
  it('replaces unicode dashes with plain " to "', () => {
    expect(plainRangeText('1870–1891')).toBe('1870 to 1891');
    expect(plainRangeText('1950—1960')).toBe('1950 to 1960');
  });
});
