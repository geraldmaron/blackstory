/**
 * Regression tests for the corroboration-source plausibility guards, each
 * reproducing a live wrong-citation incident found during the 2026-07-20
 * lynching-victims / western-US-history enrichment runs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlausibleMatch, looksLikeSettlementArticle, sharesNameToken } from './corroborate-source.ts';

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

test('isPlausibleMatch does not apply the person-only gates to non-person subjects', () => {
  // A place/organization/event subject legitimately citing a settlement article
  // (e.g. the town it is itself located in) should not be rejected by these guards.
  assert.equal(
    isPlausibleMatch('Colonel Allensworth State Historic Park', undefined, GILMER_TEXAS_TEXT, 'Gilmer, Texas', 'place'),
    true,
  );
});
