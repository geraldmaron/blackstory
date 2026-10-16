const test = require('node:test');
const assert = require('node:assert/strict');
const {
  handleRequestSize,
  isSecurityNormalizedPath,
  requestSizeKindForContentType,
  isRequestTooLarge,
} = require('../../server/edge/request-limits.cjs');

const request = (over = {}) => ({
  method: 'POST',
  pathname: '/methodology',
  headers: { 'content-length': '70000', 'content-type': 'application/json' },
  ...over,
});

test('state-changing requests to public routes over 64 KiB get a 413', () => {
  const response = handleRequestSize(request());
  assert.equal(response.status, 413);
  assert.equal(response.body, 'Payload Too Large');
  assert.equal(
    handleRequestSize(
      request({ headers: { 'content-length': '65536', 'content-type': 'application/json' } }),
    ),
    null,
    'exactly the limit is allowed',
  );
  assert.equal(
    handleRequestSize(
      request({ headers: { 'content-length': '65537', 'content-type': 'text/plain' } }),
    ).status,
    413,
  );
});

test('GET, HEAD, other routes and a missing Content-Length are left alone; a bad one is refused', () => {
  assert.equal(handleRequestSize(request({ method: 'GET' })), null);
  assert.equal(handleRequestSize(request({ method: 'HEAD' })), null);
  assert.equal(
    handleRequestSize(request({ pathname: '/submit/api' })),
    null,
    'endpoints are outside the normalized set',
  );
  assert.equal(handleRequestSize(request({ headers: {} })), null);
  assert.equal(handleRequestSize(request({ headers: { 'content-length': 'abc' } })).status, 413);
  assert.equal(handleRequestSize(request({ headers: { 'content-length': '-1' } })).status, 413);
});

test('the normalized route set and the size kinds', () => {
  for (const p of ['/', '/records', '/methodology', '/place/x', '/stories/y', '/law/z'])
    assert.equal(isSecurityNormalizedPath(p), true, p);
  for (const p of [
    '/history',
    '/search/api',
    '/explore/api',
    '/admin',
    '/robots.txt',
    '/placement',
  ])
    assert.equal(isSecurityNormalizedPath(p), false, p);
  assert.equal(requestSizeKindForContentType(null), 'jsonBody');
  assert.equal(requestSizeKindForContentType('Text/Plain; charset=utf-8'), 'textBody');
  assert.equal(requestSizeKindForContentType('multipart/form-data'), 'jsonBody');
  assert.equal(isRequestTooLarge(null, 'jsonBody'), false);
});
