/**
 * Every row of the phase 4b redirect table (docs/ui/archive-url-contract.md, 10.4), with its
 * query state: the answer is the `/archive` address, already canonical (so no second hop
 * follows), and never one of the retired addresses. The status (307) and the no-store header are
 * the proxy's and are checked against the running server in the phase's gate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsQueryNormalizationRedirect } from '../runtime-hardening/query-normalization';
import { archiveLensRedirect, legacyArchiveRedirect } from './archive-routing';
import { ARCHIVE_REDIRECTS_ENABLED } from './archive-redirects.mjs';
import { redirectsForNextConfig } from './next-config-redirects.mjs';

const at = (path: string) => new URL(path, 'https://blackstory.app');

const ROWS: readonly (readonly [from: string, to: string])[] = [
  ['/records', '/archive'],
  ['/records/', '/archive'],
  ['/records?page=2', '/archive?page=2'],
  ['/records?kind=people&state=ga', '/archive?kind=people&state=GA'],
  ['/records?q=tulsa+race&sort=name', '/archive?q=tulsa+race&sort=name'],
  ['/records?layout=chronology&era=1950s', '/archive?view=timeline&era=1950s'],
  ['/records?view=timeline', '/archive?view=timeline'],
  ['/records?layout=timeline&page=3', '/archive?view=timeline&page=3'],
  // On the list `view` only ever spelled the timeline: it cannot open the map from here.
  ['/records?view=map&kind=people', '/archive?kind=people'],
  ['/records?periodStart=1920&periodEnd=1880', '/archive?periodStart=1880&periodEnd=1920'],
  ['/records?collection=story:the-count', '/archive?collection=story%3Athe-count'],
  ['/records?selected=rec_1&place=state-ga', '/archive?selected=rec_1&place=state-ga'],
  ['/records?seed=abc123&page=2', '/archive?seed=abc123&page=2'],
  ['/records?zz=1&utm_source=mail&kind=people', '/archive?kind=people'],
  ['/explore', '/archive?view=map'],
  ['/explore?state=GA', '/archive?view=map&state=GA'],
  [
    '/explore?theme=education&floor=b&sort=name',
    '/archive?view=map&sort=name&topic=education&evidence=B',
  ],
  ['/explore?selected=rec_1&lat=33.7&lng=-84.4&zoom=9', '/archive?view=map&selected=rec_1'],
  ['/explore?place=county-13121&sat=1', '/archive?view=map&place=county-13121&sat=1'],
  ['/explore?find=place', '/archive?view=map&find=place'],
  [
    '/explore?q=church&kind=schools&periodStart=1880',
    '/archive?view=map&q=church&kind=schools&periodStart=1880',
  ],
  ['/explore?utm_source=x&junk=1', '/archive?view=map'],
  ['/search', '/archive'],
  ['/search?q=tulsa', '/archive?q=tulsa'],
  ['/search?q=tulsa&kind=all&era=1920s&offset=40', '/archive?q=tulsa&era=1920s'],
  ['/history', '/archive'],
  ['/history?decade=1930', '/archive?era=1930s'],
  ['/collections', '/archive'],
  ['/collections?x=1', '/archive'],
];

test('every retired Archive address answers its /archive address with its query state', () => {
  for (const [from, to] of ROWS) {
    assert.equal(legacyArchiveRedirect(at(from), true), to, from);
  }
});

test('no answer needs a second hop: it is canonical for /archive and is not itself retired', () => {
  for (const [from] of ROWS) {
    const target = at(legacyArchiveRedirect(at(from), true)!);
    assert.equal(needsQueryNormalizationRedirect(target), false, `${from} lands needing a 308`);
    assert.equal(legacyArchiveRedirect(target, true), null, `${from} chains`);
    assert.equal(archiveLensRedirect(target), null, `${from} chains into a lens`);
  }
  // The config rules that land on the Archive land on a canonical address too.
  for (const rule of redirectsForNextConfig()) {
    if (!rule.destination.startsWith('/archive')) continue;
    assert.equal(needsQueryNormalizationRedirect(at(rule.destination)), false, rule.source);
    assert.equal(legacyArchiveRedirect(at(rule.destination), true), null, rule.source);
  }
});

test('the platform handshake keys ride along and nothing else unknown does', () => {
  assert.equal(
    legacyArchiveRedirect(at('/records?kind=people&_vercel_share=tok'), true),
    '/archive?kind=people&_vercel_share=tok',
  );
});

test('endpoints, records and the lens addresses are never redirected', () => {
  for (const path of [
    '/explore/api',
    '/explore/api?state=GA',
    '/search/api?q=x',
    '/locate/api',
    '/atlas/catalog',
    '/law',
    '/law?q=vote',
    '/books',
    '/presidents',
    '/place/some-place',
    '/entity/e1',
    '/archive',
    '/archive?view=map',
    '/',
  ]) {
    assert.equal(legacyArchiveRedirect(at(path), true), null, path);
  }
});

test('switched off, the 4a addresses are left to answer for themselves', () => {
  for (const path of ['/records?kind=people', '/explore?state=GA', '/search?q=x', '/history']) {
    assert.equal(legacyArchiveRedirect(at(path), false), null, path);
  }
  // Its page is deleted; the Archive's lens chips replaced it either way.
  assert.equal(legacyArchiveRedirect(at('/collections'), false), '/archive');
});

test('the switch is on in this phase', () => {
  assert.equal(ARCHIVE_REDIRECTS_ENABLED, true);
});

test('a lens spelled on /archive answers its own address with its own keys', () => {
  assert.equal(archiveLensRedirect(at('/archive?lens=law')), '/law');
  assert.equal(
    archiveLensRedirect(at('/archive?lens=law&q=vote&zz=1&page=2')),
    '/law?page=2&q=vote',
  );
  assert.equal(
    archiveLensRedirect(at('/archive?lens=books&state=GA&view=states')),
    '/books?state=GA',
  );
  assert.equal(archiveLensRedirect(at('/archive?lens=presidents&kind=people')), '/presidents');
  // The inventions lens is a filter on the shared model: one temporary hop onto `kind`, with the
  // reader's other keys kept, so the /archive normalizer never answers it with a 308.
  assert.equal(archiveLensRedirect(at('/archive?lens=inventions')), '/archive?kind=inventions');
  assert.equal(
    archiveLensRedirect(at('/archive?lens=inventions&q=lamp')),
    '/archive?q=lamp&kind=inventions',
  );
  // `/story`, the retelling's trial address, is the front page.
  assert.equal(legacyArchiveRedirect(at('/story')), '/');
  assert.equal(archiveLensRedirect(at('/archive?lens=nope')), null);
  assert.equal(archiveLensRedirect(at('/law?lens=law')), null);
});
