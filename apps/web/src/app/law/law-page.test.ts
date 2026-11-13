/**
 * Law index and detail page wiring: the chronology's frame and the browse URL contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const indexPageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const browseSectionsSource = readFileSync(join(here, 'LawBrowseSections.tsx'), 'utf8');
const detailPageSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');
const detailViewSource = readFileSync(join(here, '[slug]', 'LawRecordView.tsx'), 'utf8');

test('law index is the chronology: page header, the register toolbar, no edition chrome', () => {
  assert.match(indexPageSource, /LawBrowseSections/);
  assert.match(indexPageSource, /<PageHeader/);
  assert.match(indexPageSource, /<Room width="wide"/);
  assert.match(indexPageSource, /title="Law"/);
  assert.match(indexPageSource, /title: 'Law'/);
  assert.doesNotMatch(indexPageSource, /OrientationInstrument|RoomStats|WalkOffRamp|rail=/);
  assert.doesNotMatch(indexPageSource, /how-it-works|LawHubSections|DocumentPlate/);
  assert.doesNotMatch(indexPageSource, /EditionAtmosphereMosaic|LAW_EDITION_MOSAIC_SEED/);
  assert.doesNotMatch(indexPageSource, /Civil rights law/i);
  assert.match(browseSectionsSource, /<RecordsToolbar/);
  for (const gone of [
    'FindBar',
    'RoomSection',
    'RoomJump',
    'KeepGoing',
    'LegalDisclaimer',
    'Pagination',
  ]) {
    assert.doesNotMatch(browseSectionsSource, new RegExp(gone), `${gone} is back on /law`);
  }
});

/** The params /law writes into its links: every lawBrowseHref key. */
const LAW_LINK_PARAMS = ['q', 'kind', 'topic', 'status', 'sort'] as const;

test('every param the law index links with is in the edge param allowlist', async () => {
  // A control whose param is missing from the allowlist is stripped by middleware before the
  // page runs, so the filter silently does nothing. `sort` shipped broken exactly that way.
  const { LAW_PAGE_PARAM_ALLOWLIST } = await import('../../lib/runtime-hardening/constants');
  const { lawBrowseHref } = await import('./law-view-model');
  const href = lawBrowseHref({ q: 'x', kind: 'k', topic: 't', status: 's', sort: 'recent' });
  assert.deepEqual([...new URL(href, 'http://x').searchParams.keys()], [...LAW_LINK_PARAMS]);
  for (const param of LAW_LINK_PARAMS) {
    assert.ok(
      (LAW_PAGE_PARAM_ALLOWLIST as readonly string[]).includes(param),
      `the index links with "${param}" but it is not in LAW_PAGE_PARAM_ALLOWLIST`,
    );
  }
});

test('law detail page renders the shared record anatomy, with no edition chrome left', () => {
  assert.match(detailPageSource, /LawRecordView/);
  assert.match(detailViewSource, /<RecordPage/);
  for (const src of [detailPageSource, detailViewSource]) {
    assert.doesNotMatch(src, /EditionAtmosphereMosaic|law-panel-chrome|law-edition\.css/);
    assert.doesNotMatch(src, /LawAnatomyStrip|RoomJump|LegalDisclaimer/);
  }
});

// `[slug]/law-record.test.tsx` exercises the real seed data through the real `buildLensHandoff`
// guard; these pin the source-level contract.

test('the map hand-off is built through the one typed handoff builder', () => {
  // Never a hand-written href, so it cannot drift from the Explore URL allowlist
  // (docs/ui/patterns-lens-handoff.md §1).
  assert.match(detailViewSource, /buildLensHandoff/);
  assert.doesNotMatch(detailViewSource, /href=\{?['"`]\/explore/);
});

test('no camera move is reachable on the law detail room: no shared map plate is imported', () => {
  for (const src of [detailPageSource, detailViewSource]) {
    assert.doesNotMatch(src, /MapMoment|RecordMap/);
    assert.doesNotMatch(src, /flyTo|pushIn|orbit/i);
  }
});

test('the jurisdiction plate is deliberately absent, not faked with a placeholder', () => {
  assert.doesNotMatch(detailViewSource, /JurisdictionPlate|ds-law-plate|ds-jurisdiction-plate/);
  assert.match(detailViewSource, /state-code-to-polygon join/);
});

test('law detail page carries prev/next through the view model into the pager', () => {
  assert.match(detailViewSource, /previous/);
  assert.match(detailViewSource, /\bnext\b/);
});
