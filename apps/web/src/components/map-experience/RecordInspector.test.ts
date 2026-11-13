/**
 * Record inspector: non-modal, compact, and honest about precision and evidence.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import {
  RecordInspector,
  type InspectorRecord,
  type RecordInspectorProps,
} from './RecordInspector';

const RECORD: InspectorRecord = {
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

function render(overrides: Partial<RecordInspectorProps> = {}): string {
  const props: RecordInspectorProps = { record: RECORD, ...overrides };
  return renderToStaticMarkup(createElement(RecordInspector, props));
}

test('the inspector is a labelled region, not a modal: the map stays operable beside it', () => {
  const html = render();
  assert.doesNotMatch(html, /aria-modal="true"/);
  assert.match(html, /<article[^>]*aria-labelledby="ds-inspector-name"/);
});

test('reads in order: kind and place, name, summary, precision, evidence, Open record', () => {
  const html = render();
  const order = [
    'Place · Birmingham, Alabama',
    'A.G. Gaston Motel',
    'Built in 1954',
    'City-level location',
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
  assert.match(render({ record: { ...RECORD, precision: 'site' } }), /Exact site/);
  assert.match(render({ record: { ...RECORD, precision: 'state' } }), /State-level location/);
});

test('one primary action opens the record page; no camera button, no miniature record page', () => {
  const html = render();
  assert.match(
    html,
    /<a class="ds-button ds-button--primary" href="\/entity\/ent_gaston_motel">Open record<\/a>/,
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

test('a photo shows only when the archive holds one; never a placeholder box', () => {
  assert.doesNotMatch(render(), /ds-inspector__photo/);
  const html = render({ record: { ...RECORD, photoUrl: 'https://cdn.example/gaston.jpg' } });
  assert.match(html, /<img src="https:\/\/cdn.example\/gaston.jpg" alt=""/);
});
