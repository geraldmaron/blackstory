const test = require('node:test');
const assert = require('node:assert/strict');
const {
  surfaceClassFor,
  isPublicDocumentCacheable,
  PUBLIC_DOCUMENT_CDN_CACHE_CONTROL,
} = require('../../server/edge/surfaces.cjs');

test('surfaceClassFor', () => {
  const cases = [
    ['/', 'door'],
    ['/explore', 'door'],
    ['/records', 'reading'],
    ['/methodology', 'reading'],
    ['/stories/some-chapter', 'reading'],
    ['/place/a-place', 'record'],
    ['/law/some-case', 'record'],
    ['/privacy', 'utility'],
    ['/corrections/status/abc', 'utility'],
    ['/some-new-page', 'utility'],
    ['/records/', 'reading'],
    ['/methodology?x=1', 'reading'],
    ['/admin', null],
    ['/admin/cases', null],
    ['/robots.txt', null],
    ['/sitemap.xml', null],
    ['/search', null],
    ['/law/browse', null],
  ];
  for (const [path, expected] of cases) assert.equal(surfaceClassFor(path), expected, path);
});

test('only GET/HEAD for rendered public surfaces are CDN-cacheable', () => {
  const yes = (method, pathname) => isPublicDocumentCacheable({ method, pathname });
  assert.equal(yes('GET', '/methodology'), true);
  assert.equal(yes('HEAD', '/place/x'), true);
  assert.equal(yes('POST', '/methodology'), false);
  assert.equal(yes('GET', '/admin/cases'), false);
  assert.equal(yes('GET', '/search'), false);
  assert.equal(
    yes('GET', '/corrections/status/abc'),
    false,
    'a receipt URL is its only protection',
  );
  assert.equal(yes('GET', '/design-system'), false);
  assert.equal(yes('GET', '/design-system/tokens'), false);
  assert.equal(
    PUBLIC_DOCUMENT_CDN_CACHE_CONTROL,
    'public, s-maxage=300, stale-while-revalidate=3600',
  );
});
