/**
 * sitemap builder tests active release entities become canonical entity URLs.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildPublicSitemapEntries } from './sitemap-builders';
import { allDestinations, crawlableDestinations } from '../nav/destination-registry';

test('buildPublicSitemapEntries includes static core journeys', () => {
  const entries = buildPublicSitemapEntries({
    siteUrl: 'https://blackbook.example',
    releaseGeneratedAt: '2026-07-17T00:00:00.000Z',
  });
  const urls = entries.map((entry) => entry.url);
  // `/records` replaced `/history` here with SP-09: the record index is the crawlable list the
  // decade view used to stand in for, and `/history` is now only a redirect into it.
  assert.ok(urls.some((url) => url.endsWith('/records')));
  assert.ok(urls.some((url) => url.endsWith('/stories')));
  assert.ok(urls.some((url) => url.endsWith('/corrections')));
  assert.ok(urls.some((url) => url.endsWith('/law')));
  assert.ok(urls.some((url) => url.endsWith('/books')));
});

test('the sitemap never advertises a URL that redirects', () => {
  const entries = buildPublicSitemapEntries({
    siteUrl: 'https://blackbook.example',
    releaseGeneratedAt: '2026-07-17T00:00:00.000Z',
  });
  const urls = entries.map((entry) => entry.url);
  // `/explore` is the Atlas instrument. `/` is the featured door.
  assert.ok(urls.some((url) => url.endsWith('/explore')));
  // `/history` 308s into `/records` for the same reason.
  assert.ok(!urls.some((url) => url.endsWith('/history')));
  assert.ok(urls.some((url) => url === 'https://blackbook.example/'));
});

test('the sitemap never lists the same URL twice', () => {
  // `/history` was listed twice for two releases, which put a duplicate `<url>` element in the
  // shipped sitemap. This is the standing assertion SP-19 (repo-92n2.19) requires.
  const urls = buildPublicSitemapEntries({
    siteUrl: 'https://blackbook.example',
    releaseGeneratedAt: '2026-07-17T00:00:00.000Z',
    entities: [{ id: 'ent_a' }, { id: 'ent_b' }],
  }).map((entry) => entry.url);
  assert.deepEqual([...new Set(urls)].sort(), [...urls].sort());
});

/**
 * Every static route the App Router actually serves, read off disk.
 *
 * Route groups (a directory wrapped in parens, e.g. `app/(group)/page.tsx`) contribute no URL
 * segment, and dynamic segments are skipped because the sitemap builds those from the release
 * rather than from the registry.
 */
function renderedStaticRoutes(appDir: string): ReadonlySet<string> {
  const routes = new Set<string>();

  const walk = (dir: string, route: string): void => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (item.isFile() && item.name === 'page.tsx') routes.add(route === '' ? '/' : route);
      if (!item.isDirectory()) continue;
      if (item.name.startsWith('_') || item.name.startsWith('[') || item.name === 'api') continue;
      const segment = item.name.startsWith('(') ? '' : `/${item.name}`;
      walk(join(dir, item.name), `${route}${segment}`);
    }
  };

  walk(appDir, '');
  return routes;
}

test('every path the sitemap advertises is a page that exists', () => {
  // The failure this catches is advertising a route the site does not serve — /story is in the
  // registry as a destination but does not render until SP-10, so it must not carry `crawl` yet.
  // Losing crawl budget to a 404 is the cheap half of the cost; the expensive half is a crawler
  // learning the sitemap is unreliable.
  const rendered = renderedStaticRoutes(join(import.meta.dirname, '../../app'));
  for (const destination of crawlableDestinations()) {
    assert.ok(
      rendered.has(destination.path),
      `${destination.path} is in the sitemap but has no page.tsx`,
    );
  }
});

test('a destination is left out of the sitemap only on purpose', () => {
  // Absent `crawl` is a decision, and the only one taken so far is /design-system (noindex).
  // /story left this list by leaving the registry entirely when the route was deprecated.
  // Any second omission is an oversight until someone records why.
  const omitted = allDestinations()
    .filter((destination) => destination.crawl === undefined)
    .map((destination) => destination.path);
  assert.deepEqual(omitted.sort(), ['/design-system']);
});

test('the sitemap is the registry, not a second list of the same routes', () => {
  const urls = buildPublicSitemapEntries({ siteUrl: 'https://blackbook.example' }).map(
    (entry) => entry.url,
  );
  const expected = crawlableDestinations().map((destination) =>
    new URL(destination.path, 'https://blackbook.example').toString(),
  );
  assert.deepEqual(urls, expected);
});

test('a noindexed route is never advertised in the sitemap', () => {
  const urls = buildPublicSitemapEntries({ siteUrl: 'https://blackbook.example' }).map(
    (entry) => entry.url,
  );
  for (const destination of allDestinations()) {
    if (destination.noIndex !== true) continue;
    assert.ok(
      !urls.includes(new URL(destination.path, 'https://blackbook.example').toString()),
      `${destination.path} asks not to be indexed and is in the sitemap anyway`,
    );
  }
});

test('buildPublicSitemapEntries adds entity pages from the active release catalog', () => {
  const entries = buildPublicSitemapEntries({
    siteUrl: 'https://blackbook.example',
    entities: [{ id: 'ent_15th_st_church_001', updatedAt: '2026-07-01T00:00:00.000Z' }],
  });
  const entity = entries.find((entry) => entry.url.includes('/entity/ent_15th_st_church_001'));
  assert.ok(entity);
  assert.equal(entity?.changeFrequency, 'weekly');
  assert.equal(entity?.priority, 0.8);
});
