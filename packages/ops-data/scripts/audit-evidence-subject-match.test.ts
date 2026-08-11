/**
 * repo-pjob / repo-nlcq — the token rules behind the mis-attachment audit.
 *
 * These rules have been wrong twice in ways that looked right in aggregate, so the cases below are
 * the real documents that exposed each mistake rather than synthetic fixtures. Both wrong versions
 * are represented, because both are the obvious thing to reach for.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countWholeWord,
  distinctiveTokens,
  normalizeForSearch,
  placeWordsOf,
  titleCarriesWholeName,
  titleNamesSubject,
} from './audit-evidence-subject-match.ts';

describe('countWholeWord', () => {
  it('does not match a token inside a longer word', () => {
    // The measured failure: "quarters" scored 45 hits inside an article about Frankfurt, all of
    // them head-QUARTERS, which was enough to clear the old presence test.
    const hay = ` ${normalizeForSearch('the seat of many corporate headquarters')} `;
    assert.equal(countWholeWord(hay, 'quarters'), 0);
  });

  it('counts adjacent repeats separately', () => {
    const hay = ` ${normalizeForSearch('Hogan Hogan and Hogan')} `;
    assert.equal(countWholeWord(hay, 'hogan'), 3);
  });
});

describe('distinctiveTokens', () => {
  it('drops structural nouns that match almost any historical document', () => {
    assert.deepEqual(distinctiveTokens('Hosanna Church and Cemetery'), ['hosanna']);
  });

  it('drops the racial descriptors that appear in most names in this lane', () => {
    // "colored" and "school" identify nothing here; every third entity is a colored school.
    assert.deepEqual(distinctiveTokens('Abbeville Colored School'), ['abbeville']);
  });
});

describe('placeWordsOf (repo-nlcq)', () => {
  it('collects every word of city, county and state', () => {
    const words = placeWordsOf({ city: 'Yanceyville', county: 'Caswell', state: 'North Carolina' });
    assert.equal(words.has('caswell'), true);
    assert.equal(words.has('north'), true);
    assert.equal(words.has('carolina'), true);
  });

  it('tolerates missing fields', () => {
    assert.equal(
      placeWordsOf({ city: null, county: null, state: 'Virginia' }).has('virginia'),
      true,
    );
  });
});

describe('titleNamesSubject with place words removed (repo-nlcq)', () => {
  /**
   * The class that defeated BOTH layers. The entity is named after the county it sits in, so
   * subject-identity.ts strips "caswell" as carrying no independent identity — leaving one token,
   * too few for its co-occurrence rule — while this audit used to clear the document because its
   * title contains that same discarded word.
   */
  const caswell = { city: 'Yanceyville', county: 'Caswell', state: 'North Carolina' };

  it('cleared the county article before the fix, when the place word counted', () => {
    const tokens = distinctiveTokens('Caswell County Training School');
    assert.equal(titleNamesSubject('Caswell County, North Carolina', tokens), true);
  });

  it('rejects it once the row’s own place words are removed', () => {
    const tokens = distinctiveTokens('Caswell County Training School').filter(
      (token) => !placeWordsOf(caswell).has(token),
    );
    assert.deepEqual(tokens, ['training']);
    assert.equal(titleNamesSubject('Caswell County, North Carolina', tokens), false);
  });
});

describe('titleCarriesWholeName (repo-nlcq false positive)', () => {
  /**
   * Removing place words alone over-corrected: a name that is ENTIRELY its place plus generic
   * words has nothing left to test with, and "Abbeville Colored School" was flagged against a
   * document titled "Abbeville Colored School" — as right as a document can be.
   */
  it('accepts a title that carries the entity’s whole name', () => {
    assert.equal(
      titleCarriesWholeName('Abbeville Colored School', 'Abbeville Colored School'),
      true,
    );
  });

  it('is order-insensitive, because roster names are inverted for filing', () => {
    assert.equal(titleCarriesWholeName('George Jude House', 'Jude, George, House'), true);
  });

  it('does not accept a county article for a school named after that county', () => {
    assert.equal(
      titleCarriesWholeName('Caswell County, North Carolina', 'Caswell County Training School'),
      false,
    );
  });

  it('requires every name word, not merely an overlap', () => {
    assert.equal(
      titleCarriesWholeName('Abbeville, Mississippi', 'Abbeville Colored School'),
      false,
    );
  });

  it('treats a null title as no evidence', () => {
    assert.equal(titleCarriesWholeName(null, 'Anything At All'), false);
  });
});
