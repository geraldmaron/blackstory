/**
 * Behavioral render tests for the `/law/[slug]` connected-records hand-off, camera dignity, and
 * prev/next navigation. `law-page.test.ts` pins
 * the source-level contract; this file exercises real seed data through the real
 * `buildLensHandoff` guard, so a reason string that later drifts into implying causation fails
 * loudly here (a thrown `CausalReasonStringError` during render) rather than only in production.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LawDetailIntro, LawDetailSections } from './LawDetailSections';
import { buildLawDetailViewModel, type LawDetailViewModel } from './law-view-model';
import { seedLegalCatalog } from '../../lib/legal/public-source';

const source = seedLegalCatalog();

function okViewFor(slug: string): Extract<LawDetailViewModel, { kind: 'ok' }> {
  const view = buildLawDetailViewModel(slug, source);
  assert.equal(view.kind, 'ok', `expected seed row for slug "${slug}"`);
  if (view.kind !== 'ok') throw new Error('unreachable');
  return view;
}

test('a state law hands off on its resolved state and decade, never a documented edge', () => {
  const view = okViewFor('georgia-sb202-2021');
  const html = renderToStaticMarkup(
    <LawDetailSections
      snapshot={view.snapshot}
      {...(view.explainer ? { explainer: view.explainer } : {})}
      {...(view.previous ? { previous: view.previous } : {})}
      {...(view.next ? { next: view.next } : {})}
    />,
  );

  // The heading is the contract: it must read exactly this, verbatim.
  assert.match(
    html,
    /<h2 class="ds-room-offramp__title">Records in this jurisdiction and era<\/h2>/,
  );

  const seeRecordsLink =
    /<a class="[^"]*" href="(\/explore\?[^"]*)"[^>]*>See these records<\/a>/.exec(html);
  assert.ok(seeRecordsLink, 'expected a "See these records" link to /explore');
  // renderToStaticMarkup escapes the query separator, so the MARKUP reads `&amp;` where the href
  // is `&`. Assert against the attribute's real value, not its serialization, or the param checks
  // below silently only ever match the FIRST parameter.
  const href = seeRecordsLink![1]!.replaceAll('&amp;', '&');
  assert.match(href, /(^|[?&])state=GA(&|$)/);
  assert.match(href, /(^|[?&])era=2020s(&|$)/);

  // The visible reason names jurisdiction and era, and never implies the archive documented a
  // connection between them and this law.
  assert.match(
    html,
    /Georgia, 2020s\. Same jurisdiction and era as this law, not a documented connection to it\./,
  );
});

test('a federal law with no effectiveYear hands off on jurisdiction alone', () => {
  // Every seed row happens to carry an effectiveYear today, so the "undated" branch is
  // exercised here by stripping it from a real federal snapshot rather than by picking a slug
  // that does not exist in the catalog.
  const view = okViewFor('civil-rights-act-1964');
  const { effectiveYear: _effectiveYear, ...undated } = view.snapshot;
  const html = renderToStaticMarkup(
    <LawDetailSections
      snapshot={undated}
      {...(view.explainer ? { explainer: view.explainer } : {})}
    />,
  );

  assert.match(
    html,
    /Federal\. Same jurisdiction as this law, not a documented connection to it\./,
  );
  const seeRecordsLink =
    /<a class="[^"]*" href="(\/explore[^"]*)"[^>]*>See these records<\/a>/.exec(html);
  assert.ok(seeRecordsLink);
  assert.doesNotMatch(seeRecordsLink![1]!, /state=/);
  assert.doesNotMatch(seeRecordsLink![1]!, /era=/);
});

test('the connected-records hand-off refuses a reason string implying causation', async () => {
  const { buildLensHandoff, CausalReasonStringError } =
    await import('../../lib/map-experience/lens-handoff');
  assert.throws(
    () => buildLensHandoff({ state: 'GA' }, 'Records here because this law passed'),
    CausalReasonStringError,
  );
});

test("prev/next render as RecordNav, walking the browse page's own chronological order", () => {
  const view = okViewFor('civil-rights-act-1964');
  const html = renderToStaticMarkup(
    <LawDetailSections
      snapshot={view.snapshot}
      {...(view.explainer ? { explainer: view.explainer } : {})}
      {...(view.previous ? { previous: view.previous } : {})}
      {...(view.next ? { next: view.next } : {})}
    />,
  );
  assert.match(html, /class="ds-room-recnav"/);
  if (view.previous) assert.match(html, new RegExp(`href="/law/${view.previous.slug}"`));
  if (view.next) assert.match(html, new RegExp(`href="/law/${view.next.slug}"`));
});

test('no camera move is reachable on the law detail room: no shared map plate is borrowed', () => {
  const view = okViewFor('civil-rights-act-1964');
  const introHtml = renderToStaticMarkup(<LawDetailIntro snapshot={view.snapshot} />);
  const sectionsHtml = renderToStaticMarkup(
    <LawDetailSections
      snapshot={view.snapshot}
      {...(view.explainer ? { explainer: view.explainer } : {})}
    />,
  );
  // No plate is rendered at all (SP-12c ships without one until the state-code-to-polygon join
  // exists), so no camera work — push-in, orbit, or otherwise — is reachable from this room.
  for (const html of [introHtml, sectionsHtml]) {
    assert.doesNotMatch(html, /mapmoment/i);
    assert.doesNotMatch(html, /data-moment-open/);
  }
});
