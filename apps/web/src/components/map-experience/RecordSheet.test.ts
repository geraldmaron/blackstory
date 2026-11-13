/**
 * Record inspector: non-modal, compact, and honest about precision and evidence.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { RecordSheet, type RecordSheetProps, type SheetRecord } from './RecordSheet';

const RECORD: SheetRecord = {
  id: 'ent_gaston_motel',
  name: 'A.G. Gaston Motel',
  kind: 'place',
  place: 'Birmingham, Alabama',
  story: 'Built in 1954, it became the campaign headquarters of the 1963 Birmingham movement.',
  precision: 'city',
  confidenceTier: 'high',
  evidenceLabel: 'Grade A · 6 sources',
  href: '/entity/ent_gaston_motel',
};

function render(overrides: Partial<RecordSheetProps> = {}): string {
  const props: RecordSheetProps = { record: RECORD, onClose: () => {}, ...overrides };
  return renderToStaticMarkup(createElement(RecordSheet, props));
}

test('no record means no inspector', () => {
  assert.equal(render({ record: null }), '');
});

test('the inspector is a dialog that does not trap the reader on the map', () => {
  const html = render();
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="false"/, 'the map must stay operable behind it');
  assert.match(html, /aria-labelledby="ds-sheet-name"/);
});

test('reads in order: kind and place, name, summary, precision, evidence, Open record', () => {
  const html = render();
  const order = [
    'Place · Birmingham, Alabama',
    'A.G. Gaston Motel',
    'Built in 1954',
    'Placed to the city',
    'Grade A',
    '6 sources',
    'Open record',
  ].map((text) => html.indexOf(text));
  for (const index of order) assert.ok(index >= 0);
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
});

test('the precision statement renders for every record, in words', () => {
  assert.match(render({ record: { ...RECORD, precision: 'site' } }), /Placed at the site/);
  assert.match(render({ record: { ...RECORD, precision: 'state' } }), /Placed to the state/);
});

test('one primary action opens the record page; no camera button, no miniature record page', () => {
  const html = render();
  assert.match(
    html,
    /<a class="ds-sheet__open" href="\/entity\/ent_gaston_motel">Open record<\/a>/,
  );
  assert.doesNotMatch(html, /Fly to place/);
  assert.doesNotMatch(html, /Sources|Documented connections|Cited in|Visit/);
  const { href: _href, ...withoutPage } = RECORD;
  assert.equal(render({ record: withoutPage }).includes('Open record'), false);
});

test('previous/next are quiet, labelled, and show the position in the list', () => {
  const html = render({ onStep: () => {}, position: { index: 3, total: 1240 } });
  assert.match(html, /aria-label="Previous record"/);
  assert.match(html, /aria-label="Next record"/);
  assert.match(html, /3 of 1,240/);
  assert.doesNotMatch(render(), /Previous record/);
});

test('the evidence signal is a meter plus words, never color alone', () => {
  const html = render();
  assert.match(html, /class="ds-rec-meter[^"]*"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  assert.match(html, /Grade A/);
});
