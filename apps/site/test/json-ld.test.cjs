const test = require('node:test');
const assert = require('node:assert/strict');
const { jsonLdString } = require('../src/lib/json-ld.js');

const SEPARATORS = String.fromCharCode(0x2028, 0x2029);

test('a value cannot break out of the script element', () => {
  const hostile = {
    name: '</script><script src="//x.example/a.js"></script>',
    note: `<!-- & > ${SEPARATORS}`,
  };
  const out = jsonLdString(hostile);
  for (const char of ['<', '>', '&', ...SEPARATORS])
    assert.equal(out.includes(char), false, `no raw ${char.charCodeAt(0)}`);
  assert.deepEqual(JSON.parse(out), hostile, 'still valid JSON that round-trips');
});

test('ordinary values are unchanged', () => {
  const value = {
    '@context': 'https://schema.org',
    name: 'Methodology',
    n: 3,
    ok: true,
    list: [1, 'a'],
  };
  assert.equal(jsonLdString(value), JSON.stringify(value));
});
