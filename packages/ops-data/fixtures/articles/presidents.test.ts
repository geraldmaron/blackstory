/**
 * Content pins for "The presidents on the record".
 *
 * The series indexes PEOPLE, numbered by first presidency, not presidencies. Two people
 * have held non-consecutive presidencies: Cleveland (22nd and 24th) and Trump (45th and
 * 47th). Each gets one entry, at 22 and 45, and 24 and 47 stay vacant, because
 * `series.position` is the collection's ordering key and has to be unique
 * (gateSeriesPositions in ../../scripts/articles.ts, and articles_series_position_unique
 * on bb_reference.articles). Cleveland was authored that way from the start; Trump was
 * not, and the gap went live and stayed live for a year (repo-z8x8).
 *
 * These tests pin what that gap actually broke, not the shape of the fixture:
 *
 *   1. Two published sentences said Cleveland was the *only* president elected to
 *      non-consecutive terms and the *one* president counted twice. Both were true when
 *      written on 2026-08-07 and false from January 20, 2025, which is the trap a series
 *      that indexes people sets for itself: a superlative about the indexing is a fact
 *      about the world, and the world adds presidents.
 *   2. An entry covering two presidencies has to say so on its face, in both `eraLabel`
 *      and `series.positionLabel`. An entry labeled "45th president / 2017–2021" that
 *      carries 2025 call-outs is a record entry disagreeing with its own header.
 *
 * The tests derive the two-presidency set from `eraLabel` rather than hard-coding
 * Cleveland and Trump, so a third non-consecutive presidency added later is held to the
 * same rules instead of slipping past a name check.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presidentArticles } from './presidents.ts';

/** An `eraLabel` listing more than one date range is the mark of a two-presidency entry. */
function termRanges(eraLabel: string): readonly string[] {
  return eraLabel.split(',').map((range) => range.trim());
}

type PresidentArticle = (typeof presidentArticles)[number];

/**
 * Call-out bullets across an entry. `items` is optional on the body-block union (only
 * `list` blocks carry it), so this reads it defensively rather than narrowing on `type`.
 */
function calloutItems(article: PresidentArticle): readonly string[] {
  return article.body.flatMap((block) =>
    block.type === 'list' ? [...((block as { items?: readonly string[] }).items ?? [])] : [],
  );
}

const multiTermEntries = presidentArticles.filter(
  (article) => termRanges(article.eraLabel).length > 1,
);

test('series position is unique, so one person never claims two slots', () => {
  const positions = presidentArticles.map((article) => article.series.position);
  assert.equal(new Set(positions).size, positions.length);

  const slugs = presidentArticles.map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('a person who served non-consecutive terms holds one entry, and the later slot stays vacant', () => {
  const claimed = new Set(presidentArticles.map((article) => article.series.position));
  assert.ok(multiTermEntries.length >= 2, 'Cleveland and Trump both serve two presidencies');

  for (const article of multiTermEntries) {
    // The entry sits at the first presidency's number and names both ordinals, so the
    // later presidency's number is deliberately unclaimed rather than merely missing.
    const ordinals = [...article.series.positionLabel.matchAll(/(\d+)(?:st|nd|rd|th)\b/g)].map(
      (match) => Number(match[1]),
    );
    assert.equal(
      ordinals.length,
      termRanges(article.eraLabel).length,
      `${article.slug}: positionLabel "${article.series.positionLabel}" names ${ordinals.length} ordinals for ${termRanges(article.eraLabel).length} terms`,
    );
    assert.equal(ordinals[0], article.series.position);
    for (const later of ordinals.slice(1)) {
      assert.ok(later > article.series.position);
      assert.ok(!claimed.has(later), `series position ${later} must stay vacant`);
    }
  }

  assert.deepEqual(
    multiTermEntries.map((article) => [article.slug, article.series.positionLabel]),
    [
      ['grover-cleveland', '22nd and 24th president'],
      ['donald-trump', '45th and 47th president'],
    ],
  );
});

test('no entry claims sole possession of non-consecutive terms', () => {
  const prose = presidentArticles.flatMap((article) => [
    article.summary,
    ...article.body.flatMap((block) => (block.type === 'paragraph' ? [block.text] : [])),
    ...calloutItems(article),
  ]);
  for (const text of prose) {
    assert.doesNotMatch(text, /only president elected to non-consecutive/i);
    assert.doesNotMatch(text, /(?:the one|only) president counted twice/i);
  }
});

test("Trump's entry covers the 2025 presidency, not just 2017-2021", () => {
  const trump = presidentArticles.find((article) => article.slug === 'donald-trump');
  assert.ok(trump);
  assert.equal(trump.eraLabel, '2017–2021, 2025–');

  const secondTerm = calloutItems(trump).filter((item) => /\b202[5-9]\b/.test(item));
  assert.ok(
    secondTerm.length >= 5,
    `expected the second term to carry its own call-outs, found ${secondTerm.length}`,
  );
  // Every call-out ships with its receipt; gateCalloutCitations enforces it on apply, and
  // a second-term bullet added by hand here would be the one to forget.
  for (const item of secondTerm) assert.match(item, /\[ref:[a-z0-9-]+\]/);

  // The revocation of Executive Order 11246 is the single act in the second term that most
  // directly undoes an entry earlier in this same series (Johnson, 1965); it is what the
  // entry would be wrong to omit.
  assert.ok(secondTerm.some((item) => item.includes('Executive Order 11246')));
});
