/**
 * Data v6 page wiring: shared gutter mosaic, preserved chart sections, no legacy mast.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DATA_INTRO,
  DATA_ORIENTATION_BEATS,
  DATA_PAGE_DESCRIPTION,
  DATA_PAGE_SECTIONS,
  DATA_SECTION_COPY,
} from './data-copy';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'data-copy.ts'), 'utf8');

test('data page uses shared EditionAtmosphereMosaic and v6 edition root', () => {
  assert.match(pageSource, /EditionAtmosphereMosaic/);
  assert.match(pageSource, /DATA_EDITION_MOSAIC_SEED/);
  assert.match(pageSource, /dataEditionRootClassName/);
  assert.doesNotMatch(pageSource, /ds-page__title/);
  assert.doesNotMatch(pageSource, /data\.css/);
});

test('data page preserves census and indicator chart wiring', () => {
  assert.match(sectionsSource, /PopulationByDecadeChart/);
  assert.match(sectionsSource, /BlackPopulationShareChart/);
  assert.match(sectionsSource, /RacePairComparisonChart/);
  assert.match(sectionsSource, /GroupedBarIndicatorChart/);
  assert.match(sectionsSource, /StatePopulationShift/);
  assert.match(sectionsSource, /DataStatStrip/);
});

test('data page keeps section anchors for on-page navigation', () => {
  for (const section of DATA_PAGE_SECTIONS) {
    assert.match(sectionsSource, new RegExp(`id="${section.id}"`));
  }
});

test('data user-facing copy avoids em dashes', () => {
  const strings = [
    DATA_PAGE_DESCRIPTION,
    DATA_INTRO.kicker,
    DATA_INTRO.lede,
    ...DATA_ORIENTATION_BEATS.flatMap((beat) => [beat.kicker, beat.body]),
    ...Object.values(DATA_SECTION_COPY).flatMap((section) => [
      section.kicker,
      section.title,
      section.lede,
    ]),
    ...DATA_PAGE_SECTIONS.map((section) => section.label),
  ];
  for (const value of strings) {
    assert.doesNotMatch(value, /—/);
  }
  assert.doesNotMatch(copySource, /—/);
});
