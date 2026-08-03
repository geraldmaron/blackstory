/**
 * Law v6 page wiring: shared gutter mosaic, preserved browse URL contract, edition stack.
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
  assert.match(browsePageSource, /<RoomHeader/);
  assert.doesNotMatch(browsePageSource, /ds-page__title/);
});

test('law browse preserves GET URL contract and auto-submit facets', () => {
  assert.match(browseSectionsSource, /method="get"/);
  assert.match(browseSectionsSource, /action="\/law"/);
  assert.match(browseSectionsSource, /AutoSubmitSelect/);
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

test('the browse page imports the stylesheet its ledger and chips live in', () => {
  // Without this import the catalog rendered as unstyled <ul> bullets.
  assert.match(browsePageSource, /law-edition\.css/);
});

test('law detail page uses anatomy strip without gutter mosaic', () => {
  assert.doesNotMatch(detailPageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(detailPageSource, /LAW_EDITION_MOSAIC_SEED/);
  assert.match(detailSectionsSource, /LawAnatomyStrip/);
  assert.match(anatomySource, /EditionFactIcon/);
});

test('law browse lede preserved without em dashes', () => {
  assert.match(browsePageSource, /LAW_EDITION_BROWSE_LEDE/);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /—/);
});
