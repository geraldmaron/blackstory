/**
 * The law entry on the shared record anatomy, rendered from real seed data. The map hand-off runs
 * through the real `buildLensHandoff` guard, so a reason that drifts into implying cause throws
 * here rather than in production.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LawRecordView } from './LawRecordView';
import { buildLawDetailViewModel, type LawDetailViewModel } from '../law-view-model';
import { seedLegalCatalog } from '../../../lib/legal/public-source';

const source = seedLegalCatalog();

function okViewFor(slug: string): Extract<LawDetailViewModel, { kind: 'ok' }> {
  const view = buildLawDetailViewModel(slug, source);
  assert.equal(view.kind, 'ok', `expected seed row for slug "${slug}"`);
  if (view.kind !== 'ok') throw new Error('unreachable');
  return view;
}

/** The map action's href and label: the label must name exactly the filter the href applies. */
function mapAction(html: string): { readonly href: string; readonly label: string } | undefined {
  const match =
    /<a class="[^"]*" href="(\/explore[^"]*)"[^>]*>(?:<svg[^]*?<\/svg>)?([^<]*on the map)<\/a>/.exec(
      html,
    );
  return match ? { href: match[1]!.replaceAll('&amp;', '&'), label: match[2]! } : undefined;
}

test('a state law opens its state and decade, and the label says exactly that', () => {
  const html = renderToStaticMarkup(<LawRecordView {...okViewFor('georgia-sb202-2021')} />);
  const action = mapAction(html);
  assert.ok(action);
  assert.match(action.href, /(^|[?&])state=GA(&|$)/);
  assert.match(action.href, /(^|[?&])era=2020s(&|$)/);
  assert.equal(action.label, 'Georgia records from the 2020s on the map');
  // The law itself is not on the map, and no caption claims a filter the link does not apply.
  assert.doesNotMatch(html, />Open on the map</);
  assert.doesNotMatch(html, /Same jurisdiction/);
});

test('a federal law opens its decade only, and never claims a jurisdiction filter', () => {
  const html = renderToStaticMarkup(<LawRecordView {...okViewFor('civil-rights-act-1964')} />);
  const action = mapAction(html);
  assert.ok(action);
  assert.doesNotMatch(action.href, /state=/);
  assert.match(action.href, /(^|[?&])era=1960s(&|$)/);
  assert.equal(action.label, 'Records from the 1960s on the map');
});

test('a federal law with no effectiveYear has nothing to narrow on, so no map action', () => {
  const view = okViewFor('civil-rights-act-1964');
  const { effectiveYear: _effectiveYear, ...undated } = view.snapshot;
  const html = renderToStaticMarkup(<LawRecordView {...view} snapshot={undated} />);
  assert.equal(mapAction(html), undefined);
});

test('record dates print in one long format, never as ISO days', () => {
  const html = renderToStaticMarkup(<LawRecordView {...okViewFor('civil-rights-act-1964')} />);
  assert.doesNotMatch(html, />\d{4}-\d{2}-\d{2}</);
  assert.match(html, /<time>[A-Z][a-z]+ \d{1,2}, \d{4}<\/time>/);
});

test('the rights rows are outside links, marked as such, the whole row the target', () => {
  const html = renderToStaticMarkup(<LawRecordView {...okViewFor('fair-housing-act-1968')} />);
  assert.match(html, /ds-recpage__link-name ds-recpage__link-name--external/);
});

test('the hand-off refuses a reason string implying causation', async () => {
  const { buildLensHandoff, CausalReasonStringError } =
    await import('../../../lib/map-experience/lens-handoff');
  assert.throws(
    () => buildLensHandoff({ state: 'GA' }, 'Records here because this law passed'),
    CausalReasonStringError,
  );
});

test('a law takes the record anatomy: masthead, citation line, numbered sources, record file', () => {
  const html = renderToStaticMarkup(<LawRecordView {...okViewFor('civil-rights-act-1964')} />);
  assert.match(html, /<h1 id="record-title" class="ds-recpage__title">/);
  assert.match(html, /<dt class="ds-recpage__fact-label">Where<\/dt>/);
  assert.match(html, /<dt class="ds-recpage__fact-label">When<\/dt>/);
  assert.match(html, /<dt class="ds-recpage__fact-label">Evidence<\/dt>/);
  assert.match(html, /<ol class="ds-evidence">/);
  assert.match(html, /Record file/);
  // The disclaimer is a plain line in the rights beat, not a warning box.
  assert.doesNotMatch(html, /ds-notice--warning/);
  // A license tag reads as words, never as the raw token.
  assert.doesNotMatch(html, /public-domain/);
});

test('prev/next walk the catalog order', () => {
  const view = okViewFor('civil-rights-act-1964');
  const html = renderToStaticMarkup(<LawRecordView {...view} />);
  assert.ok(view.previous || view.next, 'the seed law sits inside the catalog order');
  if (view.previous)
    assert.match(
      html,
      new RegExp(
        `href="/law/${view.previous.slug}"[^>]*rel="prev"|rel="prev"[^>]*href="/law/${view.previous.slug}"`,
      ),
    );
  if (view.next)
    assert.match(
      html,
      new RegExp(
        `href="/law/${view.next.slug}"[^>]*rel="next"|rel="next"[^>]*href="/law/${view.next.slug}"`,
      ),
    );
});

test('no map plate and no camera move: a law has a jurisdiction, not a location', () => {
  const html = renderToStaticMarkup(<LawRecordView {...okViewFor('civil-rights-act-1964')} />);
  assert.doesNotMatch(html, /ds-record-map|mapmoment|data-moment-open/i);
});
