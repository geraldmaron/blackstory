/**
 * AI-training crawlers must not pull the Atlas catalog or other origin-expensive routes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpensiveOriginPath, shouldDenyAiCrawler } from './edge-deny';

test('expensive origin paths are the catalog, Explore, and paid APIs', () => {
  assert.equal(isExpensiveOriginPath('/atlas/catalog'), true);
  assert.equal(isExpensiveOriginPath('/sitemap.xml'), true);
  assert.equal(isExpensiveOriginPath('/explore'), true);
  assert.equal(isExpensiveOriginPath('/explore/api'), true);
  assert.equal(isExpensiveOriginPath('/search/api'), true);
  assert.equal(isExpensiveOriginPath('/locate/api'), true);
  assert.equal(isExpensiveOriginPath('/'), false);
  assert.equal(isExpensiveOriginPath('/records'), false);
  assert.equal(isExpensiveOriginPath('/place/dunbar-high-school'), false);
});

test('named AI-training crawlers are denied on those paths only', () => {
  assert.equal(shouldDenyAiCrawler('/atlas/catalog', 'GPTBot/1.0'), true);
  assert.equal(shouldDenyAiCrawler('/sitemap.xml', 'ClaudeBot/1.0'), true);
  assert.equal(shouldDenyAiCrawler('/explore', 'Mozilla/5.0 ClaudeBot/1.0'), true);
  assert.equal(shouldDenyAiCrawler('/search/api', 'Bytespider'), true);
  assert.equal(shouldDenyAiCrawler('/', 'GPTBot/1.0'), false);
  assert.equal(
    shouldDenyAiCrawler(
      '/atlas/catalog',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ),
    false,
  );
  assert.equal(shouldDenyAiCrawler('/atlas/catalog', 'curl/8.7.1'), false);
  assert.equal(shouldDenyAiCrawler('/atlas/catalog', ''), false);
});
