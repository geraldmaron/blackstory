const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyTraffic,
  shouldDenyAiCrawler,
  denyExpensiveAiCrawler,
  isExpensiveOriginPath,
} = require('../../server/edge/traffic.cjs');

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';

test('classifyTraffic', () => {
  const cases = [
    ['', 'tool'],
    ['Mozilla/5.0 (compatible; GPTBot/1.1)', 'ai_crawler'],
    ['Mozilla/5.0 ClaudeBot/1.0', 'ai_crawler'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1)', 'search_crawler'],
    ['curl/8.4.0', 'tool'],
    ['Mozilla/5.0 HeadlessChrome/120', 'automated'],
    [CHROME, 'likely_human'],
  ];
  for (const [userAgent, expected] of cases)
    assert.equal(classifyTraffic({ userAgent }), expected, userAgent);
  assert.equal(classifyTraffic({ userAgent: CHROME, acceptLanguage: '' }), 'automated');
  assert.equal(classifyTraffic({ userAgent: CHROME, languages: [] }), 'automated');
  assert.equal(classifyTraffic({ userAgent: CHROME, webdriver: true }), 'automated');
});

test('expensive paths are the four exact paths and three api prefixes, ignoring a trailing slash', () => {
  for (const path of [
    '/explore',
    '/records',
    '/records/',
    '/atlas/catalog',
    '/sitemap.xml',
    '/explore/api',
    '/search/api/x',
    '/locate/api',
  ]) {
    assert.equal(isExpensiveOriginPath(path), true, path);
  }
  for (const path of ['/', '/methodology', '/place/x', '/exploration', '/records-old']) {
    assert.equal(isExpensiveOriginPath(path), false, path);
  }
});

test('AI crawlers and SEO tools are denied only on expensive paths; search crawlers and readers never', () => {
  assert.equal(shouldDenyAiCrawler('/records', 'GPTBot/1.1'), true);
  assert.equal(shouldDenyAiCrawler('/records', 'Mozilla/5.0 (compatible; AhrefsBot/7.0)'), true);
  assert.equal(shouldDenyAiCrawler('/methodology', 'GPTBot/1.1'), false);
  assert.equal(shouldDenyAiCrawler('/records', 'Mozilla/5.0 (compatible; Googlebot/2.1)'), false);
  assert.equal(shouldDenyAiCrawler('/records', CHROME), false);
  assert.equal(shouldDenyAiCrawler('/records', 'curl/8.4.0'), false);
});

test('denial is a private, noindex 403', () => {
  const response = denyExpensiveAiCrawler({
    pathname: '/explore',
    headers: { 'user-agent': 'ClaudeBot' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(response.headers['x-robots-tag'], 'noindex');
  assert.equal(
    denyExpensiveAiCrawler({ pathname: '/explore', headers: { 'user-agent': CHROME } }),
    null,
  );
  assert.equal(
    denyExpensiveAiCrawler({ pathname: '/explore', headers: {} }),
    null,
    'a missing UA is a tool, not an AI crawler',
  );
});
