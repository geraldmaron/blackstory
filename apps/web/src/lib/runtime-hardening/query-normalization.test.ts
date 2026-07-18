/**
 * Unit tests for query normalization and cache key helpers.
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
    normalizeQueryString('/entity/ent_15th_st_church_001', { utm_campaign: 'x', ref: 'y' }),
    '',
  );
});

test('random query params do not change entity cache keys', () => {
  const key = buildPublicPageCacheKey('/entity/ent_15th_st_church_001', { utm_source: 'x' });
  assert.equal(key, '/entity/ent_15th_st_church_001');
});

test('search cache keys ignore tracking params', () => {
  const withTracking = buildSearchCacheKey({ q: 'school', utm_medium: 'email' });
  const clean = buildSearchCacheKey({ q: 'school' });
  assert.equal(withTracking, clean);
  assert.equal(withTracking, '/search?q=school');
});

test('buildEntityCacheKey is stable', () => {
  assert.equal(buildEntityCacheKey('ent_dunbar_school_001'), '/entity/ent_dunbar_school_001');
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

test('normalizeQueryString keeps allowlisted /explore map params', () => {
  const qs = normalizeQueryString('/explore', {
    era: '1970s',
    kind: 'school',
    lat: '38.9',
    lng: '-77.0',
    zoom: '6',
    selected: 'ent_dunbar_school_001',
    density: '1',
    utm_source: 'x',
    junk: '1',
  });
  assert.equal(
    qs,
    'density=1&era=1970s&kind=school&lat=38.9&lng=-77.0&selected=ent_dunbar_school_001&zoom=6',
  );
});

test('normalizeQueryString keeps allowlisted /history browse params', () => {
  const qs = normalizeQueryString('/history', {
    decade: '1970s',
    kind: 'event',
    selected: 'ent_dc_landmark_listing_1975',
    edge: 'edge_1',
    fbclid: 'abc',
    junk: '1',
  });
  assert.equal(qs, 'decade=1970s&edge=edge_1&kind=event&selected=ent_dc_landmark_listing_1975');
});
