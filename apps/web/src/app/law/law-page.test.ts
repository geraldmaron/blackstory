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
const detailSectionsSource = readFileSync(join(here, 'LawDetailSections.tsx'), 'utf8');
const anatomySource = readFileSync(join(here, 'LawAnatomyStrip.tsx'), 'utf8');

test('law index is the catalog room; /law/browse is a config redirect only', () => {
  assert.match(indexPageSource, /LawBrowseSections/);
  assert.match(indexPageSource, /<ReadingEntry/);
  assert.match(indexPageSource, /<Room rail=\{rail\}>/);
  assert.match(indexPageSource, /OrientationInstrument/);
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
  assert.deepEqual(lawSubmittedParams(), ['q', 'kind', 'topic', 'sort']);
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

test('law detail page uses anatomy strip without gutter mosaic', () => {
  assert.doesNotMatch(detailPageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(detailPageSource, /LAW_EDITION_MOSAIC_SEED/);
  assert.match(detailSectionsSource, /LawAnatomyStrip/);
  assert.match(anatomySource, /EditionFactIcon/);
});

test('the anatomy strip names topics by label, the way the browse chips do', async () => {
  // The detail page printed "constitutional · criminal-justice" while /law chips said
  // "Constitutional" and "Criminal justice".
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LawAnatomyStrip } = await import('./LawAnatomyStrip');
  const markup = renderToStaticMarkup(
    React.createElement(LawAnatomyStrip, {
      kind: 'constitutional-amendment',
      lawStatus: 'in_force',
      jurisdictionId: 'federal',
      citation: 'U.S. Const. amend. XIII',
      topics: ['constitutional', 'criminal-justice'],
    }),
  );
  assert.match(markup, /Constitutional · Criminal justice/);
  assert.doesNotMatch(markup, /criminal-justice/);
});

test('law detail page renders through the room kit, with no edition chrome left', () => {
  assert.doesNotMatch(detailPageSource, /law-panel-chrome/);
  assert.doesNotMatch(detailPageSource, /law-edition\.css/);
  assert.doesNotMatch(detailPageSource, /data-law-edition="v6"/);
  assert.match(detailPageSource, /from '\.\.\/\.\.\/\.\.\/components\/room'/);
  assert.match(detailPageSource, /<Room>/);
  assert.doesNotMatch(detailSectionsSource, /law-panel-chrome/);
  assert.doesNotMatch(detailSectionsSource, /ds-law-edition__panel/);
  assert.match(detailSectionsSource, /<ReadingEntry/);
});

test('law browse lede preserved without em dashes, and the room is not titled civil rights law', () => {
  assert.match(indexPageSource, /LAW_EDITION_BROWSE_LEDE/);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /—/);
  assert.doesNotMatch(indexPageSource, /Civil rights/);
  // The room keeps the noun where a reader scans for it (tab, nav, crumb); the headline is a sentence.
  assert.match(indexPageSource, /title: 'Law'/);
  assert.match(indexPageSource, /What the law actually <em>said<\/em>\./);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /civil rights/i);
});

// The contract covers the connected-records hand-off, camera dignity, prev/next navigation, and
// deliberate absence of a jurisdiction plate. `law-detail-sections.test.tsx` exercises the real
// seed data through the real `buildLensHandoff` guard; these pin the source-level contract.

test('the connected-records heading reads exactly "Records in this jurisdiction and era"', () => {
  assert.match(detailSectionsSource, /title="Records in this jurisdiction and era"/);
  // Not a hand written href: the link is built through the one typed handoff builder so it can
  // never drift from the Explore URL allowlist (docs/ui/patterns-lens-handoff.md §1).
  assert.match(detailSectionsSource, /buildLensHandoff/);
  assert.doesNotMatch(detailSectionsSource, /href=\{?['"`]\/explore/);
});

test('no camera move is reachable on the law detail room: no shared map plate is imported', () => {
  // The dignity gate's spirit applies to abstractions too: a law has no camera at all, because
  // it has no plate at all (see the jurisdiction-plate comment in LawDetailSections.tsx).
  for (const src of [detailPageSource, detailSectionsSource]) {
    assert.doesNotMatch(src, /MapMoment/);
    assert.doesNotMatch(src, /flyTo|pushIn|orbit/i);
  }
});

test('the jurisdiction plate is deliberately absent, not faked with a placeholder', () => {
  // No plate component, and no placeholder standing in for one — see the comment in
  // LawDetailIntro explaining that the state-code-to-polygon join does not exist yet.
  assert.doesNotMatch(detailSectionsSource, /JurisdictionPlate|ds-law-plate|ds-jurisdiction-plate/);
  assert.match(detailSectionsSource, /state-code-to-polygon join/);
});

test('law detail page carries prev/next through the view model into RecordNav', () => {
  assert.match(detailSectionsSource, /RecordNav/);
  assert.match(detailPageSource, /previous/);
  assert.match(detailPageSource, /\bnext\b/);
});
