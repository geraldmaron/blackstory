const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRequestTarget } = require('../../server/edge/paths.cjs');
const { isStaffGatePath, isAuthGatedPath } = require('../../server/edge/staff-gate.cjs');

const path = (target) => {
  const result = normalizeRequestTarget(target);
  return result.ok ? result.pathname : null;
};

test('encoded, dotted and doubled paths resolve to the route the router will pick', () => {
  assert.equal(path('/'), '/');
  assert.equal(path('/%61dmin'), '/admin');
  assert.equal(path('/%41dmin/cases'), '/Admin/cases');
  assert.equal(path('/admin/../records'), '/records');
  assert.equal(path('/%2e%2e/admin'), '/admin');
  assert.equal(path('/a/./b'), '/a/b');
  assert.equal(path('/a//b'), '/a/b');
  assert.equal(
    path('//evil.example/x'),
    '/evil.example/x',
    'a doubled leading slash is a path, not an authority',
  );
  assert.equal(path('/records?x=1#f'), '/records');
});

test('Expo loader data endpoints are gated as the routes they serve', () => {
  assert.equal(path('/_expo/loaders/admin/cases'), '/admin/cases');
  assert.equal(path('/_expo/loaders/records'), '/records');
  assert.equal(path('/_expo/loaders'), '/');
  assert.equal(
    path('/_expo/static/js/a.js'),
    '/_expo/static/js/a.js',
    'static output keeps its own path',
  );
});

test('malformed or ambiguous targets are refused rather than guessed at', () => {
  for (const target of [
    '/%zz',
    '/a%2fb',
    '/a%5Cb',
    '/%00',
    'admin',
    '',
    undefined,
    'http://x/admin',
  ]) {
    assert.equal(normalizeRequestTarget(target).ok, false, String(target));
  }
});

test('query string survives normalization', () => {
  const result = normalizeRequestTarget('/records?era=1930s&x=%20y');
  assert.equal(result.search, '?era=1930s&x=%20y');
  assert.equal(result.searchParams.get('x'), ' y');
});

test('the staff gate matches case-insensitively on the normalized path', () => {
  for (const p of ['/ADMIN', '/Admin/cases', '/DESIGN-SYSTEM', '/Design-System/x'])
    assert.equal(isStaffGatePath(p), true, p);
  assert.equal(
    isAuthGatedPath('/ADMIN/LOGIN'),
    false,
    'the sign-in page stays reachable in any case',
  );
  assert.equal(isAuthGatedPath('/Admin/cases'), true);
  assert.equal(isStaffGatePath(path('/%61dmin')), true);
  assert.equal(isStaffGatePath(path('/_expo/loaders/admin')), true);
});
