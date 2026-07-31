/**
 * sitemap builder tests active release entities become canonical entity URLs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicSitemapEntries } from './sitemap-builders';

test('buildPublicSitemapEntries includes static core journeys', () => {
  const entries = buildPublicSitemapEntries({
    siteUrl: 'https://blackbook.example',
    releaseGeneratedAt: '2026-07-17T00:00:00.000Z',
  });
  const urls = entries.map((entry) => entry.url);
  // `/records` replaced `/history` here with SP-09: the record index is the crawlable list the
  // decade view used to stand in for, and `/history` is now only a redirect into it.
  assert.ok(urls.some((url) => url.endsWith('/records')));
  assert.ok(urls.some((url) => url.endsWith('/chapters')));
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
  // `/explore` 308s to `/`, which is the Atlas and carries the crawl weight instead. Listing a
  // redirect spends crawl budget teaching a URL that immediately disowns itself.
  assert.ok(!urls.some((url) => url.endsWith('/explore')));
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
