/**
 * Pins what "the same page" means for dedupe, and — just as importantly — what it does not mean.
 * Each negative case here is a source we would lose if the key were more aggressive.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupeUrlsByPage, urlDedupeKey } from './canonical-key.js';

test('urlDedupeKey collapses spellings that are the same document', () => {
  const key = urlDedupeKey('https://www.nps.gov/Places/Item.htm?a=1');
  // Case in the host, a default port, a fragment, and credentials are all the same page.
  assert.equal(urlDedupeKey('https://WWW.NPS.GOV/Places/Item.htm?a=1'), key);
  assert.equal(urlDedupeKey('https://www.nps.gov:443/Places/Item.htm?a=1'), key);
  assert.equal(urlDedupeKey('https://www.nps.gov/Places/Item.htm?a=1#history'), key);
  assert.equal(urlDedupeKey('https://user:pw@www.nps.gov/Places/Item.htm?a=1'), key);
  assert.equal(urlDedupeKey('https://www.nps.gov./Places/Item.htm?a=1'), key);
  assert.equal(urlDedupeKey('  https://www.nps.gov/Places/Item.htm?a=1  '), key);
});

test('urlDedupeKey ignores tracking parameters and parameter order', () => {
  const plain = urlDedupeKey('https://example.org/page?b=2&a=1');
  assert.equal(urlDedupeKey('https://example.org/page?a=1&b=2'), plain);
  assert.equal(urlDedupeKey('https://example.org/page?a=1&utm_source=x&b=2'), plain);
  assert.equal(urlDedupeKey('https://example.org/page?a=1&b=2&fbclid=abc&gclid=def'), plain);
  assert.equal(urlDedupeKey('https://example.org/page?a=1&b=2&ref=newsletter'), plain);
});

test('urlDedupeKey treats only the root as slash-insensitive', () => {
  assert.equal(urlDedupeKey('https://example.org'), urlDedupeKey('https://example.org/'));
  // A deeper path may genuinely differ, and guessing would cost a real source.
  assert.notEqual(urlDedupeKey('https://example.org/a'), urlDedupeKey('https://example.org/a/'));
});

test('urlDedupeKey keeps distinctions that can carry different content', () => {
  // http and https are not merged: normalizeAuthorityUrl upgrades for intake, this does not.
  assert.notEqual(urlDedupeKey('http://example.org/a'), urlDedupeKey('https://example.org/a'));
  // A non-default port is part of the address.
  assert.notEqual(
    urlDedupeKey('https://example.org:8443/a'),
    urlDedupeKey('https://example.org/a'),
  );
  // Case in the path is not the host's case; many servers are case-sensitive.
  assert.notEqual(urlDedupeKey('https://example.org/A'), urlDedupeKey('https://example.org/a'));
  // A subdomain is a different host, even when one is "www".
  assert.notEqual(urlDedupeKey('https://www.example.org/a'), urlDedupeKey('https://example.org/a'));
});

test('urlDedupeKey refuses anything that is not an http(s) URL', () => {
  assert.equal(urlDedupeKey(''), undefined);
  assert.equal(urlDedupeKey('   '), undefined);
  assert.equal(urlDedupeKey('not a url'), undefined);
  assert.equal(urlDedupeKey('ftp://example.org/a'), undefined);
  assert.equal(urlDedupeKey('javascript:alert(1)'), undefined);
  assert.equal(urlDedupeKey('file:///etc/passwd'), undefined);
  assert.equal(urlDedupeKey('data:text/html,hi'), undefined);
});

test('dedupeUrlsByPage keeps the original strings and the first-seen order', () => {
  const deduped = dedupeUrlsByPage([
    'https://example.org/b',
    'https://EXAMPLE.org/b#top',
    '  https://example.org/b?utm_source=x  ',
    'https://example.org/a',
  ]);
  assert.deepEqual(deduped, ['https://example.org/b', 'https://example.org/a']);
});

test('dedupeUrlsByPage drops blanks and still shows an unparseable entry exactly once', () => {
  const deduped = dedupeUrlsByPage(['', '  ', 'not a url', 'not a url', 'https://example.org/a']);
  assert.deepEqual(deduped, ['not a url', 'https://example.org/a']);
});

test('dedupeUrlsByPage does not merge two different malformed entries', () => {
  const deduped = dedupeUrlsByPage(['not a url', 'also not a url']);
  assert.deepEqual(deduped, ['not a url', 'also not a url']);
});

test('urlDedupeKey treats percent-encoding case as the same octet', () => {
  // %2F and %2f encode one character, so two spellings are one page.
  assert.equal(urlDedupeKey('https://nps.gov/a%2Fb'), urlDedupeKey('https://nps.gov/a%2fb'));
  // The escape is preserved rather than decoded: an encoded slash is not a path separator.
  assert.notEqual(urlDedupeKey('https://nps.gov/a%2Fb'), urlDedupeKey('https://nps.gov/a/b'));
});
