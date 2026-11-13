/**
 * The errata log: one row per change grouped by day, long notes clamped with the full text kept,
 * record ids never shown,
 * and a record link only when the name resolves to exactly one published record.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrataSections, ERRATA_LOG_OPENED_DATE } from './ErrataSections';
import { resolveErrataRecordHrefs } from './errata-records';
import type { ErrataEntry } from '../../lib/trust/errata-seed';

void React;

const SAMPLE_ENTRIES: readonly ErrataEntry[] = [
  {
    id: 'errata_sample_correction',
    timestamp: '2026-08-01T12:00:00.000Z',
    changeType: 'correction',
    headline: 'Dunbar High School: founding date corrected',
    summary: 'The original entry cited the wrong year for the ordinance.',
  },
  {
    id: 'errata_sample_same_day',
    timestamp: '2026-08-01T09:00:00.000Z',
    changeType: 'clarification',
    headline: 'Bethel Church: pastor’s name spelled out',
    summary: 'The record now gives the full name.',
  },
  {
    id: 'errata_sample_note',
    timestamp: '2026-07-20T09:00:00.000Z',
    changeType: 'editors_note',
    headline: 'Reworded a caption',
    summary: 'Clarified framing without changing the underlying fact.',
    affectedUrl: '/methodology',
  },
];

test('no row is behind a details disclosure, and a long note keeps its full text in the HTML', () => {
  const long = 'word '.repeat(60).trim();
  const html = renderToStaticMarkup(
    <ErrataSections
      entries={[
        ...SAMPLE_ENTRIES,
        {
          id: 'errata_sample_many',
          timestamp: '2026-07-01T09:00:00.000Z',
          changeType: 'clarification',
          headline: 'National Register records: terms replaced',
          summary: long,
          affectedRecords: ['Lake Nixon', 'Union Tavern'],
        },
      ]}
      recordHrefs={new Map([['errata_sample_many#Lake Nixon', '/entity/ent_lake']])}
    />,
  );
  assert.doesNotMatch(html, /<details|<summary|ds-room-draw/);
  // Short notes are not clamped; the long one is, with its whole text and its records present.
  assert.equal(html.match(/data-clamp/g)?.length, 1);
  assert.match(html, new RegExp(long));
  assert.match(html, /Read the full note and the 2 records/);
  assert.match(
    html,
    /<li><a href="\/entity\/ent_lake">Lake Nixon<\/a><\/li><li>Union Tavern<\/li>/,
  );
});

test('a row names the record, what changed, the note and the kind of change', () => {
  const html = renderToStaticMarkup(
    <ErrataSections
      entries={SAMPLE_ENTRIES}
      recordHrefs={new Map([['errata_sample_correction', '/entity/ent_dunbar']])}
    />,
  );
  assert.match(
    html,
    /<a class="ds-errata__name" href="\/entity\/ent_dunbar">Dunbar High School<\/a>/,
  );
  assert.match(html, /ds-errata__change">Founding date corrected</);
  assert.match(html, /ds-errata__note">The original entry cited the wrong year/);
  assert.match(html, /ds-errata__type">Correction</);
  assert.match(html, /ds-errata__type">Editor&#x27;s note</);
  // An unresolved record is named, not linked; an archive-level entry names its page.
  assert.match(html, /<span class="ds-errata__name">Bethel Church<\/span>/);
  assert.match(html, /<a class="ds-errata__name" href="\/methodology">Methodology<\/a>/);
  assert.doesNotMatch(html, /errata_sample_/);
});

test('each day is one group under its date, with its changes in order', () => {
  const html = renderToStaticMarkup(<ErrataSections entries={SAMPLE_ENTRIES} />);
  assert.equal(html.match(/class="ds-errata__date"/g)?.length, 2);
  assert.match(html, /<time dateTime="2026-08-01">Aug 1, 2026<\/time>/);
  assert.equal(html.match(/class="ds-errata__row"/g)?.length, 3);
});

test('a listed record links the same way, keyed by entry and name', () => {
  const hrefs = resolveErrataRecordHrefs(
    [{ ...SAMPLE_ENTRIES[0]!, affectedRecords: ['Lake Nixon', 'Bethel Church'] }],
    [
      { id: 'ent_lake', displayName: 'Lake Nixon' },
      { id: 'ent_bethel_a', displayName: 'Bethel Church' },
      { id: 'ent_bethel_b', displayName: 'Bethel Church' },
    ],
  );
  assert.equal(hrefs.get('errata_sample_correction#Lake Nixon'), '/entity/ent_lake');
  assert.equal(hrefs.has('errata_sample_correction#Bethel Church'), false);
});

test('a record link needs exactly one published record with that name', () => {
  const hrefs = resolveErrataRecordHrefs(SAMPLE_ENTRIES, [
    { id: 'ent_dunbar', displayName: 'Dunbar High School' },
    { id: 'ent_bethel_a', displayName: 'Bethel Church' },
    { id: 'ent_bethel_b', displayName: 'Bethel  Church' },
  ]);
  assert.equal(hrefs.get('errata_sample_correction'), '/entity/ent_dunbar');
  assert.equal(hrefs.has('errata_sample_same_day'), false);
  assert.equal(hrefs.has('errata_sample_note'), false);
});

test('the empty state names the date the log opened, and is never a bare empty page', () => {
  const html = renderToStaticMarkup(<ErrataSections entries={[]} />);
  assert.match(html, /role="status"/);
  assert.match(html, new RegExp(ERRATA_LOG_OPENED_DATE));
  assert.doesNotMatch(html, /<ol/);
});
