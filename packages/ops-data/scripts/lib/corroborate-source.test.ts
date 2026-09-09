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
  isPlausibleMatch,
  isUsableLocationLabel,
  looksLikeSettlementArticle,
  pickIndependentTier1SearchHit,
  pickIndependentTier2SearchHit,
  searchAndFetch,
  SEARXNG_MIN_SPACING_MS,
  sharesNameToken,
  stripDescriptiveLocationClause,
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
  assert.equal(
    isTier1Host('https://tile.loc.gov/storage-services/service/ll/llscd/llfr002.pdf'),
    true,
  );
  assert.equal(isTier1Host('https://planning.dc.gov/page/example'), true);
  assert.equal(isTier1Host('https://www.defense.mil/News/example'), true);
  assert.equal(isTier1Host('https://historicsites.dcpreservation.org/items/show/1'), false);
});

test('isReputableSecondaryHost accepts curated heritage hosts only', () => {
  assert.equal(
    isReputableSecondaryHost('https://historicsites.dcpreservation.org/items/show/1'),
    true,
  );
  assert.equal(isReputableSecondaryHost('https://www.hmdb.org/m.asp?m=12345'), true);
  assert.equal(
    isReputableSecondaryHost('https://digdc.dclibrary.org/islandora/object/pdc%3A123'),
    true,
  );
  assert.equal(
    isReputableSecondaryHost('https://www.blackpast.org/african-american-history/example/'),
    true,
  );
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
  assert.equal(
    links.some((url) => isReputableSecondaryHost(url)),
    false,
  );
});

test('collectTier2TrailLinks accepts different curated secondary and rejects same host and wikipedia', () => {
  const baseUrl = 'https://historicsites.dcpreservation.org/items/show/615';
  const links = collectTier2TrailLinks(HERITAGE_PAGE, baseUrl);
  assert.equal(
    links.some((url) => hostLineageKey(url) === hostLineageKey(baseUrl)),
    false,
  );
  assert.equal(links.includes('https://www.hmdb.org/m.asp?m=12345'), true);
  assert.equal(
    links.some((url) => isWikipediaHost(url)),
    false,
  );
  assert.equal(
    links.some((url) => isTier1Host(url)),
    false,
  );
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
  assert.equal(pickIndependentTier2SearchHit([{ url: primary }], [primary]), undefined);
  assert.equal(
    pickIndependentTier2SearchHit([{ url: 'https://en.wikipedia.org/wiki/Example' }], []),
    undefined,
  );
});

const GILMER_TEXAS_TEXT =
  'Gilmer is a city in and the county seat of Upshur County, Texas, United States. ' +
  "Its population was 4,843 at the 2020 census. Founded in 1846, the city's namesake is " +
  'former Secretary of the Navy Thomas Walker Gilmer. In 1919, Chilton Jennings, a 28-year-old ' +
  'African American man, was lynched in Gilmer’s town square by a mob of about 1,000 White residents.';

const BILL_GILMER_CONTEXT =
  'Documented lynching victim: Lynched March–April 1879 in Memphis, Tennessee (Shelby County) ' +
  'following an accusation of: Shot attorney Thomas J. Wood. Gilmer was accused of shooting Wood, ' +
  'who had whipped Gilmer for using offensive language near his wife.';

