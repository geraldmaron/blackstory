/**
 * The shared Archive filter model (`RecordsQuery`) and its two translations to and from the map's
 * view state. Phase 4a's contract (`docs/ui/archive-url-contract.md`): a filter set on one view
 * arrives intact on the other, and no camera or device location is ever serialized.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMPTY_RECORDS_QUERY,
  isRecordsCombinationQuery,
  parseRecordsQuery,
  recordsHref,
  type RecordsQuery,
} from '../records/records-query';
import { buildAtlasHref } from '../records/build-records-index';
import { parseExploreSearchParams, buildExploreHref } from '../map-experience/url-state';
import { normalizeQueryString } from '../runtime-hardening/query-normalization';
import {
  exploreHrefFromRecordsQuery,
  exploreViewFromRecordsQuery,
  recordsQueryFromExplore,
} from './explore-collection';
import { membershipSentence } from './continuity-label';

const params = (href: string) => Object.fromEntries(new URL(href, 'https://x.test').searchParams);
/** What survives the edge on a path, as the page would receive it. */
const atEdge = (href: string) =>
  normalizeQueryString(new URL(href, 'https://x.test').pathname, params(href));

/** The combinations the phase's live round-trip check walks, here as pure data. */
const SETS: readonly (readonly [string, Partial<RecordsQuery>])[] = [
  ['a query with a typo', { q: 'churhc' }],
  ['a decade range', { periodStart: '1880', periodEnd: '1920' }],
  ['a state plus a kind', { state: 'GA', kind: 'people' }],
  ['an empty result', { q: 'zzzzqqq', state: 'WY', evidence: 'A' }],
  ['topic, evidence and sort', { topic: 'education', evidence: 'B', sort: 'name' }],
  ['an era bucket and a status', { era: '1950s', status: 'historic' }],
  ['a range that keeps undated', { periodStart: '1900', includeUndated: true, sort: 'era' }],
  ['an exact kind and the timeline', { kind: 'school', layout: 'chronology' }],
  ['a selected record and place', { state: 'GA', selected: 'rec_1', place: 'city-ga-atlanta' }],
  [
    'everything at once',
    {
      q: 'school',
      kind: 'places',
      era: '1920s',
      state: 'OK',
      topic: 'education',
      status: 'historic',
      evidence: 'C',
      periodStart: '1900',
      periodEnd: '1940',
      sort: 'evidence',
    },
  ],
];

describe('shared archive filters', () => {
  for (const [name, set] of SETS) {
    it(`round-trips list to map to list: ${name}`, () => {
      const query: RecordsQuery = { ...EMPTY_RECORDS_QUERY, ...set };
      const mapHref = exploreHrefFromRecordsQuery(query);
      // Through the edge allowlist too: a key the map's edge strips would silently widen the set.
      const onMap = parseExploreSearchParams(
        Object.fromEntries(new URLSearchParams(atEdge(mapHref))),
      );
      assert.deepEqual(recordsQueryFromExplore(onMap), query);
      const listHref = recordsHref(recordsQueryFromExplore(onMap));
      assert.equal(listHref, recordsHref(query));
      assert.deepEqual(
        parseRecordsQuery(Object.fromEntries(new URLSearchParams(atEdge(listHref)))),
        query,
      );
      // And map to list to map.
      assert.equal(
        buildExploreHref(exploreViewFromRecordsQuery(recordsQueryFromExplore(onMap))),
        mapHref,
      );
    });
  }

  it('the list hand-off is the same converter', () => {
    const query = { ...EMPTY_RECORDS_QUERY, topic: 'education', evidence: 'B' };
    assert.equal(buildAtlasHref(query), '/explore?theme=education&floor=B');
  });

  it('page and seed stay with the list; the map never receives them', () => {
    const href = exploreHrefFromRecordsQuery({
      ...EMPTY_RECORDS_QUERY,
      kind: 'people',
      page: 3,
      seed: 'abc',
    });
    assert.equal(href, '/explore?kind=people');
  });

  it('never serializes a camera or a device location', () => {
    const onMap = parseExploreSearchParams({ state: 'GA', lat: '33.7', lng: '-84.4', zoom: '9' });
    const listHref = recordsHref(recordsQueryFromExplore(onMap));
    assert.equal(listHref, '/records?state=GA');
    assert.equal(atEdge('/explore?state=GA&lat=33.7&lng=-84.4&zoom=9'), 'state=GA');
    assert.equal(atEdge('/records?state=GA&lat=33.7&lng=-84.4&zoom=9&near=Atlanta'), 'state=GA');
    for (const [, set] of SETS) {
      const href = exploreHrefFromRecordsQuery({ ...EMPTY_RECORDS_QUERY, ...set });
      assert.doesNotMatch(href, /[?&](lat|lng|zoom|near|radius)=/);
    }
  });

  it('the map and the list read one value the same way', () => {
    // One parser: what the list lowercases or drops, the map does too.
    assert.equal(parseExploreSearchParams({ kind: 'People', state: 'ga' }).filters.kind, 'people');
    assert.equal(parseExploreSearchParams({ state: 'ga' }).state, 'GA');
    assert.equal(parseExploreSearchParams({ theme: 'not-a-topic' }).filters.theme, 'all');
    assert.equal(parseExploreSearchParams({ floor: 'b' }).floor, 'B');
    assert.equal(parseExploreSearchParams({ periodStart: '18' }).periodStart, 'invalid');
  });

  it('a map selection riding on the list is never an indexable page', () => {
    assert.equal(isRecordsCombinationQuery({ ...EMPTY_RECORDS_QUERY, selected: 'rec_1' }), true);
    assert.equal(isRecordsCombinationQuery({ ...EMPTY_RECORDS_QUERY, place: 'state-ga' }), true);
    assert.equal(parseRecordsQuery({ place: 'somewhere else' }).place, '');
    assert.equal(parseRecordsQuery({ selected: 'bad id!' }).selected, '');
  });
});

describe('membership sentence', () => {
  it('says how many the map can show and why the rest are absent', () => {
    assert.equal(
      membershipSentence({ view: 'map', matched: 480, mapped: 312 }),
      '312 of 480 records have a point on the map. The other 168 have no public point and are in the list only.',
    );
    assert.equal(
      membershipSentence({ view: 'map', matched: 12, mapped: 12 }),
      'All 12 records here have a point on the map.',
    );
    assert.equal(
      membershipSentence({ view: 'list', matched: 21, mapped: 20 }),
      '20 of 21 have a point on the map.',
    );
  });

  it('counts records without a date where the view sets them apart or leaves them out', () => {
    assert.equal(
      membershipSentence({ view: 'timeline', matched: 100, mapped: 100, undated: 41 }),
      'All 100 have a point on the map. 41 have no recorded decade and sit under Undated.',
    );
    assert.equal(
      membershipSentence({ view: 'map', matched: 5, mapped: 5, undatedExcluded: 1 }),
      'All 5 records here have a point on the map. 1 more has no recorded decade and is left out of this decade range.',
    );
    // The list does not set undated records apart, so it does not count them.
    assert.equal(
      membershipSentence({ view: 'list', matched: 3, mapped: 3, undated: 2 }),
      'All 3 have a point on the map.',
    );
  });

  it('is plain about nothing matching and about a place the list ignores', () => {
    assert.equal(
      membershipSentence({ view: 'list', matched: 0, mapped: 0 }),
      'No records match these filters.',
    );
    assert.equal(
      membershipSentence({ view: 'list', matched: 2, mapped: 1, placeCarried: true }),
      '1 of 2 has a point on the map. This list is not narrowed to the place selected on the map.',
    );
  });
});
