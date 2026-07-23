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

test('law browse page uses shared EditionAtmosphereMosaic and edition stack', () => {
  assert.match(browsePageSource, /EditionAtmosphereMosaic/);
  assert.match(browsePageSource, /LAW_EDITION_MOSAIC_SEED/);
  assert.match(browsePageSource, /data-law-edition="v6"/);
  assert.doesNotMatch(browsePageSource, /ds-page__title/);
});

test('law browse preserves GET URL contract and auto-submit facets', () => {
  assert.match(browseSectionsSource, /method="get"/);
  assert.match(browseSectionsSource, /action="\/law"/);
  assert.match(browseSectionsSource, /AutoSubmitSelect/);
  assert.match(browseSectionsSource, /name="q"/);
  assert.match(browseSectionsSource, /name="kind"/);
  assert.match(browseSectionsSource, /name="topic"/);
  assert.match(browseSectionsSource, /href="\/law"/);
});

test('law detail page uses per-slug mosaic seed and anatomy strip', () => {
  assert.match(detailPageSource, /EditionAtmosphereMosaic/);
  assert.match(detailPageSource, /\$\{LAW_EDITION_MOSAIC_SEED\}:\$\{slug\}/);
  assert.match(detailSectionsSource, /LawAnatomyStrip/);
  assert.match(anatomySource, /EditionFactIcon/);
});

test('law browse lede preserved without em dashes', () => {
  assert.match(browsePageSource, /LAW_EDITION_BROWSE_LEDE/);
  assert.doesNotMatch(LAW_EDITION_BROWSE_LEDE, /—/);
});
