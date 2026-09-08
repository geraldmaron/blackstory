/**
 * `/stories` index logic: notice states, query parsing, href building, filtering, search,
 * sorting, pagination and the rail groups.
 *
 * Two behaviors here are load-bearing and easy to regress silently. The unavailable
 * (load failure) state and the none-published state must read differently: one is a fault
 * on our side, the other an honest statement that the release has nothing here yet.
 * Collapsing them would tell a reader whose connection to the live record failed that the
 * archive is simply empty. And sorting must be total — every comparator falls through to
 * slug — because a collection whose order changes between identical requests reads as
 * broken even when its contents are right.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCollectionGroups,
  buildCollectionShelves,
  buildEraGroups,
  buildKindChips,
  buildPlaceGroups,
  buildTagGroups,
  computeStoriesFacts,
  filterItems,
  hasActiveNarrowing,
  nextInCollection,
  paginateStories,
  parseStoriesQuery,
  pickLeadStory,
  showsShelves,
  sortItems,
  storiesHref,
  storiesNotice,
  uncollectedItems,
} from './stories-index';
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';

function item(overrides: Partial<PublicArticleListItemDoc>): PublicArticleListItemDoc {
  return {
    id: overrides.id ?? 'a1',
    releaseId: 'rel-1',
    slug: overrides.slug ?? 'a-chapter',
    kind: overrides.kind ?? 'chapter',
    title: overrides.title ?? 'A chapter',
    summary: overrides.summary ?? 'A summary long enough to pass validation.',
    publishedAt: overrides.publishedAt ?? '2020-01-01',
    eraLabel: overrides.eraLabel ?? 'Redlining',
    placeLabel: overrides.placeLabel ?? 'Tulsa, Oklahoma',
    tags: overrides.tags ?? [],
    ...overrides,
  };
}

const EMPTY = parseStoriesQuery({});

describe('/stories · the two notice states differ', () => {
  it('unavailable and none-published render different titles and bodies', () => {
    const unavailable = storiesNotice('unavailable', 0, 0);
    const nonePublished = storiesNotice('live', 0, 0);
    assert.notEqual(unavailable.title, nonePublished.title);
    assert.notEqual(unavailable.body, nonePublished.body);
    assert.match(unavailable.body, /check back/i);
    assert.match(nonePublished.body, /published yet/i);
  });

  it('the filtered-empty state names the total so the reader can widen back out', () => {
    const notice = storiesNotice('live', 12, 0);
    assert.match(notice.body, /12/);
  });

  it('is silent when there are results to show', () => {
    assert.equal(storiesNotice('live', 5, 5).body, '');
  });
});

describe('/stories · query parsing', () => {
  it('collapses unrecognized values to all Stories rather than throwing, since bookmarks reach here', () => {
    const query = parseStoriesQuery({ kind: 'nonsense', sort: 'sideways', page: 'abc' });
    assert.equal(query.kind, '');
    assert.equal(query.sort, 'collection');
    assert.equal(query.page, 1);
  });

  it('bare /stories means every published Story, not chapters only', () => {
    // The route is named `/stories`. Defaulting to `chapter` hid every Entry from a reader who
    // did not know to append `kind=all`, while the page's own copy promised they would not have
    // to know which editorial contract an answer was written under.
    assert.equal(parseStoriesQuery({}).kind, '');
  });

  it('accepts the real kinds and sorts', () => {
    assert.equal(parseStoriesQuery({ kind: 'article' }).kind, 'article');
    assert.equal(parseStoriesQuery({ sort: 'title' }).sort, 'title');
  });

  it('still accepts kind=all, because it is a published URL', () => {
    assert.equal(parseStoriesQuery({ kind: 'all' }).kind, '');
    assert.equal(parseStoriesQuery({ kind: '' }).kind, '');
  });

  it('takes the first value when a param repeats', () => {
    assert.equal(
      parseStoriesQuery({ collection: ['presidents', 'other'] }).collection,
      'presidents',
    );
  });
});

describe('/stories · href building', () => {
  it('omits page=1 and the default sort, matching the records convention', () => {
    assert.equal(storiesHref({}), '/stories');
    assert.equal(storiesHref({ page: 1, sort: 'collection' }), '/stories');
  });

  it('carries real narrowing into the query string', () => {
    assert.equal(storiesHref({ collection: 'presidents' }), '/stories?collection=presidents');
    assert.equal(storiesHref({ kind: 'article', page: 3 }), '/stories?kind=article&page=3');
  });

  it('never generates kind=all: the default kind is every Story and stays out of the URL', () => {
    assert.equal(storiesHref({ kind: '' }), '/stories');
    assert.equal(storiesHref({ kind: 'chapter' }), '/stories?kind=chapter');
    assert.equal(storiesHref({ kind: 'article' }), '/stories?kind=article');
  });
});

describe('/stories · filtering and search', () => {
  const items = [
    item({ id: 'c1', slug: 'buying-a-home', kind: 'chapter', title: 'Buying a Home' }),
    item({
      id: 'p16',
      slug: 'abraham-lincoln',
      kind: 'article',
      title: 'Abraham Lincoln',
      tags: ['Civil War and Reconstruction'],
      series: { id: 'presidents', label: 'Presidential records', position: 16 },
    }),
    item({
      id: 'p40',
      slug: 'ronald-reagan',
      kind: 'article',
      title: 'Ronald Reagan',
      tags: ['Modern era'],
      series: { id: 'presidents', label: 'Presidential records', position: 40 },
    }),
  ];

  // EMPTY now defaults to kind: 'chapter'; these cases exercise collection/tag/search
  // filtering on its own, across both kinds, so they start from the explicit "All" kind instead.
  const ALL = { ...EMPTY, kind: '' };

  it('the default view is every kind, not chapters only', () => {
    const rows = filterItems(items, EMPTY);
    assert.deepEqual(
      rows.map((row) => row.id),
      ['c1', 'p16', 'p40'],
    );
  });

  it('filters by kind', () => {
    const rows = filterItems(items, { ...EMPTY, kind: 'article' });
    assert.deepEqual(
      rows.map((row) => row.id),
      ['p16', 'p40'],
    );
  });

  it('the explicit "All" kind returns every kind', () => {
    assert.equal(filterItems(items, ALL).length, 3);
  });

  it('filters by collection', () => {
    assert.equal(filterItems(items, { ...ALL, collection: 'presidents' }).length, 2);
    assert.equal(filterItems(items, { ...ALL, collection: 'nope' }).length, 0);
  });

  it('filters by tag', () => {
    const rows = filterItems(items, { ...ALL, tag: 'Modern era' });
    assert.deepEqual(
      rows.map((row) => row.id),
      ['p40'],
    );
  });

  it('searches case-insensitively across title, series and tags', () => {
    assert.equal(filterItems(items, { ...ALL, q: 'lincoln' })[0]?.id, 'p16');
    assert.equal(filterItems(items, { ...ALL, q: 'PRESIDENTIAL' }).length, 2);
    assert.equal(filterItems(items, { ...ALL, q: 'nothing here' }).length, 0);
  });

  it('reports when any narrowing is engaged, so the clear affordance can show', () => {
    assert.equal(hasActiveNarrowing(EMPTY), false);
    assert.equal(hasActiveNarrowing({ ...EMPTY, q: 'x' }), true);
    assert.equal(hasActiveNarrowing({ ...EMPTY, collection: 'presidents' }), true);
    assert.equal(hasActiveNarrowing({ ...EMPTY, kind: 'article' }), true);
    assert.equal(hasActiveNarrowing({ ...EMPTY, kind: 'chapter' }), true);
    // ALL is the default view now, so it is not a narrowing.
    assert.equal(hasActiveNarrowing(ALL), false);
  });
});

describe('/stories · sorting', () => {
  const unordered = [
    item({ id: 'b', slug: 'b', title: 'Beta', publishedAt: '2021-01-01' }),
    item({
      id: 'p40',
      slug: 'reagan',
      title: 'Reagan',
      publishedAt: '2019-01-01',
      series: { id: 'presidents', label: 'Presidential records', position: 40 },
    }),
    item({
      id: 'p16',
      slug: 'lincoln',
      title: 'Lincoln',
      publishedAt: '2022-01-01',
      series: { id: 'presidents', label: 'Presidential records', position: 16 },
    }),
    item({ id: 'a', slug: 'a', title: 'Alpha', publishedAt: '2020-01-01' }),
  ];

  it('sorts a collection by its own position, not by publication date', () => {
    const rows = sortItems(unordered, 'collection');
    assert.deepEqual(
      rows.slice(0, 2).map((row) => row.id),
      ['p16', 'p40'],
    );
  });

  it('keeps non-collection entries behind the collection, newest first', () => {
    const rows = sortItems(unordered, 'collection');
    assert.deepEqual(
      rows.slice(2).map((row) => row.id),
      ['b', 'a'],
    );
  });

  it('sorts by title and by date when asked', () => {
    assert.equal(sortItems(unordered, 'title')[0]?.title, 'Alpha');
    assert.equal(sortItems(unordered, 'newest')[0]?.publishedAt, '2022-01-01');
    assert.equal(sortItems(unordered, 'oldest')[0]?.publishedAt, '2019-01-01');
  });

  it('is total: entries tied on the visible key never swap between identical calls', () => {
    const tied = [
      item({ id: 'x', slug: 'zulu', title: 'Same', publishedAt: '2020-01-01' }),
      item({ id: 'y', slug: 'alpha', title: 'Same', publishedAt: '2020-01-01' }),
    ];
    const first = sortItems(tied, 'title').map((row) => row.slug);
    const second = sortItems([...tied].reverse(), 'title').map((row) => row.slug);
    assert.deepEqual(first, second);
    assert.deepEqual(first, ['alpha', 'zulu']);
  });

  it('does not mutate the array it was given', () => {
    const original = [...unordered];
    sortItems(unordered, 'title');
    assert.deepEqual(unordered, original);
  });
});

describe('/stories · rail groups and chips', () => {
  const items = [
    item({ id: 'c1', slug: 'c1', kind: 'chapter', eraLabel: '1911–present', placeLabel: 'US' }),
    item({
      id: 'p1',
      slug: 'p1',
      kind: 'article',
      eraLabel: '1789–1797',
      placeLabel: 'US',
      tags: ['Founding era'],
      series: { id: 'presidents', label: 'Presidential records', position: 1 },
    }),
  ];

  it('counts each kind, and drops a chip with no entries behind it', () => {
    const chips = buildKindChips(items, EMPTY);
    assert.deepEqual(
      chips.map((chip) => [chip.label, chip.count]),
      [
        ['All', 2],
        ['Chapters', 1],
        ['Entries', 1],
      ],
    );
    // EMPTY is the All view, so All is the engaged chip.
    assert.equal(chips[0]?.active, true);
    assert.equal(chips[1]?.active, false);
  });

  it('marks the engaged chip as current for assistive technology', () => {
    const chips = buildKindChips(items, { ...EMPTY, kind: 'article' });
    assert.equal(chips.find((chip) => chip.label === 'Entries')?.active, true);
    assert.equal(chips.find((chip) => chip.label === 'All')?.active, false);
  });

  it('builds collection, era, tag and place groups that link back into the index across both kinds', () => {
    // These rail links carry no kind at all now: the default view is every kind, so a grouping
    // that is entirely `article` (like "Presidential records") resolves correctly without an
    // override. They used to need an explicit `kind=all`.
    assert.deepEqual(buildCollectionGroups(items), [
      { label: 'Presidential records', href: '/stories?collection=presidents', count: 1 },
    ]);
    assert.deepEqual(buildTagGroups(items), [
      { label: 'Founding era', href: '/stories?tag=Founding+era', count: 1 },
    ]);
    assert.equal(buildEraGroups(items).length, 2);
    assert.deepEqual(buildPlaceGroups(items), [
      { label: 'US', href: '/stories?place=US', count: 2 },
    ]);
  });
});

describe('/stories · shelves', () => {
  const chapter1 = item({
    id: 'p1',
    slug: 'p1',
    kind: 'chapter',
    publishedAt: '2020-01-01',
    series: { id: 'presidents', label: 'Presidential records', position: 1 },
  });
  const chapter2 = item({
    id: 'p2',
    slug: 'p2',
    kind: 'chapter',
    publishedAt: '2021-01-01',
    series: { id: 'presidents', label: 'Presidential records', position: 2 },
  });
  const uncollected = item({ id: 'u1', slug: 'u1', kind: 'chapter', publishedAt: '2024-01-01' });
  const items = [chapter1, chapter2, uncollected];

  it('groups members by collection in the collection order, largest shelf first', () => {
    const shelves = buildCollectionShelves(items);
    assert.deepEqual(
      shelves.map((shelf) => [shelf.id, shelf.label, shelf.count]),
      [['presidents', 'Presidential records', 2]],
    );
    assert.deepEqual(
      shelves[0]?.members.map((member) => member.slug),
      ['p1', 'p2'],
    );
  });

  it('uncollected items are exactly the ones with no collection', () => {
    assert.deepEqual(
      uncollectedItems(items).map((entry) => entry.slug),
      ['u1'],
    );
  });

  it('the lead story is the most recent Chapter, not merely the most recent item', () => {
    // Straight newest-first made the flagship of the whole publication whichever short Entry
    // happened to be published last. A Chapter is the deep narrative form and leads when one
    // exists; `u1` is newer here but is not a chapter.
    const newerEntry = item({
      id: 'e9',
      slug: 'lincoln',
      kind: 'article',
      publishedAt: '2026-01-01',
    });
    const entryOnly = [
      item({ id: 'e1', slug: 'e1', kind: 'article', publishedAt: '2024-01-01' }),
      item({ id: 'e2', slug: 'e2', kind: 'article', publishedAt: '2025-01-01' }),
    ];
    // `u1` is the newest chapter in `items`; `lincoln` is newer still but is an Entry.
    assert.equal(pickLeadStory([...items, newerEntry])?.slug, 'u1');
    // With no chapter in view — a reader narrowed to Entries — the newest item leads.
    assert.equal(pickLeadStory(entryOnly)?.slug, 'e2');
    assert.equal(pickLeadStory([]), undefined);
  });

  it('shelves show in the unnarrowed, collection-sorted browse state, for any kind chip', () => {
    assert.equal(showsShelves(EMPTY), true);
    assert.equal(showsShelves({ ...EMPTY, q: 'lincoln' }), false);
    assert.equal(showsShelves({ ...EMPTY, sort: 'newest' }), false);
    // The kind chip alone must not gate shelf mode: a collection can be entirely `article`
    // (the presidents), so tying shelves to the chapters-only default meant its shelf could
    // never render under any chip a reader could actually reach.
    assert.equal(showsShelves({ ...EMPTY, kind: 'article' }), true);
    assert.equal(showsShelves({ ...EMPTY, kind: '' }), true);
  });
});

describe('/stories · shelves, the uncollected remainder and collection navigation', () => {
  const items = [
    item({ id: 'c1', slug: 'lone-chapter', kind: 'chapter' }),
    item({
      id: 'p1',
      slug: 'washington',
      kind: 'article',
      title: 'President: George Washington',
      series: { id: 'presidents', label: 'Presidential records', position: 1 },
    }),
    item({
      id: 'p2',
      slug: 'adams',
      kind: 'article',
      title: 'President: John Adams',
      series: { id: 'presidents', label: 'Presidential records', position: 2 },
    }),
    item({
      id: 'p3',
      slug: 'jefferson',
      kind: 'article',
      title: 'President: Thomas Jefferson',
      series: { id: 'presidents', label: 'Presidential records', position: 3 },
    }),
  ];

  it('builds one shelf per collection, largest first, each carrying its own members in order', () => {
    const shelves = buildCollectionShelves(items, 2);
    assert.deepEqual(
      shelves.map((shelf) => [shelf.id, shelf.count, shelf.members.map((m) => m.slug)]),
      [['presidents', 3, ['washington', 'adams']]],
    );
    assert.equal(shelves[0]?.href, '/stories?collection=presidents');
  });

  it('the uncollected list is everything with no collection, and nothing else', () => {
    assert.deepEqual(
      uncollectedItems(items).map((i) => i.slug),
      ['lone-chapter'],
    );
  });

  it('finds the next member of a collection after the given position', () => {
    const next = nextInCollection(items, 'presidents', 1);
    assert.equal(next?.slug, 'adams');
  });

  it('skips past a gap in position numbers to the next real member', () => {
    const next = nextInCollection(items, 'presidents', 0);
    assert.equal(next?.slug, 'washington');
  });

  it('returns undefined at the end of a collection', () => {
    assert.equal(nextInCollection(items, 'presidents', 3), undefined);
  });

  it('returns undefined for a collection that does not exist', () => {
    assert.equal(nextInCollection(items, 'nonexistent', 0), undefined);
  });
});

describe('/stories · facts and pagination', () => {
  it('summarizes the published count, year span and place count', () => {
    const facts = computeStoriesFacts([
      item({ id: '1', slug: '1', publishedAt: '2019-01-01', placeLabel: 'A' }),
      item({ id: '2', slug: '2', publishedAt: '2024-01-01', placeLabel: 'B' }),
    ]);
    assert.equal(facts.publishedCount, 2);
    assert.equal(facts.eraSpanLabel, '2019 to 2024');
    assert.equal(facts.placeCount, 2);
  });

  it('never emits page=1 in the previous link, and clamps an out-of-range page', () => {
    // Sized off the shared page constant so this never re-breaks if /records retunes it.
    const many = Array.from({ length: RECORDS_PAGE_SIZE * 2 + 1 }, (_, index) =>
      item({ id: `i${index}`, slug: `i${index}` }),
    );
    const page2 = paginateStories(many, { ...EMPTY, page: 2 });
    assert.equal(page2.previousHref, '/stories');
    assert.match(String(page2.nextHref), /page=3/);

    const beyond = paginateStories(many, { ...EMPTY, page: 999 });
    assert.equal(beyond.page, beyond.pageCount);
    assert.equal(beyond.nextHref, undefined);
  });

  it('carries active narrowing through the pager links', () => {
    const many = Array.from({ length: RECORDS_PAGE_SIZE * 2 + 1 }, (_, index) =>
      item({ id: `i${index}`, slug: `i${index}`, kind: 'article' }),
    );
    const page2 = paginateStories(many, { ...EMPTY, kind: 'article', page: 2 });
    assert.match(String(page2.nextHref), /kind=article/);
  });
});
