/**
 * Unit tests for query normalization and cache key helpers.
 *
 * Includes the two-way allowlist drift guard: `EXPLORE_PAGE_PARAM_ALLOWLIST` is generated from
 * the URL parser's key set, and these tests fail if the parser reads a key the allowlist lacks,
 * or if the serializer writes one.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS,
  parseExploreSearchParams,
  type RawExploreSearchParams,
} from '../map-experience/url-state';
import { buildEntityCacheKey, buildPublicPageCacheKey, buildSearchCacheKey } from './cache-keys';
import { EXPLORE_PAGE_PARAM_ALLOWLIST } from './constants';
import {
  buildNormalizedUrl,
  getAllowedQueryParamsForPath,
  needsQueryNormalizationRedirect,
  normalizeQueryString,
  normalizeSearchParamsRecord,
} from './query-normalization';

const URL_STATE_SOURCE = new URL('../map-experience/url-state.ts', import.meta.url);

/** Every query key `parseExploreSearchParams` actually touches, recorded through a Proxy. */
function keysReadByExploreParser(): readonly string[] {
  const read = new Set<string>();
  const probe = new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key === 'string') read.add(key);
        return undefined;
      },
    },
  ) as RawExploreSearchParams;
  parseExploreSearchParams(probe);
  return [...read].sort();
}

/** Every literal key `buildExploreSearchParams` can write, read from the serializer's own body. */
function keysWrittenByExploreBuilder(): readonly string[] {
  const source = readFileSync(URL_STATE_SOURCE, 'utf8');
  const start = source.indexOf('export function buildExploreSearchParams');
  assert.ok(start > 0, 'buildExploreSearchParams not found in url-state.ts');
  const end = source.indexOf('\nexport ', start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);
  const written = new Set<string>();
  for (const match of body.matchAll(/params\.set\(\s*'([^']+)'/g)) {
    written.add(match[1]!);
  }
  return [...written].sort();
}

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
  const formSubmit = new URL('https://blackstory.app/search?q=Obama&kind=all&status=all&era=all');
  assert.equal(needsQueryNormalizationRedirect(formSubmit), false);
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://blackstory.app/search?q=Obama&kind=place')),
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
  const qs = normalizeQueryString('/', {
    era: '1970s',
    kind: 'school',
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
    'era=1970s&kind=school&selected=ent_dunbar_school_001&state=DC&group=1&lines=1&decade=1970s&edge=rel_landmark_occurred_at_school',
  );
});

test('normalizeQueryString keeps the filter params the earlier hand-written allowlist missed', () => {
  // tone, status, radius and near are read by the parser and were being stripped at the edge.
  assert.equal(
    normalizeQueryString('/', {
      tone: 'resistance',
      status: 'historic',
      radius: '10mi',
      near: 'Palm Beach County, Florida',
    }),
    'tone=resistance&status=historic&radius=10mi&near=Palm+Beach+County%2C+Florida',
  );
});

test('ADR-017: lat/lng/zoom never survive normalization on the map surface', () => {
  for (const path of ['/', '/']) {
    assert.equal(
      normalizeQueryString(path, { lat: '38.9072', lng: '-77.0369', zoom: '11.5', state: 'dc' }),
      'state=DC',
      path,
    );
  }
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/explore?lat=38.9&lng=-77&zoom=6')),
    true,
  );
  assert.equal(
    buildNormalizedUrl(new URL('https://example.com/explore?lat=38.9&lng=-77&zoom=6')).search,
    '',
  );
});

test('panel chrome is not shareable state: panels= and hidePanels= normalize away', () => {
  assert.equal(normalizeQueryString('/', { panels: 'filters,results,key' }), '');
  assert.equal(normalizeQueryString('/', { hidePanels: 'results' }), '');
  assert.equal(normalizeQueryString('/', { panels: 'filters', state: 'dc' }), 'state=DC');
});

test('/ and /explore normalize identically (one param vocabulary, two paths)', () => {
  const bag = {
    era: '1970s',
    kind: 'school',
    tone: 'resistance',
    theme: 'education',
    status: 'historic',
    confidence: 'high',
    selected: 'ent_dunbar_school_001',
    state: 'dc',
    layerMode: 'off',
    group: 'true',
    lines: '1',
    decade: '1970s',
    edge: 'rel_landmark_occurred_at_school',
    radius: '10mi',
    near: 'Washington, DC',
    utm_source: 'x',
    junk: '1',
  };
  assert.equal(normalizeQueryString('/', bag), normalizeQueryString('/', bag));
  assert.notEqual(normalizeQueryString('/', bag), '');

  // The homepage now canonicalizes map state instead of 308ing every param off it.
  assert.equal(normalizeQueryString('/', { state: 'va', group: 'true' }), 'state=VA&group=1');
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/?state=VA&group=1')),
    false,
  );
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/?state=VA&junk=1')),
    true,
  );
});

test('drift: the map-surface allowlist covers every key the URL parser reads', () => {
  const readByParser = keysReadByExploreParser();
  const allowed = new Set<string>(EXPLORE_PAGE_PARAM_ALLOWLIST);
  const droppedByPolicy = new Set<string>(EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS);

  assert.ok(readByParser.length > 0);

  // A key the parser reads but the allowlist lacks is stripped by the edge before the page runs.
  assert.deepEqual(
    readByParser.filter((key) => !allowed.has(key) && !droppedByPolicy.has(key)),
    [],
  );

  // ...and nothing is allowlisted that the parser cannot read.
  assert.deepEqual([...allowed].filter((key) => !readByParser.includes(key)).sort(), []);

  // The ADR-017 exclusion is a decision about keys the parser genuinely reads, not a leftover.
  for (const key of droppedByPolicy) {
    assert.ok(readByParser.includes(key), `${key} is dropped by policy but never parsed`);
  }
});

