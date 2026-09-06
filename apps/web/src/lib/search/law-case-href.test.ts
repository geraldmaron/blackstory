/**
 * `resolveLawCaseHref` (repo-skocy): the exact-title bridge between the search index's law/case
 * entities and the legal catalog's `/law/{slug}` pages, and the two ways it must fail closed
 * rather than guess a wrong page.
 *
 * Runs over the real seed legal catalog (no DB in this test process, so `loadLegalCatalog` falls
 * back to it) — 'Civil Rights Act of 1964' is a real title/slug pair in `data/legal-seed.ts`.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { resetLawCaseHrefCacheForTests, resolveLawCaseHref } from './law-case-href';

beforeEach(() => {
  resetLawCaseHrefCacheForTests();
});

test('resolves a law result whose title exactly matches a legal-catalog title', async () => {
  const href = await resolveLawCaseHref({
    kind: 'law',
    displayName: 'Civil Rights Act of 1964',
  });
  assert.equal(href, '/law/civil-rights-act-1964');
});

test('matches case-insensitively and trims whitespace, since a real display name is never guaranteed byte-identical', async () => {
  const href = await resolveLawCaseHref({
    kind: 'law',
    displayName: '  civil rights act of 1964  '.trim().toUpperCase(),
  });
  assert.equal(href, '/law/civil-rights-act-1964');
});

test('returns undefined for a kind other than law or case, even on an exact title match', async () => {
  const href = await resolveLawCaseHref({
    kind: 'event',
    displayName: 'Civil Rights Act of 1964',
  });
  assert.equal(href, undefined);
});

test('returns undefined rather than a guess when no legal-catalog entry has this title', async () => {
  const href = await resolveLawCaseHref({
    kind: 'law',
    displayName: 'A Statute This Archive Has Never Published',
  });
  assert.equal(href, undefined);
});