test('looksLikeSettlementArticle flags a town article by its own self-description', () => {
  assert.equal(looksLikeSettlementArticle(GILMER_TEXAS_TEXT), true);
});
test('looksLikeSettlementArticle does not flag an ordinary biography', () => {
  const bio =
    'Clinton Greaves (August 12, 1855 – August 18, 1906) was a Buffalo Soldier in the United States Army.';
  assert.equal(looksLikeSettlementArticle(bio), false);
});
test('sharesNameToken rejects a completely unrelated title', () => {
  assert.equal(sharesNameToken('Slab Pitts', 'Tulsa race massacre'), false);
  assert.equal(sharesNameToken('Anna M. Dumas', 'Minnie M. Cox'), false);
});
test('sharesNameToken accepts a title containing a name token (the Gilmer collision case)', () => {
  assert.equal(sharesNameToken('Bill Gilmer', 'Gilmer, Texas'), true);
});
test('isPlausibleMatch rejects a settlement article for a person subject even when it shares a name token', () => {
  // Reproduces the live Bill Gilmer -> Gilmer, Texas incident: "Gilmer" is a shared
  // token, and the town's own unrelated 1919 lynching gives enough generic overlap
  // (county, mob, lynched, African American) to have passed the old context check.
  assert.equal(
    isPlausibleMatch(
      'Bill Gilmer',
      BILL_GILMER_CONTEXT,
      GILMER_TEXAS_TEXT,
      'Gilmer, Texas',
      'person',
    ),
    false,
  );
});
test('isPlausibleMatch rejects a same-topic-but-different-subject article with zero name overlap', () => {
  // Reproduces the live Slab Pitts -> Tulsa race massacre incident.
  const tulsaText =
    'The Tulsa race massacre was a two-day mass racial violence event in 1921 in which a white mob ' +
    'attacked Black residents and burned the Greenwood District, killing an estimated 75 to 300 people.';
  const slabPittsContext =
    'Documented lynching victim: Lynched October 26, 1906 in Toyah, Texas following an accusation of ' +
    'living with a white woman. He was dragged to death and hanged.';
  assert.equal(
    isPlausibleMatch('Slab Pitts', slabPittsContext, tulsaText, 'Tulsa race massacre', 'person'),
    false,
  );
});
test('isPlausibleMatch rejects a passing-mention article even with high context overlap', () => {
  // Reproduces the live Anna M. Dumas -> Minnie M. Cox incident: Minnie Cox's own
  // article happens to mention Dumas's exact facts in passing, so pre-fix context
  // overlap was high even though the article is not about Dumas.
  const minnieCoxText =
    'Minnie M. Cox was the first black postmaster in Mississippi, following closely behind Anna M. Dumas, ' +
    'who was appointed to the same position in 1872 in Covington, Louisiana and served until 1885.';
  const annaDumasContext =
    'Documented Reconstruction officeholder: postmaster of Covington, Louisiana, appointed 1872, served until 1885.';
  assert.equal(
    isPlausibleMatch('Anna M. Dumas', annaDumasContext, minnieCoxText, 'Minnie M. Cox', 'person'),
    false,
  );
});
test('isPlausibleMatch still accepts a genuine match for a person subject', () => {
  const greavesText =
    'Clinton Greaves (August 12, 1855 – August 18, 1906) was a Buffalo Soldier in the United States Army ' +
    'and a recipient of the Medal of Honor for his actions in the Indian Wars.';
  const context =
    'Documented Buffalo Soldier: Medal of Honor recipient for actions in the Indian Wars.';
  assert.equal(
    isPlausibleMatch('Clinton Greaves', context, greavesText, 'Clinton Greaves', 'person'),
    true,
  );
});
test('isUsableLocationLabel rejects bare generic labels', () => {
  assert.equal(isUsableLocationLabel('headquarters'), false);
  assert.equal(isUsableLocationLabel('Site'), false);
});
test('isUsableLocationLabel rejects a scope-qualified generic label (the Alpha Kappa Alpha collision case)', () => {
  // Reproduces the live incident: "International headquarters" is not in the
  // exact generic-labels set, so it passed the old check and a literal search
  // for that phrase matched an unrelated building instead of falling back to
  // Alpha Kappa Alpha's real Chicago, Illinois jurisdiction.
  assert.equal(isUsableLocationLabel('International headquarters'), false);
  assert.equal(isUsableLocationLabel('National office'), false);
  assert.equal(isUsableLocationLabel('Corporate campus'), false);
});
test('isUsableLocationLabel accepts a genuine specific place name', () => {
  assert.equal(isUsableLocationLabel('Moton Field'), true);
  assert.equal(isUsableLocationLabel('South Carolina State House'), true);
  assert.equal(isUsableLocationLabel('Columbia Park and Baker Bowl'), true);
});
test('isUsableLocationLabel rejects descriptive prose written in place of a real place name (the Louis Santop collision case)', () => {
  // Reproduces the live incident: "Place of death and later life residence"
  // was searched literally and matched an unrelated page in Washington state
  // instead of falling back to Louis Santop's real Philadelphia jurisdiction.
  assert.equal(isUsableLocationLabel('Place of death and later life residence'), false);
});
test('stripDescriptiveLocationClause drops a trailing descriptive clause (the Charles Henry Chapman collision case)', () => {
  // Reproduces the live incident: "Cornell University, site of Alpha Phi Alpha
  // founding" failed to resolve coordinates because the whole descriptive
  // phrase was searched literally instead of just "Cornell University".
  assert.equal(
    stripDescriptiveLocationClause('Cornell University, site of Alpha Phi Alpha founding'),
    'Cornell University',
  );
});
test('stripDescriptiveLocationClause keeps a genuine "Place, State/City" qualifier intact', () => {
  assert.equal(
    stripDescriptiveLocationClause('South Carolina State House, Columbia'),
    'South Carolina State House, Columbia',
  );
  assert.equal(stripDescriptiveLocationClause('Gilmer, Texas'), 'Gilmer, Texas');
});
test('isPlausibleMatch does not apply the person-only gates to non-person subjects', () => {
  // A place/organization/event subject legitimately citing a settlement article
  // (e.g. the town it is itself located in) should not be rejected by these guards.
  assert.equal(
    isPlausibleMatch(
      'Colonel Allensworth State Historic Park',
      undefined,
      GILMER_TEXAS_TEXT,
      'Gilmer, Texas',
      'place',
    ),
    true,
  );
});

