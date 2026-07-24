import {
  pickIndependentTier1SearchHit,
  pickIndependentTier2SearchHit,
  buildTier1SearxngQuery,
  buildTier2SearxngQuery,
} from './corroborate-source.ts';
/**
 * Regression tests for the corroboration-source plausibility guards, each
 * reproducing a live wrong-citation incident found during the 2026-07-20
 * lynching-victims / western-US-history enrichment runs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isPlausibleMatch,
  isUsableLocationLabel,
  looksLikeSettlementArticle,
  sharesNameToken,
  stripDescriptiveLocationClause,
} pickIndependentTier1SearchHit,
  pickIndependentTier2SearchHit,
  buildTier1SearxngQuery,
  buildTier2SearxngQuery,
} from './corroborate-source.ts';

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
  const bio = 'Clinton Greaves (August 12, 1855 – August 18, 1906) was a Buffalo Soldier in the United States Army.';
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
    isPlausibleMatch('Bill Gilmer', BILL_GILMER_CONTEXT, GILMER_TEXAS_TEXT, 'Gilmer, Texas', 'person'),
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
  const context = 'Documented Buffalo Soldier: Medal of Honor recipient for actions in the Indian Wars.';
  assert.equal(isPlausibleMatch('Clinton Greaves', context, greavesText, 'Clinton Greaves', 'person'), true);
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
  assert.equal(stripDescriptiveLocationClause('South Carolina State House, Columbia'), 'South Carolina State House, Columbia');
  assert.equal(stripDescriptiveLocationClause('Gilmer, Texas'), 'Gilmer, Texas');
});

test('isPlausibleMatch does not apply the person-only gates to non-person subjects', () => {
  // A place/organization/event subject legitimately citing a settlement article
  // (e.g. the town it is itself located in) should not be rejected by these guards.
  assert.equal(
    isPlausibleMatch('Colonel Allensworth State Historic Park', undefined, GILMER_TEXAS_TEXT, 'Gilmer, Texas', 'place'),
    true,
  );
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
