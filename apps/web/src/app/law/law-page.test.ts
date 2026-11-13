/**
 * Law room kit page wiring: room kit chrome, preserved browse URL contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LAW_EDITION_BROWSE_LEDE } from './law-copy';

const here = dirname(fileURLToPath(import.meta.url));
const indexPageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const browseSectionsSource = readFileSync(join(here, 'LawBrowseSections.tsx'), 'utf8');
const detailPageSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');
const detailViewSource = readFileSync(join(here, '[slug]', 'LawRecordView.tsx'), 'utf8');

test('law index is the catalog room; /law/browse is a config redirect only', () => {
  assert.match(indexPageSource, /LawBrowseSections/);
  assert.match(indexPageSource, /<PageHeader/);
  assert.match(indexPageSource, /<Room width="wide">/);
  assert.doesNotMatch(indexPageSource, /OrientationInstrument|RoomStats|WalkOffRamp|rail=/);
  assert.doesNotMatch(indexPageSource, /how-it-works|LawHubSections/);
  assert.doesNotMatch(indexPageSource, /EditionAtmosphereMosaic|LAW_EDITION_MOSAIC_SEED/);
});

/**
 * The params /law submits. `q` is the FindBar's own field; the rest ride along as the hidden
 * fields it renders from `preserved`, so a search refines the view instead of resetting it.
 */
function lawSubmittedParams(): string[] {
  const preserved = /preserved=\{\{([\s\S]*?)\}\}/.exec(browseSectionsSource)?.[1] ?? '';
  return ['q', ...[...preserved.matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1] as string)];
}

test('law browse preserves GET URL contract at /law', () => {
  // The form itself (method="get", name="q", no Apply button) is the FindBar's, and is asserted
  // on the rendered component in room-kit.test.tsx.
  assert.match(browseSectionsSource, /<FindBar/);
  assert.match(browseSectionsSource, /action="\/law#browse"/);
  assert.match(browseSectionsSource, /id="browse"/);
  assert.deepEqual(lawSubmittedParams(), ['q', 'kind', 'topic', 'sort', 'status']);
  assert.match(browseSectionsSource, /sortOptions\.map/);
  assert.match(browseSectionsSource, /clearHref="\/law"/);
});

test('every rendered browse control is in the edge param allowlist', async () => {
  // A control whose param is missing from the allowlist is stripped by middleware before the
  // page runs, so the filter silently does nothing. `sort` shipped broken exactly that way.
  const { LAW_PAGE_PARAM_ALLOWLIST } = await import('../../lib/runtime-hardening/constants');
  const rendered = lawSubmittedParams();
  assert.ok(rendered.length > 1);
  for (const param of rendered) {
    assert.ok(
      (LAW_PAGE_PARAM_ALLOWLIST as readonly string[]).includes(param),
      `browse submits "${param}" but it is not in LAW_PAGE_PARAM_ALLOWLIST`,
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

test('law browse lede preserved without em dashes, and the room is not titled civil rights law', () => {
  assert.match(indexPageSource, /LAW_EDITION_BROWSE_LEDE/);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /—/);
  assert.doesNotMatch(indexPageSource, /Civil rights/);
  // The room keeps the noun where a reader scans for it (tab, nav, crumb); the headline is a sentence.
  assert.match(indexPageSource, /title: 'Law'/);
  assert.match(indexPageSource, /title="What the law actually said"/);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /civil rights/i);
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