test('host classification matches domains and subdomains, never lookalikes', () => {
  // The old regexes ran on a parsed hostname and were correct, but unanchored and unprovable.
  // These assertions pin what the replacement actually promises.
  assert.equal(isTier1Host('https://www.nps.gov/foma/index.htm'), true);
  assert.equal(isTier1Host('https://nps.gov/'), true);
  assert.equal(isTier1Host('https://anything.gov/'), true);
  assert.equal(isTier1Host('https://anything.mil/'), true);
  assert.equal(isTier1Host('https://collections.si.edu/x'), true);

  // Lookalikes are not Tier 1.
  assert.equal(isTier1Host('https://nps.gov.attacker.example/'), false);
  assert.equal(isTier1Host('https://evil-nps.gov.example.com/'), false);
  assert.equal(isTier1Host('https://notgov/'), false);
  assert.equal(isTier1Host('https://example.com/?q=nps.gov'), false);
  assert.equal(isTier1Host(undefined), false);
  assert.equal(isTier1Host('not a url'), false);
});

test('wikipedia detection rejects a host that merely contains the domain', () => {
  assert.equal(isWikipediaHost('https://en.wikipedia.org/wiki/X'), true);
  assert.equal(isWikipediaHost('https://www.wikidata.org/wiki/Q1'), true);
  assert.equal(isWikipediaHost('https://wikipedia.org.attacker.example/'), false);
  assert.equal(isWikipediaHost('https://example.com/?ref=wikipedia.org'), false);
});

/**
 * searchAndFetch: the provider call, the result fetch, and the boundary between them.
 *
 * Both network steps are injected, so nothing here touches DNS or the internet. The cases that
 * matter are the failures: this function degrades every one of them to "no corroboration", which is
 * right for an optional enrichment step and dangerous if it happens silently — a whole overnight
 * batch of empty results reads as a corpus with nothing to find.
 */
type WarnCapture = { readonly lines: string[]; restore: () => void };

function captureWarnings(): WarnCapture {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  return { lines, restore: () => (console.warn = original) };
}

const SEARXNG_BASE = 'http://127.0.0.1:8888';

function jsonClient(body: unknown, status = 200) {
  const urls: string[] = [];
  return {
    urls,
    client: async (request: { readonly url: string }) => {
      urls.push(request.url);
      return {
        status,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify(body),
        finalUrl: request.url,
      };
    },
  };
}

/** Serves page text for known URLs; anything else is unreachable, as safe-fetch would report. */
function pageFetcher(pages: Readonly<Record<string, string>>) {
  const requested: string[] = [];
  return {
    requested,
    fetchPage: async (url: string) => {
      requested.push(url);
      const text = pages[url];
      return text === undefined ? undefined : { html: `<html>${text}</html>`, text };
    },
  };
}

const NPS_HIT = 'https://www.nps.gov/places/corroborating-page.htm';
const NPS_TEXT =
  'The Oak Street Meeting Hall operated as a mutual aid society hall in Chicago from 1921, and ' +
  'the congregation preserved its minute books through the 1964 clearances.';

