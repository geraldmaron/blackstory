import assert from 'node:assert/strict';
import test from 'node:test';
import { wikipediaPageAnchored } from './wikipedia-anchor.ts';

test("the record's own linked article is anchored, however the title is encoded", () => {
  assert.ok(
    wikipediaPageAnchored({
      sourceUrl: 'https://en.wikipedia.org/wiki/Seattle_Medium',
      canonicalUrl: 'https://en.wikipedia.org/wiki/Seattle%20Medium',
    }),
  );
});

test('a page found by bare name is not anchored: the pilot namesakes', () => {
  for (const sourceUrl of [
    'https://en.wikipedia.org/wiki/Albert_W._Hicks',
    'https://en.wikipedia.org/wiki/Teresa_of_%C3%81vila',
    'https://en.wikipedia.org/wiki/Gordon_Ramsay',
  ]) {
    assert.equal(wikipediaPageAnchored({ sourceUrl }), false, sourceUrl);
  }
  assert.equal(
    wikipediaPageAnchored({
      sourceUrl: 'https://en.wikipedia.org/wiki/John_Slade_(politician)',
      canonicalUrl: 'https://en.wikipedia.org/wiki/John_Slade_(fraternity_founder)',
    }),
    false,
  );
});

test('a page that agrees with a known place is anchored; an unknown place is not', () => {
  const sourceUrl = 'https://en.wikipedia.org/wiki/Some_Church';
  assert.ok(wikipediaPageAnchored({ sourceUrl, placeKnown: true, placeCorroborated: true }));
  assert.equal(
    wikipediaPageAnchored({ sourceUrl, placeKnown: false, placeCorroborated: true }),
    false,
  );
});

test("a page titled exactly with the record's name is anchored unless a known place contradicts it", () => {
  assert.ok(
    wikipediaPageAnchored({
      sourceUrl: 'https://en.wikipedia.org/wiki/Wormley%27s_Hotel',
      displayName: "Wormley's Hotel (Site)",
    }),
  );
  assert.equal(
    wikipediaPageAnchored({
      sourceUrl: 'https://en.wikipedia.org/wiki/Salem_Baptist_Church',
      displayName: 'Salem Baptist Church',
      placeKnown: true,
      placeCorroborated: false,
    }),
    false,
  );
  assert.equal(
    wikipediaPageAnchored({
      sourceUrl: 'https://en.wikipedia.org/wiki/Michael_Williams_(actor)',
      displayName: 'Michael Williams',
    }),
    false,
  );
});

test('punctuation, dashes and a leading "The" do not break an exact-title match', () => {
  for (const [url, displayName] of [
    [
      'https://en.wikipedia.org/wiki/Harris%E2%80%93Stowe_State_University',
      'Harris-Stowe State University',
    ],
    ['https://en.wikipedia.org/wiki/Johnson_C._Smith_University', 'Johnson C Smith University'],
    [
      'https://en.wikipedia.org/wiki/The_African_American_Museum_in_Cleveland',
      'African American Museum in Cleveland',
    ],
  ] as const) {
    assert.ok(wikipediaPageAnchored({ sourceUrl: url, displayName }), displayName);
  }
});
