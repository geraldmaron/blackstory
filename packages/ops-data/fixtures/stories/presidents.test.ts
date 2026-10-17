/**
 * The collection indexes people by first presidency, not individual terms. Non-consecutive
 * presidencies share one unique position; era and position labels must disclose both terms.
 * Tests reject outdated exclusivity claims and derive the multi-term set from the fixture
 * labels.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presidentStories } from './presidents.ts';

/** An `eraLabel` listing more than one date range is the mark of a two-presidency entry. */
function termRanges(eraLabel: string): readonly string[] {
  return eraLabel.split(',').map((range) => range.trim());
}

type PresidentStory = (typeof presidentStories)[number];

/**
 * Call-out bullets across an entry. `items` is optional on the body-block union (only
 * `list` blocks carry it), so this reads it defensively rather than narrowing on `type`.
 */
function calloutItems(story: PresidentStory): readonly string[] {
  return story.body.flatMap((block) =>
    block.type === 'list' ? [...((block as { items?: readonly string[] }).items ?? [])] : [],
  );
}

const multiTermEntries = presidentStories.filter((story) => termRanges(story.eraLabel).length > 1);

test('collection position is unique, so one person never claims two slots', () => {
  const positions = presidentStories.map((story) => story.collection.position);
  assert.equal(new Set(positions).size, positions.length);

  const slugs = presidentStories.map((story) => story.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('a person who served non-consecutive terms holds one entry, and the later slot stays vacant', () => {
  const claimed = new Set(presidentStories.map((story) => story.collection.position));
  assert.ok(multiTermEntries.length >= 2, 'Cleveland and Trump both serve two presidencies');

  for (const story of multiTermEntries) {
    // The entry sits at the first presidency's number and names both ordinals, so the
    // later presidency's number is deliberately unclaimed rather than merely missing.
    const ordinals = [...story.collection.positionLabel.matchAll(/(\d+)(?:st|nd|rd|th)\b/g)].map(
      (match) => Number(match[1]),
    );
    assert.equal(
      ordinals.length,
      termRanges(story.eraLabel).length,
      `${story.slug}: positionLabel "${story.collection.positionLabel}" names ${ordinals.length} ordinals for ${termRanges(story.eraLabel).length} terms`,
    );
    assert.equal(ordinals[0], story.collection.position);
    for (const later of ordinals.slice(1)) {
      assert.ok(later > story.collection.position);
      assert.ok(!claimed.has(later), `collection position ${later} must stay vacant`);
    }
  }

  assert.deepEqual(
    multiTermEntries.map((story) => [story.slug, story.collection.positionLabel]),
    [
      ['grover-cleveland', '22nd and 24th president'],
      ['donald-trump', '45th and 47th president'],
    ],
  );
});

test('no entry claims sole possession of non-consecutive terms', () => {
  const prose = presidentStories.flatMap((story) => [
    story.summary,
    ...story.body.flatMap((block) => (block.type === 'paragraph' ? [block.text] : [])),
    ...calloutItems(story),
  ]);
  for (const text of prose) {
    assert.doesNotMatch(text, /only president elected to non-consecutive/i);
    assert.doesNotMatch(text, /(?:the one|only) president counted twice/i);
  }
});

test("Trump's entry covers the 2025 presidency, not just 2017-2021", () => {
  const trump = presidentStories.find((story) => story.slug === 'donald-trump');
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
  // directly undoes an entry earlier in this same collection (Johnson, 1965); it is what the
  // entry would be wrong to omit.
  assert.ok(secondTerm.some((item) => item.includes('Executive Order 11246')));
});