test('searchAndFetch returns a corroborating source when the endpoint answers and the page is fetched', async () => {
  const search = jsonClient({ results: [{ url: NPS_HIT, title: 'Oak Street Meeting Hall' }] });
  const pages = pageFetcher({ [NPS_HIT]: NPS_TEXT });
  const result = await searchAndFetch(
    '"Oak Street Meeting Hall" site:nps.gov',
    SEARXNG_BASE,
    (results) => results[0],
    'search',
    undefined,
    { searchClient: search.client, fetchPage: pages.fetchPage, minSpacingMs: 0 },
  );
  assert.ok(result);
  assert.equal(result.url, NPS_HIT);
  assert.equal(result.title, 'Oak Street Meeting Hall');
  assert.equal(result.method, 'search');
  assert.equal(result.text, NPS_TEXT);
  // The query reaches the provider through the shared URL builder, as JSON.
  assert.equal(search.urls.length, 1);
  assert.match(search.urls[0]!, /^http:\/\/127\.0\.0\.1:8888\/search\?/u);
  assert.match(search.urls[0]!, /format=json/u);
  // The RESULT url goes through the page fetcher, never through the search client.
  assert.deepEqual(pages.requested, [NPS_HIT]);
});

test('searchAndFetch names a non-2xx from the endpoint instead of returning a bare empty result', async () => {
  const warn = captureWarnings();
  try {
    const search = jsonClient({}, 502);
    const pages = pageFetcher({});
    const result = await searchAndFetch(
      'anything',
      SEARXNG_BASE,
      (results) => results[0],
      'search',
      undefined,
      { searchClient: search.client, fetchPage: pages.fetchPage, minSpacingMs: 0 },
    );
    assert.equal(result, undefined);
    assert.equal(pages.requested.length, 0);
    assert.ok(
      warn.lines.some((line) => line.includes('[corroborate-source]') && line.includes('502')),
      `expected a warning naming the status; got ${JSON.stringify(warn.lines)}`,
    );
  } finally {
    warn.restore();
  }
});

test('searchAndFetch names a fail-closed refusal from the client, so a batch cannot silently zero out', async () => {
  const warn = captureWarnings();
  try {
    const pages = pageFetcher({});
    const result = await searchAndFetch(
      'anything',
      SEARXNG_BASE,
      (results) => results[0],
      'search',
      undefined,
      {
        // The shapes the origin-pinned client refuses: an HTML error page, a redirect, an
        // oversized body, a base URL resolving somewhere public.
        searchClient: async () => {
          throw new Error(
            'Operator search endpoint returned content-type "text/html"; expected one of application/json',
          );
        },
        fetchPage: pages.fetchPage,
        minSpacingMs: 0,
      },
    );
    assert.equal(result, undefined);
    assert.ok(
      warn.lines.some(
        (line) => line.includes('[corroborate-source]') && line.includes('text/html'),
      ),
      `expected a warning naming the refusal; got ${JSON.stringify(warn.lines)}`,
    );
  } finally {
    warn.restore();
  }
});

test('searchAndFetch makes exactly one provider call per query, with no retry on failure', async () => {
  const warn = captureWarnings();
  try {
    let calls = 0;
    await searchAndFetch('anything', SEARXNG_BASE, (results) => results[0], 'search', undefined, {
      searchClient: async () => {
        calls += 1;
        throw new Error('engines suspended');
      },
      fetchPage: async () => undefined,
      minSpacingMs: 0,
    });
    // A retry here would fire inside the 4s spacing that exists because concurrent bursts suspend
    // every upstream engine this instance queries.
    assert.equal(calls, 1);
  } finally {
    warn.restore();
  }
});

test('searchAndFetch returns nothing when the picker rejects every result, and says nothing about it', async () => {
  const warn = captureWarnings();
  try {
    const search = jsonClient({ results: [{ url: 'https://en.wikipedia.org/wiki/X' }] });
    const pages = pageFetcher({});
    const result = await searchAndFetch(
      'anything',
      SEARXNG_BASE,
      (results) => pickIndependentTier1SearchHit(results),
      'search',
      undefined,
      { searchClient: search.client, fetchPage: pages.fetchPage, minSpacingMs: 0 },
    );
    assert.equal(result, undefined);
    assert.equal(pages.requested.length, 0);
    // An unusable result set is a normal outcome, not a fault: no warning.
    assert.deepEqual(warn.lines, []);
  } finally {
    warn.restore();
  }
});

