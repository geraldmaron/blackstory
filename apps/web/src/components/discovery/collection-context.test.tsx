/**
 * CollectionContext: active link semantics, supplied hrefs, and counts that never claim more than
 * is known. Rendered integrations (Records, Explore source wiring) are pinned at the bottom.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  EMPTY_RECORDS_QUERY,
  type RecordsIndex as RecordsIndexModel,
} from '../../lib/records/build-records-index';
import { RecordsIndexRoom } from '../../app/records/RecordsIndex';
import {
  CollectionContext,
  collectionCountText,
  collectionLimitText,
  collectionMapText,
} from './collection-context';

void React;

const MAP = '/explore?q=school&sort=era';
const LIST = '/records?q=school&sort=era';

function render(props: Partial<React.ComponentProps<typeof CollectionContext>> = {}): string {
  return renderToStaticMarkup(
    <CollectionContext
      activeView="records"
      mapHref={MAP}
      recordsHref={LIST}
      matched={120}
      drawable={100}
      {...props}
    />,
  );
}

describe('CollectionContext links', () => {
  it('keeps the nav labels and the supplied hrefs byte for byte', () => {
    const markup = render();
    assert.match(markup, /<nav[^>]*aria-label="View this collection as"/);
    assert.ok(markup.includes(`href="${MAP.replace(/&/g, '&amp;')}"`));
    assert.ok(markup.includes(`href="${LIST.replace(/&/g, '&amp;')}"`));
    assert.match(markup, />Map<\/a>/);
    assert.match(markup, />Records<\/a>/);
  });

  it('marks only the active view with aria-current and keeps it a real anchor', () => {
    const records = render({ activeView: 'records' });
    assert.equal([...records.matchAll(/aria-current="page"/g)].length, 1);
    assert.match(records, /<a[^>]*href="\/records[^"]*"[^>]*aria-current="page"[^>]*>Records<\/a>/);
    const map = render({ activeView: 'map' });
    assert.match(map, /<a[^>]*href="\/explore[^"]*"[^>]*aria-current="page"[^>]*>Map<\/a>/);
    assert.doesNotMatch(map, /aria-current="page"[^>]*>Records</);
  });

  it('does not offer a live link to the other view while the catalog is unavailable', () => {
    const markup = render({ activeView: 'map', ready: false, matched: null });
    assert.doesNotMatch(markup, /href="\/records/);
    assert.match(markup, /<span[^>]*aria-disabled="true"[^>]*>Records<\/span>/);
    assert.match(markup, /Counting records/);
    assert.match(markup, /data-ready="false"/);
  });

  it('announces politely only when asked, and never as an alert', () => {
    assert.doesNotMatch(render(), /aria-live/);
    const live = render({ announce: true });
    assert.match(live, /aria-live="polite"/);
    assert.doesNotMatch(live, /role="alert"|role="status"/);
  });
});

describe('CollectionContext counts', () => {
  it('states membership and map placement separately', () => {
    const markup = render();
    assert.match(markup, /120 records in this collection/);
    assert.match(markup, /100 can be placed on the map; 20 have no mapped location/);
  });

  it('is honest about zero, one and unlocated-only collections', () => {
    assert.equal(collectionCountText(0), 'No records match this collection');
    assert.equal(collectionCountText(1), '1 record in this collection');
    assert.equal(collectionMapText(0, 0), null);
    assert.equal(collectionMapText(7, 0), 'None can be placed on the map');
    assert.equal(collectionMapText(2, 1), '1 can be placed on the map; 1 has no mapped location');
    assert.equal(collectionMapText(5, 5), '5 can be placed on the map');
    assert.equal(collectionMapText(5, null), null);
    // A drawable count above membership is clamped, never reported as more than the collection.
    assert.equal(collectionMapText(5, 9), '5 can be placed on the map');
  });

  it('never claims every match is drawn', () => {
    assert.doesNotMatch(render({ drawable: 120 }), /all|every/i);
    assert.doesNotMatch(render({ drawable: null }), /placed on the map/);
  });

  it('keeps temporary map limits apart from collection membership', () => {
    const markup = render({
      activeView: 'map',
      onMap: 12,
      mapLimits: ['nearby', 'the time sweep'],
    });
    assert.match(markup, /120 records in this collection/);
    assert.match(markup, /Map view limited by nearby, the time sweep: 12 shown\./);
    assert.match(markup, /The collection is unchanged\./);
    assert.equal(collectionLimitText(3, []), null);
    assert.equal(collectionLimitText(3, undefined), null);
  });
});

describe('CollectionContext integrations', () => {
  it('renders in the Records room with its own model hrefs and counts', () => {
    const model = {
      query: { ...EMPTY_RECORDS_QUERY, q: 'school', sort: 'era', page: 2 },
      rows: [],
      totalAll: 4000,
      totalMatched: 30,
      mappableMatched: 25,
      page: 2,
      pageCount: 2,
      countLabel: '30 records',
      previousHref: undefined,
      nextHref: undefined,
      facets: { kind: [], era: [], state: [], topic: [], status: [], evidence: [] },
      eraGroups: [],
      stateGroups: [],
      constraints: [],
      clearAllHref: '/records',
      atlasHref: '/explore?q=school&sort=era',
      atlasReason: '30 records match. 25 appear on the map.',
    } as unknown as RecordsIndexModel;
    const markup = renderToStaticMarkup(
      <RecordsIndexRoom model={model} releaseLabel="Active release" />,
    );
    assert.match(markup, /class="ds-collection"/);
    assert.match(markup, /30 records in this collection/);
    assert.match(markup, /25 can be placed on the map; 5 have no mapped location/);
    // The active Records link keeps the current page of the same collection.
    assert.match(
      markup,
      /href="\/records\?q=school&amp;sort=era&amp;page=2"[^>]*aria-current="page"/,
    );
    assert.match(markup, /href="\/explore\?q=school&amp;sort=era"[^>]*>Map<\/a>/);
  });

  it('is wired into the embedded Explore surface and replaces the rail fragment', () => {
    const source = readFileSync(
      new URL('../../app/explore/AtlasExperience.tsx', import.meta.url),
      'utf8',
    );
    assert.match(source, /<CollectionContext[\s\S]*activeView="map"/);
    assert.match(source, /recordsQueryFromExplore\(collectionState\)/);
    // The rail only keeps its own count and list link when the strip is hidden.
    assert.match(source, /showCollection\s*\?\s*\{\}/);
  });
});
