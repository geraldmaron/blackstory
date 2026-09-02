/**
 * ErrataSections coverage: the log is a plain list, never a disclosure, and every row carries
 * the four facts the design law requires. docs/ui/design-direction-v9-surfaces.md §4.2.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrataSections, ERRATA_LOG_OPENED_DATE } from './ErrataSections';
import type { ErrataEntry } from '../../lib/trust/errata-seed';

void React;

const SAMPLE_ENTRIES: readonly ErrataEntry[] = [
  {
    id: 'errata_sample_correction',
    timestamp: '2026-08-01T12:00:00.000Z',
    changeType: 'correction',
    headline: 'Fixed a wrong date',
    summary: 'The original entry cited the wrong year for the ordinance.',
    affectedUrl: '/place/paul-laurence-dunbar-high-school',
  },
  {
    id: 'errata_sample_note',
    timestamp: '2026-07-20T09:00:00.000Z',
    changeType: 'editors_note',
    headline: 'Reworded a caption',
    summary: 'Clarified framing without changing the underlying fact.',
  },
];

test('no row is behind a disclosure', () => {
  const html = renderToStaticMarkup(<ErrataSections entries={SAMPLE_ENTRIES} />);
  assert.doesNotMatch(html, /<details/, 'the errata log renders no <details> element');
  assert.doesNotMatch(html, /<summary/, 'the errata log renders no <summary> element');
  assert.doesNotMatch(html, /ds-room-draw/, 'the errata log does not reuse the Disclosure block');
});

test('every row shows date, record link, statement and phase', () => {
  const html = renderToStaticMarkup(<ErrataSections entries={SAMPLE_ENTRIES} />);

  assert.match(html, /ds-errata__row-date"[^>]*>2026-08-01</);
  assert.match(
    html,
    /<a class="ds-errata__row-id" href="\/place\/paul-laurence-dunbar-high-school">Paul Laurence Dunbar High School</,
  );
  assert.match(
    html,
    /ds-errata__row-statement">Fixed a wrong date\. The original entry cited the wrong year for the ordinance\./,
  );
  assert.match(html, /ds-errata__row-phase">Correction</);

  // An entry with no affected record still renders a plain label, not a shop id.
  assert.match(html, /<span class="ds-errata__row-id">This archive<\/span>/);
  assert.doesNotMatch(html, /errata_sample_correction|errata_sample_note/);
  assert.match(html, /ds-errata__row-phase">Editor&#x27;s note</);
});

test("rows render in the order the entries arrive (reverse chronological is the caller's job)", () => {
  const html = renderToStaticMarkup(<ErrataSections entries={SAMPLE_ENTRIES} />);
  const correctionIndex = html.indexOf('Fixed a wrong date');
  const noteIndex = html.indexOf('Reworded a caption');
  assert.ok(correctionIndex < noteIndex && correctionIndex >= 0);
});

test('the empty state names the date the log opened, and is never a bare empty page', () => {
  const html = renderToStaticMarkup(<ErrataSections entries={[]} />);
  assert.match(html, /role="status"/);
  assert.match(html, new RegExp(ERRATA_LOG_OPENED_DATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /<ol/);
});
