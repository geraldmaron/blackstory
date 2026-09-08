/**
 * Adversarial case: stale legal version detection (MOB-015 requirement #4/#9).
 */
import { isContentVersionStale, isLegalVersionStale } from './legal-version';

describe('isLegalVersionStale', () => {
  it('is not stale when versions match', () => {
    expect(isLegalVersionStale('2026-01-01', { privacy: '2026-01-01' }, 'privacy')).toBe(false);
  });

  it('is stale when the manifest carries a newer version for the slug', () => {
    expect(isLegalVersionStale('2026-01-01', { privacy: '2026-06-01' }, 'privacy')).toBe(true);
  });

  it('is not stale (unknown-safe default) when the manifest has no entry for the slug', () => {
    expect(isLegalVersionStale('2026-01-01', { terms: '2026-06-01' }, 'privacy')).toBe(false);
  });

  it('is not stale when no manifest is available at all', () => {
    expect(isLegalVersionStale('2026-01-01', undefined, 'privacy')).toBe(false);
  });

  it('is stale when there is no known cached version but the manifest has an entry', () => {
    expect(isLegalVersionStale(undefined, { privacy: '2026-06-01' }, 'privacy')).toBe(true);
  });
});

describe('isContentVersionStale', () => {
  it('is not stale when the cached content version matches the current one', () => {
    expect(isContentVersionStale('content-v3', 'content-v3')).toBe(false);
  });

  it('is stale when a newer content version is now current', () => {
    expect(isContentVersionStale('content-v3', 'content-v4')).toBe(true);
  });

  it('is not stale (unknown-safe) when either side is unknown', () => {
    expect(isContentVersionStale(undefined, 'content-v4')).toBe(false);
    expect(isContentVersionStale('content-v3', undefined)).toBe(false);
    expect(isContentVersionStale(undefined, undefined)).toBe(false);
  });
});
