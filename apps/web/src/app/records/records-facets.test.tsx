/**
 * The Records facets offer every value they count. The tray used to render the first six chips
 * of each facet and drop the rest, so most states, eras and topics could not be picked at all.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  EMPTY_RECORDS_QUERY,
  type RecordsFacet,
  type RecordsIndex as RecordsIndexModel,
} from '../../lib/records/build-records-index';
import { RecordsIndexRoom } from './RecordsIndex';

void React;

function facet(prefix: string, ids: readonly string[]): RecordsFacet[] {
  return ids.map((id, index) => ({
    id,
    label: `${prefix} ${id}`,
    count: 100 - index,
    href: `/records?${prefix.toLowerCase()}=${id}`,
  }));
}

const STATES = ['DC', 'VA', 'NC', 'SC', 'GA', 'AL', 'MS', 'LA', 'TX', 'FL', 'TN', 'KY'];

function render(): string {
  const model = {
    query: EMPTY_RECORDS_QUERY,
    rows: [],
    totalAll: 1200,
    page: 1,
    pageCount: 1,
    countLabel: '1,200 records',
    previousHref: undefined,
    nextHref: undefined,
    facets: {
      kind: facet('Kind', ['place', 'person', 'event']),
      era: [],
      state: facet('State', STATES),
      topic: [],
      status: [],
      evidence: [],
    },
    eraGroups: [],
    stateGroups: [],
    constraints: [],
    clearAllHref: '/records',
    atlasHref: '/explore',
    atlasReason: '',
  } as unknown as RecordsIndexModel;
  return renderToStaticMarkup(<RecordsIndexRoom model={model} releaseLabel="Active release" />);
}

describe('Records facets', () => {
  it('a long facet is a select holding every value, plus the option that lifts it', () => {
    const markup = render();
    const select = /<select[^>]*name="state"[^>]*>([\s\S]*?)<\/select>/.exec(markup);
    assert.ok(select, 'the state facet renders a select');
    const options = [...select[1]!.matchAll(/<option /g)];
    assert.equal(options.length, STATES.length + 1);
    // The lifted option is the default, so the server marks it selected.
    assert.match(select[1]!, /<option value=""[^>]*>All states<\/option>/);
    assert.match(select[1]!, /State KY \(89\)/);
    // It submits a real GET form, so it still works without JavaScript.
    assert.match(markup, /<form class="ds-records-facet__form" action="\/records" method="get">/);
  });

  it('a short facet stays a row of chips, with none dropped', () => {
    const markup = render();
    assert.doesNotMatch(markup, /<select[^>]*name="kind"/);
    for (const id of ['place', 'person', 'event']) {
      assert.match(markup, new RegExp(`href="/records\\?kind=${id}"`));
    }
  });
});