test('searchAndFetch drops a hit whose page cannot be fetched', async () => {
  const search = jsonClient({ results: [{ url: NPS_HIT }] });
  const pages = pageFetcher({});
  const result = await searchAndFetch(
    'anything',
    SEARXNG_BASE,
    (results) => results[0],
    'search',
    undefined,
    { searchClient: search.client, fetchPage: pages.fetchPage, minSpacingMs: 0 },
  );
  assert.equal(result, undefined);
  assert.deepEqual(pages.requested, [NPS_HIT]);
});

test('searchAndFetch drops a reachable page that does not mention the subject', async () => {
  const search = jsonClient({ results: [{ url: NPS_HIT }] });
  // A soft-404: 200 with a "page not found" template, which is why reachability is not enough.
  const pages = pageFetcher({ [NPS_HIT]: 'The page you requested could not be located.' });
  const result = await searchAndFetch(
    '"Oak Street Meeting Hall"',
    SEARXNG_BASE,
    (results) => results[0],
    'search',
    'Oak Street Meeting Hall',
    { searchClient: search.client, fetchPage: pages.fetchPage, minSpacingMs: 0 },
  );
  assert.equal(result, undefined);
});

test('searchAndFetch keeps a reachable page that does mention the subject', async () => {
  const search = jsonClient({ results: [{ url: NPS_HIT }] });
  const pages = pageFetcher({ [NPS_HIT]: NPS_TEXT });
  const result = await searchAndFetch(
    '"Oak Street Meeting Hall"',
    SEARXNG_BASE,
    (results) => results[0],
    'search',
    'Oak Street Meeting Hall',
    { searchClient: search.client, fetchPage: pages.fetchPage, minSpacingMs: 0 },
  );
  assert.ok(result);
  assert.equal(result.url, NPS_HIT);
});

test('searchAndFetch reports a malformed response body rather than throwing into the caller', async () => {
  const warn = captureWarnings();
  try {
    const result = await searchAndFetch(
      'anything',
      SEARXNG_BASE,
      (results) => results[0],
      'search',
      undefined,
      {
        searchClient: async (request) => ({
          status: 200,
          headers: { 'content-type': 'application/json' },
          bodyText: 'not json at all',
          finalUrl: request.url,
        }),
        fetchPage: async () => undefined,
        minSpacingMs: 0,
      },
    );
    assert.equal(result, undefined);
    assert.ok(warn.lines.some((line) => line.includes('[corroborate-source]')));
  } finally {
    warn.restore();
  }
});

/*
 * NOT COVERED HERE, and it is a real gap rather than an oversight: the public entry points
 * `findCorroboratingTier1Source` and `findAnySource` both try the Wikipedia API before the search
 * path, and that call is a bare `fetch` with no seam. A test driving either of them makes a live
 * external request, so the search path is covered through `searchAndFetch` directly instead. The
 * two tier helpers above it are one-line wrappers that pass the dependency bag through.
 */
test('the real inter-query spacing is four seconds and queries are serialized', async () => {
  // Worth paying the real gap once. The spacing is the only thing stopping a concurrent batch from
  // suspending every upstream engine, and a test that always overrode it would let the default be
  // lowered to nothing without a single failure.
  assert.equal(SEARXNG_MIN_SPACING_MS, 4_000);

  const order: string[] = [];
  const started: number[] = [];
  const runOne = (label: string) =>
    searchAndFetch(label, SEARXNG_BASE, (results) => results[0], 'search', undefined, {
      searchClient: async (request) => {
        started.push(Date.now());
        order.push(label);
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          bodyText: JSON.stringify({ results: [] }),
          finalUrl: request.url,
        };
      },
      fetchPage: async () => undefined,
    });

  const begin = Date.now();
  await Promise.all([runOne('first'), runOne('second')]);
  // Two concurrent callers, one queue: the second query waits out the full gap behind the first.
  assert.deepEqual(order, ['first', 'second']);
  assert.ok(
    started[1]! - started[0]! >= SEARXNG_MIN_SPACING_MS - 50,
    `second query started ${started[1]! - started[0]!}ms after the first`,
  );
  assert.ok(Date.now() - begin >= SEARXNG_MIN_SPACING_MS - 50);
});
