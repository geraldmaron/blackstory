/**
 * Unit tests for query normalization and cache key helpers (BB-022).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEntityCacheKey,
  buildPublicPageCacheKey,
  buildSearchCacheKey,
} from './cache-keys';
import {
  buildNormalizedUrl,
  needsQueryNormalizationRedirect,
  normalizeQueryString,
  normalizeSearchParamsRecord,
} from './query-normalization';

test('normalizeQueryString keeps only allowlisted /search params', () => {
  const qs = normalizeQueryString('/search', {
    q: ' school ',
    kind: 'place',
    era: 'all',
    topic: 'education',
    utm_source: 'newsletter',
    fbclid: 'abc',
  });
  assert.equal(qs, 'era=all&kind=place&q=school&topic=education');
});

test('normalizeQueryString strips all params on entity routes', () => {
  assert.equal(
    normalizeQueryString('/entity/ent_seed_place_001', { utm_campaign: 'x', ref: 'y' }),
    '',
  );
});

test('random query params do not change entity cache keys', () => {
  const key = buildPublicPageCacheKey('/entity/ent_seed_place_001', { utm_source: 'x' });
  assert.equal(key, '/entity/ent_seed_place_001');
});

test('search cache keys ignore tracking params', () => {
  const withTracking = buildSearchCacheKey({ q: 'school', utm_medium: 'email' });
  const clean = buildSearchCacheKey({ q: 'school' });
  assert.equal(withTracking, clean);
  assert.equal(withTracking, '/search?q=school');
});

test('buildEntityCacheKey is stable', () => {
  assert.equal(buildEntityCacheKey('ent_seed_school_001'), '/entity/ent_seed_school_001');
});

test('needsQueryNormalizationRedirect detects tracking params', () => {
  const dirty = new URL('https://example.com/search?q=school&utm_source=x');
  const clean = new URL('https://example.com/search?q=school');
  assert.equal(needsQueryNormalizationRedirect(dirty), true);
  assert.equal(needsQueryNormalizationRedirect(clean), false);
});

test('buildNormalizedUrl issues canonical /search URLs', () => {
  const normalized = buildNormalizedUrl(
    new URL('https://example.com/search?utm_source=x&q=school&kind=place'),
  );
  assert.equal(normalized.pathname, '/search');
  assert.equal(normalized.search, '?kind=place&q=school');
});

test('normalizeSearchParamsRecord returns trimmed filter bag', () => {
  assert.deepEqual(
    normalizeSearchParamsRecord('/search', { q: '  dc  ', kind: 'place', junk: '1' }),
    { q: 'dc', kind: 'place' },
  );
});
