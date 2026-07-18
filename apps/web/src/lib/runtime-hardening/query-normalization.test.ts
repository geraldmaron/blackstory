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
    state: 'DC',
    group: '1',
    lines: '1',
    decade: '1970s',
    edge: 'rel_landmark_occurred_at_school',
    utm_source: 'x',
    junk: '1',
  });
  assert.equal(
    qs,
    'era=1970s&kind=school&lat=38.9000&lng=-77.0000&zoom=6.00&selected=ent_dunbar_school_001&state=DC&density=1&group=1&lines=1&decade=1970s&edge=rel_landmark_occurred_at_school',
  );
});

test('normalizeQueryString preserves /explore?state= revisit links (homepage chips)', () => {
  assert.equal(normalizeQueryString('/explore', { state: 'dc' }), 'state=DC');
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/explore?state=DC')),
    false,
  );
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/explore?state=DC&utm_source=x')),
    true,
  );
});

test('normalizeQueryString canonicalizes explore density/true and viewport precision', () => {
  const qs = normalizeQueryString('/explore', {
    density: 'true',
    lat: '38.90721234',
    lng: '-77.03691234',
    zoom: '11.555',
  });
  assert.equal(qs, 'lat=38.9072&lng=-77.0369&zoom=11.55&density=1');
});

test('normalizeQueryString keeps allowlisted /history browse params', () => {
  const qs = normalizeQueryString('/history', {
    decade: '1970s',
    kind: 'event',
    q: 'dunbar',
    sort: 'connections',
    selected: 'ent_dc_landmark_listing_1975',
    edge: 'edge_1',
    fbclid: 'abc',
    junk: '1',
  });
  assert.equal(
    qs,
    'decade=1970s&kind=event&q=dunbar&sort=connections&selected=ent_dc_landmark_listing_1975&edge=edge_1',
  );
});

test('normalizeQueryString keeps allowlisted /facts library params', () => {
  const qs = normalizeQueryString('/facts', {
    q: ' school ',
    claimType: 'founding',
    confidence: 'high',
    offset: '20',
    utm_source: 'newsletter',
    junk: '1',
  });
  assert.equal(qs, 'claimType=founding&confidence=high&offset=20&q=school');
});

test('buildNormalizedUrl issues canonical /explore URLs for revisit', () => {
  const normalized = buildNormalizedUrl(
    new URL('https://example.com/explore?utm_source=x&state=va&group=true&lines=1'),
  );
  assert.equal(normalized.pathname, '/explore');
  assert.equal(normalized.search, '?state=VA&group=1&lines=1');
});
