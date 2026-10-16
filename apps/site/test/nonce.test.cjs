const test = require('node:test');
const assert = require('node:assert/strict');
const { makeNonce, addNonce } = require('../server/nonce.cjs');

test('makeNonce is unique and base64', () => {
  const nonces = new Set(Array.from({ length: 500 }, makeNonce));
  assert.equal(nonces.size, 500);
  for (const n of nonces) assert.match(n, /^[A-Za-z0-9+/]{22}==$/);
});

const RENDERED =
  '<link rel="preload" href="/_expo/static/js/a.js" as="script"/><link rel="stylesheet" href="/_expo/static/a.css"/>' +
  '<style data-x>a{}</style><script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>' +
  '<script src="/_expo/static/js/a.js" defer></script><script id="_R_">boot()</script>';

test('addNonce marks what the renderer emits', () => {
  const out = addNonce(RENDERED, 'N');
  assert.equal((out.match(/<script nonce="N"/g) ?? []).length, 3);
  assert.equal((out.match(/<style nonce="N"/g) ?? []).length, 1);
  assert.equal((out.match(/<link nonce="N" rel="preload"/g) ?? []).length, 1);
  assert.doesNotMatch(out, /<link nonce="N" rel="stylesheet"/);
  assert.equal(addNonce(out, 'N2'), out, 'a second pass changes nothing');
});

test('markup an injection could add never receives the nonce', () => {
  const attacks = [
    '<script src="https://attacker.example/a.js"></script>',
    '<script src="//attacker.example/a.js"></script>',
    '<script>alert(1)</script>',
    '<script src="/uploads/a.js"></script>',
    '<script src="/_expo/static/../../x.js" type="text/plain"></script>',
    '<link rel="preload" href="https://attacker.example/a.js" as="script"/>',
    '<SCRIPT>alert(1)</SCRIPT>',
  ];
  for (const attack of attacks) {
    const out = addNonce(`${RENDERED}${attack}`, 'N');
    assert.ok(out.endsWith(attack), `unchanged: ${attack}`);
  }
});

test('only the first inline bootstrap and the first inline module flag are trusted', () => {
  const out = addNonce(
    '<script id="_R_">a()</script><script id="_R_">evil()</script><script type="module">b</script><script type="module">evil2</script>',
    'N',
  );
  assert.equal(
    out,
    '<script nonce="N" id="_R_">a()</script><script id="_R_">evil()</script><script nonce="N" type="module">b</script><script type="module">evil2</script>',
  );
});

test('a tag that already has a nonce is left alone', () => {
  const html = '<script nonce="OLD" id="_R_">x</script><style nonce="OLD">a{}</style>';
  assert.equal(addNonce(html, 'N'), html);
});
