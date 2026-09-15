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
const browsePageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const browseSectionsSource = readFileSync(join(here, 'LawBrowseSections.tsx'), 'utf8');
const detailPageSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');
const detailSectionsSource = readFileSync(join(here, 'LawDetailSections.tsx'), 'utf8');
const anatomySource = readFileSync(join(here, 'LawAnatomyStrip.tsx'), 'utf8');

test('law browse page renders through the room kit, with no edition chrome left', () => {
  assert.doesNotMatch(browsePageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(browsePageSource, /LAW_EDITION_MOSAIC_SEED/);
  // `data-law-edition="v6"` marked the per-route chrome the shared kit replaces.
  assert.doesNotMatch(browsePageSource, /data-law-edition="v6"/);
  assert.match(browsePageSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(browsePageSource, /<Room>/);
  assert.doesNotMatch(browsePageSource, /\/explore/);
  assert.match(browsePageSource, /<RoomHeader/);
  assert.doesNotMatch(browsePageSource, /ds-page__title/);
});

test('law browse preserves GET URL contract', () => {
  assert.match(browseSectionsSource, /method="get"/);
  assert.match(browseSectionsSource, /action="\/law"/);
  assert.match(browseSectionsSource, /name="q"/);
  assert.match(browseSectionsSource, /name="kind"/);
  assert.match(browseSectionsSource, /name="topic"/);
  assert.match(browseSectionsSource, /name="sort"/);
  assert.match(browseSectionsSource, /href="\/law"/);
});

test('every rendered browse control is in the edge param allowlist', async () => {
  // A control whose param is missing from the allowlist is stripped by middleware before the
  // page runs, so the filter silently does nothing. `sort` shipped broken exactly that way.
  const { LAW_PAGE_PARAM_ALLOWLIST } = await import('../../lib/runtime-hardening/constants');
  const rendered = [...browseSectionsSource.matchAll(/name="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(rendered.length > 0);
  for (const param of rendered) {
    assert.ok(
      (LAW_PAGE_PARAM_ALLOWLIST as readonly string[]).includes(param as string),
      `browse renders name="${param}" but it is not in LAW_PAGE_PARAM_ALLOWLIST`,
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
  assert.match(detailSectionsSource, /<RoomHeader/);
});

test('law browse lede preserved without em dashes', () => {
  assert.match(browsePageSource, /LAW_EDITION_BROWSE_LEDE/);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /—/);
});

// SP-12c (repo-92n2.12.3): the connected-records hand-off, camera dignity, prev/next, and the
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
