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

test('data page renders through the room kit, with no edition chrome left', () => {
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(pageSource, /DATA_EDITION_MOSAIC_SEED/);
  // The v6 edition root is gone; the shared kit draws the room. A per-route chrome surviving next
  // to the kit is the drift this package exists to remove.
  assert.doesNotMatch(pageSource, /dataEditionRootClassName/);
  assert.match(pageSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(pageSource, /<Room>/);
  assert.match(pageSource, /<RoomHeader/);
  assert.doesNotMatch(pageSource, /ds-page__title/);
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

test('data user-facing copy does not leak Phase 1 or warehouse', () => {
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
    assert.doesNotMatch(value, /Phase 1|warehouse|fixture-backed/i);
  }
  assert.doesNotMatch(copySource, /Phase 1|warehouse|fixture-backed/i);
  assert.doesNotMatch(pageSource, /Phase 1|warehouse|fixture-backed/i);
  assert.doesNotMatch(sectionsSource, /Phase 1|warehouse|fixture-backed/i);
  assert.doesNotMatch(sectionsSource, /href="\/explore"/);
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
