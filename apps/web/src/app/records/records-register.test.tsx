/**
 * The Records register: every facet value is reachable from its menu as a link with its count,
 * menus read in their own order, the sort follows the search, the search echo and the matching
 * snippet are server HTML, and the empty state says what was searched.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import {
  EMPTY_RECORDS_QUERY,
  buildRecordsIndex,
  type RecordsFacet,
  type RecordsIndex as RecordsIndexModel,
  type RecordsQuery,
  type RecordsRow,
} from '../../lib/records/build-records-index';
import { RecordsIndexPage } from './RecordsIndex';

void React;

function facet(prefix: string, ids: readonly string[]): RecordsFacet[] {
  return ids.map((id, index) => ({
    id,
    label: `${prefix} ${id}`,
    count: 100 - index,
    href: `/archive?${prefix.toLowerCase()}=${id}`,
    nofollow: false,
  }));
}

const STATES = ['VA', 'DC', 'NC', 'SC', 'GA', 'AL', 'MS', 'LA', 'TX', 'FL', 'TN', 'KY'];

const ROW: RecordsRow = {
  id: 'r1',
  href: '/place/first-church--r1?from=list',
  name: 'First Church',
  place: 'Savannah, Georgia',
  era: '1770s',
  kindFamily: 'places',
  kind: 'place',
  mapTone: undefined,
  grade: 'A',
  gradeDescription: 'Evidence grade A',
  confidenceTier: 'high',
  summary: 'A congregation organized in 1773 that built the oldest church of its kind in Georgia.',
  sourceCount: 3,
};

function render(query: Partial<RecordsQuery> = {}, overrides: Partial<RecordsIndexModel> = {}) {
  const fullQuery = { ...EMPTY_RECORDS_QUERY, ...query };
  const model = {
    ...buildRecordsIndex([], fullQuery),
    query: fullQuery,
    rows: [ROW],
    totalAll: 1200,
    totalMatched: 1,
    page: 1,
    pageCount: 1,
    countLabel: '1,200 records',
    facets: {
      kind: facet('Kind', ['places', 'people', 'events']),
      era: facet('Era', ['1950s', '1770s', '1880s']),
      state: facet('State', STATES),
      topic: [],
      status: [],
      evidence: [],
    },
    notice: undefined,
    ...overrides,
  } as unknown as RecordsIndexModel;
  // The decade jump reads the router; a static render has none mounted.
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={{} as never}>
      <RecordsIndexPage model={model} />
    </AppRouterContext.Provider>,
  );
}

function menu(markup: string, key: string): string {
  const match = new RegExp(`<div[^>]*id="records-menu-${key}"[\\s\\S]*?</ul>`).exec(markup);
  assert.ok(match, `menu ${key} renders`);
  return match[0];
}

describe('Records register', () => {
  it('a long facet lists every value as a GET link with its count, none dropped', () => {
    const markup = render();
    const state = menu(markup, 'state');
    assert.match(state, /popover="auto"/);
    assert.equal([...state.matchAll(/href="\/archive\?state=/g)].length, STATES.length);
    assert.match(state, /State KY<\/span><span class="ds-records-menu__count">89</);
    // States read by name, decades in time order, not by count.
    const labels = [...state.matchAll(/State ([A-Z]{2})</g)].map((match) => match[1]);
    assert.deepEqual(labels, [...STATES].sort());
    const eras = [...menu(markup, 'era').matchAll(/Era (\d{4}s)</g)].map((match) => match[1]);
    assert.deepEqual(eras, ['1770s', '1880s', '1950s']);
    // A facet with nothing to offer keeps its button; its menu says why it is empty.
    assert.match(menu(markup, 'topic').replace(/<ul[\s\S]*/, ''), /No topic to narrow by here\./);
  });

  it('every menu is opened by its button without JavaScript', () => {
    const markup = render();
    for (const key of ['kind', 'era', 'state', 'sort']) {
      assert.match(
        markup,
        new RegExp(`popoverTarget="records-menu-${key}"|popovertarget="records-menu-${key}"`, 'i'),
      );
    }
    assert.match(markup, /popovertarget="records-filters"/i);
  });

  it('sorts by earliest with no search and by best match with one', () => {
    const plain = menu(render(), 'sort');
    assert.match(plain, /aria-current="true"[^>]*>(?:(?!<\/a>)[\s\S])*?Random/);
    assert.doesNotMatch(plain, /Best match/);
    const searched = menu(render({ q: 'church' }), 'sort');
    assert.match(searched, /aria-current="true"[^>]*>[\s\S]*?Best match/);
    assert.match(searched, /href="\/archive\?q=church&amp;sort=era"/);
  });

  it('echoes the search as a removable chip and bolds the match in the row', () => {
    const markup = render(
      { q: 'church' },
      {
        constraints: [{ key: 'q', label: '“church”', clearHref: '/archive' }],
      },
    );
    assert.match(markup, /aria-label="Remove “church”"/);
    assert.match(markup, /First <b>Church<\/b>/);
    assert.match(markup, /oldest <b>church<\/b> of its kind/);
    // The row is one link; the kind is a glyph and a word; the grade is a meter and a word, with
    // the count of sources beside it.
    assert.match(
      markup,
      /<a class="ds-record__link" href="\/place\/first-church--r1\?from=list" data-record-id="[^"]+">/,
    );
    assert.match(markup, /class="ds-record__kind-word">Place</);
    assert.match(markup, /ds-grade-meter ds-grade-tag--high">.*?Well evidenced<\/span>/);
    assert.match(markup, /ds-record__sources-count">3<\/span> sources/);
  });

  it('no result says what was searched and offers one way out', () => {
    const markup = render(
      { q: 'churhc', kind: 'people' },
      {
        rows: [],
        totalMatched: 0,
        constraints: [
          { key: 'q', label: '“churhc”', clearHref: '/archive?kind=people' },
          { key: 'kind', label: 'People', clearHref: '/archive?q=churhc' },
        ],
      },
    );
    assert.match(markup, /Nothing in the archive matches “churhc” in People\./);
    assert.match(markup, /href="\/archive\?q=churhc">Search all records for “churhc”</);
  });

  it('a misspelled search offers the nearest spelling and never applies it', () => {
    const markup = render(
      { q: 'churhc' },
      {
        rows: [],
        totalMatched: 0,
        constraints: [{ key: 'q', label: '“churhc”', clearHref: '/archive' }],
        didYouMean: { q: 'church', count: 12, href: '/archive?q=church' },
      },
    );
    assert.match(markup, /Did you mean “church”\? It matches 12 records\./);
    assert.match(markup, /href="\/archive\?q=church">Search for “church”</);
    assert.match(markup, /Nothing in the archive matches “churhc”\./);
  });

  it('a search alone clears to the whole register without repeating the total', () => {
    const markup = render(
      { q: 'zzzqqq' },
      {
        rows: [],
        totalMatched: 0,
        constraints: [{ key: 'q', label: '“zzzqqq”', clearHref: '/archive' }],
      },
    );
    assert.match(markup, /href="\/archive">Clear search</);
    assert.doesNotMatch(markup, /Show all/);
  });

  it('pages with real rel links and states the page once', () => {
    const markup = render(
      {},
      { page: 3, pageCount: 44, previousHref: '/archive?page=2', nextHref: '/archive?page=4' },
    );
    assert.match(markup, /href="\/archive\?page=2" rel="prev"/);
    assert.match(markup, /href="\/archive\?page=4" rel="next"/);
    assert.equal((markup.match(/ds-records-pager__at/g) ?? []).length, 1);
    assert.match(markup, /Page <span class="ds-records-pager__num">3<\/span> of/);
  });

  it('offers the decade jump on a single page too, with no pager around it', () => {
    const decadeJumps = [
      { decade: 1770, label: '1770s', page: 1, href: '/archive?sort=earliest#decade-1770' },
      { decade: 1950, label: '1950s', page: 1, href: '/archive?sort=earliest#decade-1950' },
    ];
    const markup = render({}, { pageCount: 1, decadeJumps });
    assert.match(markup, /<form class="ds-records-jump"/);
    assert.match(markup, /<option value="1">1950s<\/option>/);
    assert.doesNotMatch(markup, /aria-label="Pages"/);
    assert.doesNotMatch(markup, /ds-records-pager__at/);

    const paged = render({}, { page: 1, pageCount: 3, nextHref: '/archive?page=2', decadeJumps });
    assert.equal((paged.match(/ds-records-jump"/g) ?? []).length, 1);
    assert.match(paged, /aria-label="Pages"/);

    const oneDecade = render({}, { pageCount: 1, decadeJumps: decadeJumps.slice(0, 1) });
    assert.doesNotMatch(oneDecade, /ds-records-jump/);
  });
});
