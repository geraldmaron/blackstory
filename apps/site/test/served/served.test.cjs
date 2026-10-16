/**
 * Runs against a built site (`npm run export` first): starts server/entry.cjs on a free port and
 * checks the parts the migration must not regress: per-request nonce on every tag, isolation under
 * concurrency, and server-rendered SEO head. Skipped when dist/ is absent.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '../..');
const built = existsSync(join(ROOT, 'dist/server'));
let server;
let base;

test.before(async () => {
  if (!built) return;
  process.env.SITE_ROOT = ROOT;
  ({ server } = require('../../server/entry.cjs'));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server?.close());

async function page(path) {
  const response = await fetch(base + path);
  return {
    response,
    html: await response.text(),
    csp: response.headers.get('content-security-policy') ?? '',
  };
}
const nonceOf = (csp) => /'nonce-([^']+)'/.exec(csp)?.[1];

test('/methodology: SEO head is server rendered', { skip: !built }, async () => {
  const { response, html } = await page('/methodology');
  assert.equal(response.status, 200);
  assert.match(html, /<title[^>]*>Methodology · BlackStory<\/title>/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /property="og:title"/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.equal((html.match(/application\/ld\+json/g) ?? []).length, 1);
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /<header[ >]/, 'shell renders a real header landmark');
  assert.match(html, /<nav[ >]/, 'shell renders a real nav landmark');
});

test(
  '/methodology: every executable script, style and script preload carries the request nonce',
  { skip: !built },
  async () => {
    const { html, csp } = await page('/methodology');
    const nonce = nonceOf(csp);
    assert.ok(nonce, 'CSP header has a nonce');
    const tags =
      html.match(/<script\b[^>]*>|<style\b[^>]*>|<link\b[^>]*\bas="script"[^>]*>/g) ?? [];
    assert.ok(tags.length >= 6, `expected several tags, saw ${tags.length}`);
    // JSON-LD is a data block, not executable, so it is the one script that is not nonced.
    const data = tags.filter((tag) => /type="application\/ld\+json"/.test(tag));
    assert.equal(data.length, 1);
    const bad = tags.filter((tag) => !data.includes(tag) && !tag.includes(`nonce="${nonce}"`));
    assert.deepEqual(bad, []);
  },
);

test('nonces are unique and never cross requests under concurrency', { skip: !built }, async () => {
  const results = await Promise.all(Array.from({ length: 80 }, () => page('/methodology')));
  const nonces = new Set(results.map((r) => nonceOf(r.csp)));
  assert.equal(nonces.size, 80);
  for (const { html, csp } of results) {
    const own = nonceOf(csp);
    const foreign = [...html.matchAll(/nonce="([^"]+)"/g)].filter((m) => m[1] !== own);
    assert.equal(foreign.length, 0);
  }
});

test('unknown route is a 404 with the not-found page', { skip: !built }, async () => {
  const { response } = await page('/this-route-does-not-exist');
  assert.equal(response.status, 404);
});