test('drift: buildExploreSearchParams writes no key the allowlist lacks', () => {
  const written = keysWrittenByExploreBuilder();
  const allowed = new Set<string>(EXPLORE_PAGE_PARAM_ALLOWLIST);
  const droppedByPolicy = new Set<string>(EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS);

  assert.ok(written.length > 0);
  assert.deepEqual(
    written.filter((key) => !allowed.has(key) && !droppedByPolicy.has(key)),
    [],
  );
  assert.ok(!written.includes('panels'), 'panel chrome must not be serialized into a shared URL');
});

test('normalizeQueryString preserves /explore?state= revisit links (homepage chips)', () => {
  assert.equal(normalizeQueryString('/', { state: 'dc' }), 'state=DC');
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/explore?state=DC')),
    false,
  );
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/explore?state=DC&utm_source=x')),
    true,
  );
});

test('normalizeQueryString canonicalizes explore layerMode', () => {
  // density→presence is the default layer; omit layerMode from the canonical query.
  assert.equal(normalizeQueryString('/', { density: 'true' }), '');
  assert.equal(normalizeQueryString('/', { density: 'false' }), 'layerMode=off');
  assert.equal(
    normalizeQueryString('/', { layerMode: 'blackShare', popGeo: 'state' }),
    'layerMode=blackShare&popGeo=state',
  );
});

test('/history carries no browse allowlist, because normalizing it would break the redirect', () => {
  // The decade stepper and its selection params went with the browse UI (repo-92n2.27). What is
  // left of /history maps an incoming `decade` onto `era` and 308s to /records, so its params are
  // cargo for one hop rather than filters on a page.
  //
  // Normalization must never touch them: stripping `decade` would land a five-year-old bookmark
  // on an unfiltered index quietly, which is worse than failing. The route is out of the
  // middleware matcher (asserted below) and this keeps the allowlist empty so that adding it back
  // cannot silently start rewriting a redirect's input.
  const qs = normalizeQueryString('/history', {
    decade: '1970s',
    kind: 'event',
    fbclid: 'abc',
  });
  assert.equal(qs, '');
});

test('buildNormalizedUrl issues canonical Atlas URLs for revisit', () => {
  // `/`, not `/explore`: the Atlas answers on `/` and `/explore` left the middleware matcher
  // when it stopped rendering, so normalising it would only add a hop ahead of the redirect.
  const normalized = buildNormalizedUrl(
    new URL('https://example.com/?utm_source=x&state=va&group=true&lines=1'),
  );
  assert.equal(normalized.pathname, '/');
  assert.equal(normalized.search, '?state=VA&group=1&lines=1');
});

test('/law keeps its GET browse contract (q, kind, topic)', () => {
  assert.equal(
    normalizeQueryString('/law', { q: ' voting ', kind: 'statute', topic: 'voting_rights' }),
    'kind=statute&q=voting&topic=voting_rights',
  );
  // The filters reach the page as-is: a form submit must not 308 away its own params.
  assert.equal(
    needsQueryNormalizationRedirect(new URL('https://example.com/law?q=voting&kind=statute')),
    false,
  );
  assert.deepEqual(
    normalizeSearchParamsRecord('/law', { q: 'voting', kind: 'statute', utm_source: 'x' }),
    { q: 'voting', kind: 'statute' },
  );
  // Law detail pages take no params.
  assert.equal(normalizeQueryString('/law/civil-rights-act-1964', { q: 'voting' }), '');
});

test('/corrections keeps the CorrectionForm prefill (target, targetType)', () => {
  assert.equal(
    normalizeQueryString('/corrections', {
      target: 'ent_dunbar_school_001',
      targetType: 'entity',
      utm_campaign: 'x',
    }),
    'target=ent_dunbar_school_001&targetType=entity',
  );
  assert.equal(
    needsQueryNormalizationRedirect(
      new URL('https://example.com/corrections?target=x&targetType=entity'),
    ),
    false,
  );
});

test('API paths are not normalized: an endpoint receives its own query', () => {
  // These are no longer in the middleware matcher, so nothing strips them. Asserted here as the
  // contract: an empty allowlist plus a matcher entry is what broke them.
  for (const path of ['/history/api', '/submit/api', '/explore/api', '/search/api']) {
    assert.deepEqual(getAllowedQueryParamsForPath(path), []);
  }
  const matcher = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8');
  assert.ok(!/'\/history\/api'/.test(matcher), '/history/api must not be in the matcher');
  assert.ok(!/'\/submit\/api'/.test(matcher), '/submit/api must not be in the matcher');
  assert.ok(!/'\/[a-z-]+\/api'/.test(matcher), 'no API path belongs in the middleware matcher');
});

test('preserves _vercel_share on redirects so Vercel Authentication cannot loop', () => {
  const withShare = new URL(
    'https://blackstory-git-preview.vercel.app/search?q=obama&_vercel_share=share-token',
  );
  assert.equal(needsQueryNormalizationRedirect(withShare), false);
  assert.equal(buildNormalizedUrl(withShare).search, '?q=obama&_vercel_share=share-token');

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
