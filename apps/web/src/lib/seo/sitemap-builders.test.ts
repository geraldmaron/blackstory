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
  assert.ok(urls.some((url) => url.endsWith('/search')));
  assert.ok(urls.some((url) => url.endsWith('/explore')));
  assert.ok(urls.some((url) => url.endsWith('/stories')));
  assert.ok(urls.some((url) => url.endsWith('/corrections')));
  assert.ok(urls.some((url) => url.endsWith('/law')));
  assert.ok(urls.some((url) => url.endsWith('/books')));
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
