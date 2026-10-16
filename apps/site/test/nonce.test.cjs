const test = require('node:test');
const assert = require('node:assert/strict');
const { makeNonce, addNonce, cspHeader } = require('../server/nonce.cjs');

test('makeNonce is unique and base64', () => {
  const nonces = new Set(Array.from({ length: 500 }, makeNonce));
  assert.equal(nonces.size, 500);
  for (const n of nonces) assert.match(n, /^[A-Za-z0-9+/]{22}==$/);
});

test('addNonce covers script, style and script preload, once', () => {
  const html =
    '<link rel="preload" href="/a.js" as="script"/><link rel="stylesheet" href="/a.css"/>' +
    '<style>a{}</style><script src="/a.js"></script><script id="_R_">x</script><script nonce="OLD">y</script>';
  const out = addNonce(html, 'N');
  assert.equal((out.match(/<script nonce="N"/g) ?? []).length, 2);
  assert.equal((out.match(/<style nonce="N"/g) ?? []).length, 1);
  assert.equal((out.match(/<link nonce="N" rel="preload"/g) ?? []).length, 1);
  assert.match(out, /<script nonce="OLD">/);
  assert.doesNotMatch(out, /<link nonce="N" rel="stylesheet"/);
  assert.equal(addNonce(out, 'N2'), out.replace(/x/g, 'x'), 'second pass changes nothing');
});

test('cspHeader carries the nonce and strict-dynamic', () => {
  const header = cspHeader('abc==');
  assert.match(header, /script-src 'self' 'nonce-abc==' 'strict-dynamic'/);
  assert.match(header, /object-src 'none'/);
});
