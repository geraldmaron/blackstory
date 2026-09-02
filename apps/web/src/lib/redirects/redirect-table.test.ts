/**
 * Guarantees over the redirect table as data, not as config source text.
 *
 * The load-bearing one is the chain test: a rule whose destination is itself the source of
 * another rule costs a reader two round trips and splits a crawler's link equity, and it is
 * invisible in review because each rule reads correctly on its own.
 *
 * Assertions use full URLs with params, because every real chain in this table was introduced by
 * a rule that looked right against a bare path.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { mapHistoryQueryToRecordsHref, decadeParamToEra } from './history-href';
import { redirectsForNextConfig } from './next-config-redirects.mjs';
import { THEME_CHAPTER_SLUGS } from './theme-alias-table.mjs';
import { mapSearchQueryToRecordsHref } from '../search/search-href';

const RULES = redirectsForNextConfig();

/** Strip Next's `:param` and `:path*` segments so a pattern can be compared to a literal path. */
function patternPrefix(source: string): string {
  const cut = source.indexOf('/:');
  return cut === -1 ? source : source.slice(0, cut);
}

/** The path part of a destination, without the query string a transform route would add. */
function destinationPath(destination: string): string {
  const [path] = destination.split('?');
  return path ?? destination;
}

/** True when `path` is matched by `source`, treating `/:path*` as a prefix wildcard. */
function matches(source: string, path: string): boolean {
  if (source.endsWith('/:path*')) {
    const prefix = patternPrefix(source);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  if (source.includes('/:')) {
    const prefix = patternPrefix(source);
    return path.startsWith(`${prefix}/`) && path.slice(prefix.length + 1).length > 0;
  }
  return source === path;
}

/** Walk the table the way Next does — first match wins — and follow until nothing matches. */
function resolve(path: string): { readonly final: string; readonly hops: number } {
  let current = path;
  let hops = 0;
  while (hops < 10) {
    const rule = RULES.find((entry) => matches(entry.source, current));
    if (!rule) break;
    hops += 1;
    current = destinationPath(rule.destination).replace(/\/:slug$/, `/${current.split('/').pop()}`);
  }
  return { final: current, hops };
}

test('no redirect destination is itself the source of another rule', () => {
  for (const rule of RULES) {
    const target = destinationPath(rule.destination);
    const chained = RULES.find((other) => other !== rule && matches(other.source, target));
    assert.equal(
      chained,
      undefined,
      `${rule.source} -> ${rule.destination} chains into ${chained?.source} -> ${chained?.destination}`,
    );
  }
});

test('every config rule is permanent, so no fold is re-litigated on the next request', () => {
  for (const rule of RULES) {
    assert.equal(rule.permanent, true, `${rule.source} must be permanent`);
  }
});

test('specific rules precede the catch-all for their family', () => {
  function indexOfSource(source: string): number {
    return RULES.findIndex((rule) => rule.source === source);
  }

  assert.ok(
    indexOfSource('/chapters/mosaic-credits') < indexOfSource('/chapters/:slug'),
    'the mosaic-credits rule must win over the /chapters slug rule',
  );
  for (const themeId of Object.keys(THEME_CHAPTER_SLUGS)) {
    assert.ok(
      indexOfSource(`/themes/${themeId}`) < indexOfSource('/themes/:path*'),
      `the ${themeId} alias must win over the /themes catch-all`,
    );
    assert.ok(
      indexOfSource(`/themes/${themeId}/:path*`) < indexOfSource('/themes/:path*'),
      `the ${themeId} descendant alias must win over the /themes catch-all`,
    );
  }
});

test('theme aliases are generated from the chapter slug table, not retyped', () => {
  for (const [themeId, slug] of Object.entries(THEME_CHAPTER_SLUGS)) {
    const bare = RULES.find((rule) => rule.source === `/themes/${themeId}`);
    const nested = RULES.find((rule) => rule.source === `/themes/${themeId}/:path*`);
    assert.equal(bare?.destination, `/stories/${slug}`);
    assert.equal(nested?.destination, `/stories/${slug}`);
  }
});

test('every folded path reaches its surface in exactly one hop', () => {
  const oneHop = [
    ['/facts', '/records'],
    ['/facts/anything', '/records'],
    ['/facts/deeply/nested/path', '/records'],
    ['/articles', '/stories'],
    ['/articles/buying-a-home', '/stories/buying-a-home'],
    ['/chapters', '/stories'],
    ['/chapters/buying-a-home', '/stories/buying-a-home'],
    ['/chapters/mosaic-credits', '/stories/mosaic-credits'],
    ['/themes', '/stories'],
    ['/themes/redlining', '/stories/buying-a-home'],
    ['/themes/redlining/sources', '/stories/buying-a-home'],
    ['/themes/wealth_gap', '/stories/the-gap-that-never-closed'],
    ['/themes/unknown-theme', '/stories'],
    ['/topics', '/stories'],
    ['/topics/anything', '/stories'],
    ['/myths', '/methodology'],
    ['/myths/anything', '/methodology'],
    ['/legal', '/law'],
    ['/map', '/explore'],
  ] as const;

  for (const [from, to] of oneHop) {
    const { final, hops } = resolve(from);
    assert.equal(final, to, `${from} should resolve to ${to}`);
    assert.equal(hops, 1, `${from} should take exactly one hop, took ${hops}`);
  }
});

test('/legal keeps its slug rather than dumping every statute on the index', () => {
  const rule = RULES.find((entry) => entry.source === '/legal/:path*');
  assert.equal(rule?.destination, '/law/:path*');
});

test('/map lands on the Atlas instrument; /explore renders it', () => {
  const map = RULES.find((entry) => entry.source === '/map');
  const explore = RULES.find((entry) => entry.source === '/explore');
  assert.ok(map, '/map must have a config rule');
  assert.equal(map?.destination, '/explore');
  assert.equal(map?.permanent, true);
  assert.equal(explore, undefined, '/explore is the instrument, not a redirect');
});

test('the /explore rule is the exact path, so /explore/api keeps answering', () => {
  // A `/explore/:path*` rule would swallow the Atlas's own refine endpoint, whose entire
  // contract is its query string.
  for (const rule of RULES) {
    assert.ok(!rule.source.startsWith('/explore/'), `${rule.source} would capture /explore/api`);
  }
  assert.equal(
    RULES.some((rule) => matches(rule.source, '/explore/api')),
    false,
    '/explore/api must not match any redirect rule',
  );
});

test('the dev routes manifest never folds /explore into /', () => {
  const manifestPath = fileURLToPath(
    new URL('../../../../.next/dev/routes-manifest.json', import.meta.url),
  );
  if (!existsSync(manifestPath)) {
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    redirects?: readonly { source: string; destination: string }[];
  };
  const bad = manifest.redirects?.find(
    (rule) => rule.source === '/explore' && rule.destination === '/',
  );
  assert.equal(
    bad,
    undefined,
    'stale .next/dev/routes-manifest.json still redirects /explore → /; delete it and restart dev',
  );
});

test('/search reaches /records in one hop, with its params', () => {
  assert.equal(mapSearchQueryToRecordsHref({ q: 'tulsa' }), '/records?q=tulsa');
  assert.equal(
    mapSearchQueryToRecordsHref({ q: 'tulsa', kind: 'place', status: 'historic', era: '1920s' }),
    '/records?q=tulsa&kind=place&status=historic&era=1920s',
  );
  assert.equal(mapSearchQueryToRecordsHref({ topic: 'redlining' }), '/records?topic=redlining');
  // `all` is the no-constraint sentinel; carrying it through would render an active chip.
  assert.equal(mapSearchQueryToRecordsHref({ kind: 'all', status: 'all' }), '/records');
  // /search remaps history-only kind categories onto the five-family vocabulary.
  assert.equal(mapSearchQueryToRecordsHref({ kind: 'law' }), '/records?kind=sources');
  assert.equal(mapSearchQueryToRecordsHref({ kind: 'works' }), '/records?kind=sources');
  // /records pages with `?page=N`; an offset has no honest landing point on that contract.
  assert.equal(mapSearchQueryToRecordsHref({ q: 'a', offset: '20' }), '/records?q=a');
  assert.equal(mapSearchQueryToRecordsHref({ q: '  spaced  ' }), '/records?q=spaced');

  // The destination must not itself be a redirect source, or the "one hop" claim is false.
  const chained = RULES.find((rule) => matches(rule.source, '/records'));
  assert.equal(chained, undefined, '/records must not be a redirect source');
});

test('/history maps decade to era and reaches /records in one hop', () => {
  assert.equal(mapHistoryQueryToRecordsHref({ decade: '1930' }), '/records?era=1930s');
  assert.equal(mapHistoryQueryToRecordsHref({ decade: '1930s' }), '/records?era=1930s');
  assert.equal(
    mapHistoryQueryToRecordsHref({ decade: '1930', q: 'tulsa', kind: 'place' }),
    '/records?q=tulsa&kind=place&era=1930s',
  );
  assert.equal(mapHistoryQueryToRecordsHref({ kind: 'law' }), '/records?kind=sources');
  assert.equal(mapHistoryQueryToRecordsHref({ kind: 'works' }), '/records?kind=sources');
  assert.equal(mapHistoryQueryToRecordsHref({}), '/records');
  assert.equal(mapHistoryQueryToRecordsHref({ decade: 'all' }), '/records');
  // An explicit era is already in the destination vocabulary and outranks a derived one.
  assert.equal(
    mapHistoryQueryToRecordsHref({ decade: '1930', era: '1960s' }),
    '/records?era=1960s',
  );

  const chained = RULES.find((rule) => matches(rule.source, '/history'));
  assert.equal(chained, undefined, '/history must have no config rule — it transforms a value');
});

test('decadeParamToEra rejects anything that is not a decade boundary', () => {
  assert.equal(decadeParamToEra('1930'), '1930s');
  assert.equal(decadeParamToEra('1930s'), '1930s');
  assert.equal(decadeParamToEra('1937'), undefined);
  assert.equal(decadeParamToEra('19300'), undefined);
  assert.equal(decadeParamToEra('nineteen-thirties'), undefined);
  assert.equal(decadeParamToEra(''), undefined);
  assert.equal(decadeParamToEra(undefined), undefined);
});
