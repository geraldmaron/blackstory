/**
 * Unit tests for Tier-1/Tier-2 host classification, citation-trail link filtering,
 * SearXNG query breadth, and same-lineage rejection used by corroborate-source.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectTier1TrailLinks, collectTier2TrailLinks } from './citation-trail.ts';
import {
  buildTier1SearxngQuery,
  buildTier2SearxngQuery,
  pickIndependentTier1SearchHit,
  pickIndependentTier2SearchHit,
} from './corroborate-source.ts';
import { extractOutboundLinks, extractUrlsFromText } from './fetch-page.ts';
import {
  hostLineageKey,
  isReputableSecondaryHost,
  isSameLineageHost,
  isTier1Host,
  isWikipediaHost,
  rankTier1Links,
  REPUTABLE_SECONDARY_HOST_SUFFIXES,
} from './tier1-sources.ts';

const HERITAGE_PAGE = `<html><body>
  <p>See also https://www.nps.gov/places/example.htm and planning.dc.gov/maps/example.</p>
  <a href="https://historicsites.dcpreservation.org/items/show/2">related item</a>
  <a href="https://www.loc.gov/item/example/">Library of Congress</a>
  <a href="https://www.nps.gov/nr/travel/wash/dc58.htm">NPS travel itinerary</a>
  <a href="https://historicsites.dcpreservation.org/about">about</a>
  <a href="https://www.hmdb.org/m.asp?m=12345">HMDB marker</a>
  <a href="https://en.wikipedia.org/wiki/Example">Wikipedia</a>
</body></html>`;

test('isTier1Host accepts federal and DC planning hosts', () => {
  assert.equal(isTier1Host('https://www.nps.gov/places/example.htm'), true);
  assert.equal(isTier1Host('https://tile.loc.gov/storage-services/service/ll/llscd/llfr002.pdf'), true);
  assert.equal(isTier1Host('https://planning.dc.gov/page/example'), true);
  assert.equal(isTier1Host('https://www.defense.mil/News/example'), true);
  assert.equal(isTier1Host('https://historicsites.dcpreservation.org/items/show/1'), false);
});

test('isReputableSecondaryHost accepts curated heritage hosts only', () => {
  assert.equal(isReputableSecondaryHost('https://historicsites.dcpreservation.org/items/show/1'), true);
  assert.equal(isReputableSecondaryHost('https://www.hmdb.org/m.asp?m=12345'), true);
  assert.equal(isReputableSecondaryHost('https://digdc.dclibrary.org/islandora/object/pdc%3A123'), true);
  assert.equal(isReputableSecondaryHost('https://www.blackpast.org/african-american-history/example/'), true);
  assert.equal(isReputableSecondaryHost('https://www.nps.gov/places/example.htm'), false);
});

test('isWikipediaHost identifies bridge-only hosts', () => {
  assert.equal(isWikipediaHost('https://en.wikipedia.org/wiki/Example'), true);
  assert.equal(isWikipediaHost('https://www.wikidata.org/wiki/Q123'), true);
  assert.equal(isWikipediaHost('https://www.hmdb.org/m.asp?m=12345'), false);
});

test('isSameLineageHost matches hostname only', () => {
  assert.equal(
    isSameLineageHost(
      'https://historicsites.dcpreservation.org/items/show/1',
      'https://historicsites.dcpreservation.org/about',
    ),
    true,
  );
  assert.equal(
    isSameLineageHost(
      'https://historicsites.dcpreservation.org/items/show/1',
      'https://www.nps.gov/places/example.htm',
    ),
    false,
  );
});

test('extractUrlsFromText finds inline gov URLs', () => {
  const urls = extractUrlsFromText(
    'Primary inventory cites https://www.nps.gov/places/example.htm and planning.dc.gov/page/example.',
  );
  assert.deepEqual(urls, [
    'https://www.nps.gov/places/example.htm',
    'https://planning.dc.gov/page/example',
  ]);
});

test('collectTier1TrailLinks rejects same-lineage heritage links and prefers NPS', () => {
  const baseUrl = 'https://historicsites.dcpreservation.org/items/show/615';
  const links = collectTier1TrailLinks(HERITAGE_PAGE, baseUrl);
  assert.equal(
    links.some((url) => hostLineageKey(url) === hostLineageKey(baseUrl)),
    false,
  );
  assert.equal(links[0], 'https://www.nps.gov/nr/travel/wash/dc58.htm');
  assert.ok(links.includes('https://www.loc.gov/item/example/'));
  assert.ok(links.includes('https://www.nps.gov/places/example.htm'));
  assert.ok(links.includes('https://planning.dc.gov/maps/example'));
  assert.equal(links.some((url) => isReputableSecondaryHost(url)), false);
});

test('collectTier2TrailLinks accepts different curated secondary and rejects same host and wikipedia', () => {
  const baseUrl = 'https://historicsites.dcpreservation.org/items/show/615';
  const links = collectTier2TrailLinks(HERITAGE_PAGE, baseUrl);
  assert.equal(
    links.some((url) => hostLineageKey(url) === hostLineageKey(baseUrl)),
    false,
  );
  assert.equal(links.includes('https://www.hmdb.org/m.asp?m=12345'), true);
  assert.equal(links.some((url) => isWikipediaHost(url)), false);
  assert.equal(links.some((url) => isTier1Host(url)), false);
});

test('collectTier1TrailLinks honors explicit excludeUrls', () => {
  const baseUrl = 'https://historicsites.dcpreservation.org/items/show/615';
  const links = collectTier1TrailLinks(HERITAGE_PAGE, baseUrl, {
    excludeUrls: ['https://www.nps.gov/nr/travel/wash/dc58.htm'],
  });
  assert.equal(links.includes('https://www.nps.gov/nr/travel/wash/dc58.htm'), false);
  assert.equal(links[0], 'https://www.loc.gov/item/example/');
});

test('extractOutboundLinks resolves relative hrefs against base URL', () => {
  const html = '<a href="/items/show/2">next</a>';
  const links = extractOutboundLinks(html, 'https://historicsites.dcpreservation.org/items/show/1');
  assert.deepEqual(links, ['https://historicsites.dcpreservation.org/items/show/2']);
});

test('rankTier1Links orders NPS ahead of generic .gov', () => {
  const ranked = rankTier1Links([
    'https://example.agency.gov/report',
    'https://www.nps.gov/places/example.htm',
    'https://tile.loc.gov/item/example',
  ]);
  assert.equal(ranked[0], 'https://www.nps.gov/places/example.htm');
  assert.equal(ranked[1], 'https://tile.loc.gov/item/example');
});

test('buildTier1SearxngQuery covers broad gov/mil/si.edu plus preferred archive hosts', () => {
  const query = buildTier1SearxngQuery('Benjamin Banneker Memorial');
  assert.match(query, /site:nps\.gov/u);
  assert.match(query, /site:loc\.gov/u);
  assert.match(query, /site:planning\.dc\.gov/u);
  assert.match(query, /site:\.gov/u);
  assert.match(query, /site:\.mil/u);
  assert.match(query, /site:si\.edu/u);
  assert.match(query, /"Benjamin Banneker Memorial"/u);
});

test('buildTier2SearxngQuery covers every curated secondary suffix', () => {
  const query = buildTier2SearxngQuery('Benjamin Banneker Memorial');
  for (const suffix of REPUTABLE_SECONDARY_HOST_SUFFIXES) {
    assert.match(query, new RegExp(`site:${suffix.replace('.', '\\.')}`, 'u'));
  }
});

test('pickIndependentTier1SearchHit prefers NPS over generic .gov and rejects same lineage', () => {
  const primary = 'https://historicsites.dcpreservation.org/items/show/615';
  const hit = pickIndependentTier1SearchHit(
    [
      { url: 'https://example.agency.gov/report' },
      { url: 'https://www.nps.gov/places/example.htm' },
      { url: primary },
    ],
    [primary],
  );
  assert.equal(hit?.url, 'https://www.nps.gov/places/example.htm');
});

test('pickIndependentTier2SearchHit rejects wikipedia and same-lineage secondary hosts', () => {
  const primary = 'https://historicsites.dcpreservation.org/items/show/615';
  assert.equal(
    pickIndependentTier2SearchHit(
      [
        { url: 'https://en.wikipedia.org/wiki/Example' },
        { url: primary },
        { url: 'https://www.hmdb.org/m.asp?m=12345' },
      ],
      [primary],
    )?.url,
    'https://www.hmdb.org/m.asp?m=12345',
  );
  assert.equal(
    pickIndependentTier2SearchHit([{ url: primary }], [primary]),
    undefined,
  );
  assert.equal(
    pickIndependentTier2SearchHit([{ url: 'https://en.wikipedia.org/wiki/Example' }], []),
    undefined,
  );
});
