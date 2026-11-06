/**
 * Story collection and decade-range contract: pure codecs, matching, chronology grouping and the
 * cross-view URL handoffs. No catalog, network or rendering.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeQueryString } from '../runtime-hardening/query-normalization';
import { parseExploreSearchParams } from '../map-experience/url-state';
import { EMPTY_RECORDS_QUERY, recordsHref } from '../records/build-records-index';
import { matchesExcept, type CollectionFacts } from '../records/records-matching';
import { parseRecordsQuery, recordsQueryString } from '../records/records-query';
import { buildChronologyPage, chronologyOrder } from './collection-chronology';
import {
  decadesWithinPeriod,
  documentedCoverageLabel,
  matchesPeriod,
  normalizePeriod,
  parsePeriodBound,
  periodIsInvalid,
} from './collection-period';
import {
  discoveryFromRecords,
  discoveryFromSearchParams,
  listHrefFromDiscovery,
  mapHrefFromDiscovery,
  placeArrivalQuery,
  recordArrivalQuery,
} from './discovery-state';
import {
  collectionMemberIds,
  parseCollectionToken,
  resolveStoryCollection,
} from './story-collection';

function fact(id: string, eraBuckets: readonly string[]): CollectionFacts {
  return {
    row: { id, name: id, kind: 'place', mapTone: undefined },
    eraBuckets,
    topicIds: [],
    confidenceTier: 'high',
    statePostal: undefined,
    status: '',
    haystack: id,
    mappable: true,
  };
}

const NONE = { start: '', end: '', includeUndated: false } as const;

describe('decade period codec', () => {
  it('accepts only four-digit decade starts and marks the rest invalid, never empty', () => {
    assert.equal(parsePeriodBound('1880'), '1880');
    assert.equal(parsePeriodBound(' 1000 '), '1000');
    assert.equal(parsePeriodBound('2990'), '2990');
    assert.equal(parsePeriodBound(''), '');
    for (const bad of ['1885', '1880s', '880', '3000', '0990', 'abc', '18 80']) {
      assert.equal(parsePeriodBound(bad), 'invalid', bad);
    }
  });

  it('orders reversed bounds, keeps one-sided ranges and drops a redundant includeUndated', () => {
    assert.deepEqual(normalizePeriod({ start: '1920', end: '1880', includeUndated: '1' }), {
      start: '1880',
      end: '1920',
      includeUndated: true,
    });
    assert.deepEqual(normalizePeriod({ start: '1950' }), {
      start: '1950',
      end: '',
      includeUndated: false,
    });
    assert.equal(normalizePeriod({ includeUndated: '1' }).includeUndated, false);
    assert.equal(periodIsInvalid(normalizePeriod({ start: '1885', end: '1900' })), true);
  });

  it('excludes undated records under a range unless asked, and keeps sparse buckets sparse', () => {
    const range = normalizePeriod({ start: '1880', end: '2000' });
    assert.equal(matchesPeriod(['Undated'], range), false);
    assert.equal(matchesPeriod(['Undated'], { ...range, includeUndated: true }), true);
    assert.equal(matchesPeriod([], NONE), true);
    // 1880s and 2000s are documented; 1900 to 1990 holds nothing and is not invented.
    assert.equal(
      matchesPeriod(['1880s', '2000s'], normalizePeriod({ start: '1900', end: '1990' })),
      false,
    );
    assert.deepEqual(decadesWithinPeriod(['2000s', '1880s'], NONE), [1880, 2000]);
    // An unreadable range matches nothing instead of reading as no range.
    assert.equal(matchesPeriod(['1880s'], normalizePeriod({ start: 'x' })), false);
  });
});

describe('story collection membership', () => {
  it('normalizes tokens to the finite vocabulary', () => {
    assert.equal(parseCollectionToken('story:Dunbar-High'), 'story:dunbar-high');
    assert.equal(parseCollectionToken(''), '');
    assert.equal(parseCollectionToken('missing'), 'missing');
    for (const bad of ['story:', 'story:a b', 'dunbar-high', 'story:../x', 'invalid']) {
      assert.equal(parseCollectionToken(bad), 'invalid', bad);
    }
  });

  it('keeps live-with-zero, unknown and unavailable distinct and counts unresolved links', () => {
    const released = new Set(['a', 'b']);
    const live = resolveStoryCollection(
      { state: 'live', slug: 's', title: 'T', linkedIds: ['a', 'b', 'x', 'x', 'y'] },
      released,
    );
    assert.equal(live.state, 'live');
    if (live.state === 'live') {
      assert.deepEqual(live.memberIds, ['a', 'b']);
      assert.equal(live.unresolvedCount, 2);
      assert.equal(live.href, '/stories/s');
      assert.equal(JSON.stringify(live).includes('"x"'), false, 'unresolved ids are not exposed');
    }
    const zero = resolveStoryCollection(
      { state: 'live', slug: 's', title: 'T', linkedIds: [] },
      released,
    );
    assert.equal(zero.state, 'live');
    assert.equal(collectionMemberIds(zero)?.size, 0);
    const unknown = resolveStoryCollection({ state: 'unknown', slug: 's' }, released);
    const unavailable = resolveStoryCollection({ state: 'unavailable', slug: 's' }, released);
    assert.equal(unknown.state, 'unknown');
    assert.equal(unavailable.state, 'unavailable');
    assert.equal(collectionMemberIds(unknown), undefined);
    assert.equal(collectionMemberIds(unavailable), undefined);
  });

  it('never widens an unresolved named collection to the archive', () => {
    const query = parseRecordsQuery({ collection: 'story:s' });
    const record = fact('a', ['1880s']);
    assert.equal(matchesExcept(record, query, 'none', undefined), false);
    assert.equal(matchesExcept(record, query, 'none', new Set()), false);
    assert.equal(matchesExcept(record, query, 'none', new Set(['a'])), true);
    assert.equal(
      matchesExcept(record, parseRecordsQuery({ collection: 'nonsense' }), 'none', new Set(['a'])),
      false,
    );
    assert.equal(matchesExcept(record, EMPTY_RECORDS_QUERY, 'none'), true);
  });
});

describe('chronology grouping', () => {
  const records = [
    fact('late', ['2000s']),
    fact('both', ['2000s', '1880s']),
    fact('none', ['Undated']),
    fact('early', ['1880s']),
  ];

  it('places each record once under its earliest documented decade, undated last', () => {
    const ordered = chronologyOrder(records, EMPTY_RECORDS_QUERY);
    assert.deepEqual(
      ordered.map((entry) => [entry.facts.row.id, entry.decade]),
      [
        ['both', 1880],
        ['early', 1880],
        ['late', 2000],
        ['none', null],
      ],
    );
    const page = buildChronologyPage(ordered, 0, 100, (facts) => facts.row.id);
    assert.equal(page.coverageLabel, 'Groups by earliest documented decade: 1880s and 2000s.');
    assert.equal(page.coverage.length, 2, 'no continuous 1880 to 2000 span is invented');
    assert.equal(page.undatedCount, 1);
    assert.equal(page.sections.at(-1)?.decade, null);
  });

  it('groups by the earliest decade inside the active period', () => {
    const query = { ...EMPTY_RECORDS_QUERY, periodStart: '1900', periodEnd: '' } as const;
    const inRange = records.filter((record) => matchesExcept(record, query, 'none'));
    assert.deepEqual(inRange.map((record) => record.row.id).sort(), ['both', 'late']);
    const ordered = chronologyOrder(inRange, query);
    assert.deepEqual(
      ordered.map((entry) => entry.decade),
      [2000, 2000],
    );
  });

  it('labels a page that opens partway through a decade', () => {
    const ordered = chronologyOrder(
      [fact('a', ['1880s']), fact('b', ['1880s']), fact('c', ['1890s'])],
      EMPTY_RECORDS_QUERY,
    );
    const page = buildChronologyPage(ordered, 1, 3, (facts) => facts.row.id);
    assert.equal(page.sections[0]?.continued, true);
    assert.equal(page.sections[0]?.total, 2);
    assert.equal(page.sections[0]?.shown, 1);
  });

  it('reports the page each decade, and the undated section, starts on', () => {
    const ordered = chronologyOrder(
      [
        fact('a', ['1880s']),
        fact('b', ['1880s']),
        fact('c', ['1890s']),
        fact('d', ['1890s']),
        fact('e', ['Undated']),
      ],
      EMPTY_RECORDS_QUERY,
    );
    // Two rows per page: 1880s starts on page 1, 1890s on page 2, the undated record on page 3.
    const page = buildChronologyPage(ordered, 0, 2, (facts) => facts.row.id);
    assert.deepEqual(
      page.coverage.map((item) => [item.decade, item.page]),
      [
        [1880, 1],
        [1890, 2],
      ],
    );
    assert.equal(page.undatedPage, 3);
    assert.equal(
      buildChronologyPage(
        chronologyOrder([fact('x', ['1880s'])], EMPTY_RECORDS_QUERY),
        0,
        2,
        (f) => f.row.id,
      ).undatedPage,
      null,
    );
  });
});

describe('cross-view handoffs', () => {
  const query = {
    ...EMPTY_RECORDS_QUERY,
    q: 'school',
    sort: 'era',
    kind: 'place',
    collection: 'story:dunbar',
    periodStart: '1900',
    periodEnd: '1880',
    includeUndated: true,
    layout: 'chronology',
  } as const;

  it('writes one canonical spelling with ordered bounds', () => {
    const qs = new URLSearchParams(recordsQueryString(query));
    assert.equal(qs.get('periodStart'), '1880');
    assert.equal(qs.get('periodEnd'), '1900');
    assert.equal(qs.get('includeUndated'), '1');
    assert.equal(qs.get('layout'), 'chronology');
    assert.equal(recordsHref({ ...EMPTY_RECORDS_QUERY, includeUndated: true }), '/records');
  });

  it('carries collection, range, layout and every other narrowing Records to Map and back', () => {
    const discovery = discoveryFromRecords(
      parseRecordsQuery(Object.fromEntries(new URLSearchParams(recordsQueryString(query)))),
    );
    const mapHref = mapHrefFromDiscovery(discovery);
    const explore = parseExploreSearchParams(
      Object.fromEntries(new URL(mapHref, 'http://x').searchParams),
    );
    assert.equal(explore.collection, 'story:dunbar');
    assert.equal(explore.periodStart, '1880');
    assert.equal(explore.periodEnd, '1900');
    assert.equal(explore.includeUndated, true);
    assert.equal(explore.layout, 'chronology');
    assert.equal(explore.query, 'school');
    assert.equal(explore.sort, 'era');

    const arrival = placeArrivalQuery(discovery, 'list');
    const restored = parseRecordsQuery(
      Object.fromEntries(
        new URL(
          listHrefFromDiscovery(
            discoveryFromSearchParams(Object.fromEntries(new URLSearchParams(arrival))),
          ),
          'http://x',
        ).searchParams,
      ),
    );
    assert.equal(restored.collection, 'story:dunbar');
    assert.equal(restored.layout, 'chronology');
    assert.equal(restored.periodStart, '1880');
    assert.equal(restored.q, 'school');
    assert.notEqual(recordArrivalQuery(Object.fromEntries(new URLSearchParams(arrival))), '');
  });

  it('turns malformed input into finite sentinels at the edge instead of a bare archive', () => {
    assert.equal(
      normalizeQueryString('/records', { collection: 'story:bad slug' }),
      'collection=invalid',
    );
    assert.equal(
      normalizeQueryString('/records', { periodStart: '1885', includeUndated: '1' }),
      'periodStart=invalid&includeUndated=1',
    );
    assert.equal(normalizeQueryString('/records', { includeUndated: '1' }), '');
    assert.equal(
      normalizeQueryString('/records', { collection: 'story:Dunbar', layout: 'chronology' }),
      'collection=story%3Adunbar&layout=chronology',
    );
  });
});

it('reports sparse per-record coverage without inventing the intervening decades', () => {
  assert.equal(documentedCoverageLabel(['1880s', '2000s']), 'Archive buckets: 1880s and 2000s');
  assert.equal(documentedCoverageLabel([]), 'No recorded decade');
});
