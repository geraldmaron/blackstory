/**
 * AI-training crawlers must not pull the Explore catalog or other origin-expensive routes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { denyExpensiveAiCrawler, isExpensiveOriginPath, shouldDenyAiCrawler } from './edge-deny';

test('the deny response is never shared-cacheable (the CDN keys on URL, not user agent)', () => {
  const response = denyExpensiveAiCrawler(
    new NextRequest('https://blackstory.app/records', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SemrushBot/7~bl)' },
    }),
  );
  assert.equal(response?.status, 403);
  assert.equal(response?.headers.get('cache-control'), 'private, no-store');
});

test('expensive origin paths are the catalog, Explore, and paid APIs', () => {
  assert.equal(isExpensiveOriginPath('/atlas/catalog'), true);
  assert.equal(isExpensiveOriginPath('/sitemap.xml'), true);
  assert.equal(isExpensiveOriginPath('/explore'), true);
  assert.equal(isExpensiveOriginPath('/explore/api'), true);
  assert.equal(isExpensiveOriginPath('/search/api'), true);
  assert.equal(isExpensiveOriginPath('/locate/api'), true);
  assert.equal(isExpensiveOriginPath('/records'), true);
  assert.equal(isExpensiveOriginPath('/'), false);
  assert.equal(isExpensiveOriginPath('/place/dunbar-high-school'), false);
});

test('SEO-tool crawlers are denied on every expensive path', () => {
  const semrush = 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)';
  assert.equal(shouldDenyAiCrawler('/records', semrush), true);
  assert.equal(shouldDenyAiCrawler('/sitemap.xml', semrush), true);
  assert.equal(shouldDenyAiCrawler('/place/dunbar-high-school', semrush), false);
  assert.equal(shouldDenyAiCrawler('/explore', 'Mozilla/5.0 (compatible; AhrefsBot/7.0)'), true);
});

test('AI answer-engine crawlers are denied like training crawlers, sitemap included', () => {
  const claude =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +searchbot@anthropic.com)';
  const amazon =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-SearchBot/0.1) Chrome/119.0.6045.214 Safari/537.36';
  for (const ua of [claude, amazon]) {
    assert.equal(shouldDenyAiCrawler('/records', ua), true);
    assert.equal(shouldDenyAiCrawler('/explore', ua), true);
    assert.equal(shouldDenyAiCrawler('/search/api', ua), true);
    assert.equal(shouldDenyAiCrawler('/sitemap.xml', ua), true);
    // Cheap cached pages are not the origin's to deny; the Cloudflare edge blocks these agents.
    assert.equal(shouldDenyAiCrawler('/entity/civil-rights-leaders-calvin-shirley', ua), false);
  }
});

test('ordinary browsers are never denied', () => {
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  for (const path of ['/records', '/explore', '/sitemap.xml', '/search/api']) {
    assert.equal(shouldDenyAiCrawler(path, safari), false);
  }
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
