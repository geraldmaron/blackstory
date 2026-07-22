/**
 * Unit tests for query normalization and cache key helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEntityCacheKey, buildPublicPageCacheKey, buildSearchCacheKey } from './cache-keys';
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

test('needsQueryNormalizationRedirect is idempotent for canonical /search URLs', () => {
  const canonical = new URL('https://example.com/search?kind=place&q=school');
  assert.equal(needsQueryNormalizationRedirect(canonical), false);

  // Reorder-only URLs must not redirect (Vercel/Next can emit a self-Location 308 loop).
  const reordered = new URL('https://example.com/search?q=school&kind=place');
  assert.equal(needsQueryNormalizationRedirect(reordered), false);
  assert.equal(
    buildNormalizedUrl(reordered).pathname + buildNormalizedUrl(reordered).search,
    '/search?kind=place&q=school',
  );
});

test('needsQueryNormalizationRedirect ignores multi-param sort order', () => {
  const canonical = new URL('https://example.com/search?q=test&sort=relevance');
  assert.equal(needsQueryNormalizationRedirect(canonical), false);

  const reordered = new URL('https://example.com/search?sort=relevance&q=test');
  assert.equal(needsQueryNormalizationRedirect(reordered), false);
  assert.equal(buildNormalizedUrl(reordered).search, '?q=test&sort=relevance');
});

test('search form query order does not redirect (prod ERR_TOO_MANY_REDIRECTS regression)', () => {
  // HTML form field order is q → kind → status → era; alphabetical would be era/kind/q/status.
  const formSubmit = new URL(
    'https://blackstory.app/search?q=Obama&kind=all&status=all&era=all',
  );
  assert.equal(needsQueryNormalizationRedirect(formSubmit), false);
  assert.equal(
    needsQueryNormalizationRedirect(
      new URL('https://blackstory.app/search?q=Obama&kind=place'),
    ),
    false,
  );
});

test('needsQueryNormalizationRedirect strips trailing slash before comparing', () => {
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/search/?q=school')),
    true,
  );
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/search?q=school')),
    false,
  );
});

test('normalizeQueryString keeps page offset on /search', () => {
  const qs = normalizeQueryString('/search', { q: 'school', offset: '20' });
  assert.equal(qs, 'offset=20&q=school');
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
    layerMode: 'presence',
    state: 'DC',
    group: '1',
    lines: '1',
    decade: '1970s',
    edge: 'rel_landmark_occurred_at_school',
    utm_source: 'x',
    junk: '1',
  });
  // Default layerMode=presence is omitted from the canonical query (cleaner revisit URLs).
  assert.equal(
    qs,
    'era=1970s&kind=school&lat=38.9000&lng=-77.0000&zoom=6.00&selected=ent_dunbar_school_001&state=DC&group=1&lines=1&decade=1970s&edge=rel_landmark_occurred_at_school',
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

test('normalizeQueryString canonicalizes explore layerMode and viewport precision', () => {
  const qs = normalizeQueryString('/explore', {
    density: 'true',
    lat: '38.90721234',
    lng: '-77.03691234',
    zoom: '11.555',
  });
  // density→presence is the default layer; omit layerMode from the canonical query.
  assert.equal(qs, 'lat=38.9072&lng=-77.0369&zoom=11.55');
  assert.equal(
    normalizeQueryString('/explore', {
      layerMode: 'blackShare',
      lat: '38.90721234',
      lng: '-77.03691234',
      zoom: '11.555',
    }),
    'lat=38.9072&lng=-77.0369&zoom=11.55&layerMode=blackShare',
  );
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

test('buildNormalizedUrl issues canonical /explore URLs for revisit', () => {
  const normalized = buildNormalizedUrl(
    new URL('https://example.com/explore?utm_source=x&state=va&group=true&lines=1'),
  );
  assert.equal(normalized.pathname, '/explore');
  assert.equal(normalized.search, '?state=VA&group=1&lines=1');
});

test('preserves _vercel_share on redirects so Vercel Authentication cannot loop', () => {
  const withShare = new URL(
    'https://blackstory-git-preview.vercel.app/search?q=obama&_vercel_share=share-token',
  );
  assert.equal(needsQueryNormalizationRedirect(withShare), false);
  assert.equal(
    buildNormalizedUrl(withShare).search,
    '?q=obama&_vercel_share=share-token',
  );

  // Cache keys still ignore the share token.
  assert.equal(normalizeQueryString('/search', withShare.searchParams), 'q=obama');

  const dirty = new URL(
    'https://blackstory-git-preview.vercel.app/search?utm_source=x&q=obama&_vercel_share=share-token',
  );
  assert.equal(needsQueryNormalizationRedirect(dirty), true);
  const once = buildNormalizedUrl(dirty);
  assert.equal(once.search, '?q=obama&_vercel_share=share-token');
  assert.equal(needsQueryNormalizationRedirect(once), false);
});

test('preserves lone _vercel_share on / (Preview SSO return)', () => {
  const home = new URL('https://blackstory-git-preview.vercel.app/?_vercel_share=share-token');
  assert.equal(needsQueryNormalizationRedirect(home), false);
  assert.equal(buildNormalizedUrl(home).search, '?_vercel_share=share-token');
});
