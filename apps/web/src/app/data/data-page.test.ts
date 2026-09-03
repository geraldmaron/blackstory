/**
 * `/data` wiring: the room kit draws the room, every chart still renders, every section keeps
 * its anchor, and the copy stays in the archive's voice.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DATA_INTRO,
  DATA_PAGE_DESCRIPTION,
  DATA_PAGE_SECTIONS,
  DATA_READING_LINKS,
  DATA_READING_RULES,
  DATA_SECTION_COPY,
} from './data-copy';
import { DATA_PAGE_INDICATOR_FIXTURE_BUNDLE } from '@repo/domain/statistics/data-page-series';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'data-copy.ts'), 'utf8');

const allCopy = [
  DATA_PAGE_DESCRIPTION,
  DATA_INTRO.kicker,
  DATA_INTRO.lede,
  ...DATA_READING_RULES.flatMap((rule) => [rule.kicker, rule.body]),
  ...DATA_READING_LINKS.map((link) => link.label),
  ...Object.values(DATA_SECTION_COPY).flatMap((section) => [
    section.kicker,
    section.title,
    section.lede,
  ]),
  ...DATA_PAGE_SECTIONS.map((section) => section.label),
];

test('data page renders through the room kit, with no edition chrome left', () => {
  assert.doesNotMatch(pageSource, /EditionAtmosphereMosaic|DATA_EDITION_MOSAIC_SEED/);
  assert.doesNotMatch(pageSource, /dataEditionRootClassName/);
  assert.match(pageSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(pageSource, /<Room>/);
  assert.match(pageSource, /<RoomHeader/);
  assert.doesNotMatch(pageSource, /ds-page__title/);
  // The section panels are gone. A figure is framed by a rule, not a box inside a box.
  assert.doesNotMatch(sectionsSource, /UtilityCard|ds-data-edition/);
});

test('data page preserves census and indicator chart wiring', () => {
  assert.match(sectionsSource, /PopulationByDecadeChart/);
  assert.match(sectionsSource, /BlackPopulationShareChart/);
  assert.match(sectionsSource, /RacePairComparisonChart/);
  assert.match(sectionsSource, /GroupedBarIndicatorChart/);
  assert.match(sectionsSource, /StatePopulationShiftChart/);
});

test('data page keeps section anchors for the section rail', () => {
  for (const section of DATA_PAGE_SECTIONS) {
    assert.match(sectionsSource, new RegExp(`id="${section.id}"`));
  }
  assert.match(sectionsSource, /DataPageNav sections=\{DATA_PAGE_SECTIONS\}/);
});

test('the headline band links into the figures it summarises', () => {
  for (const anchor of [
    '#population-count',
    '#wealth-gap',
    '#housing-ownership',
    '#justice-imprisonment',
  ]) {
    assert.match(pageSource, new RegExp(anchor));
    const id = anchor.slice(1);
    assert.match(sectionsSource, new RegExp(`id="${id}"`), `no figure carries ${anchor}`);
  }
});

test('data user-facing copy does not leak internal vocabulary', () => {
  for (const value of allCopy) {
    assert.doesNotMatch(value, /Phase 1|warehouse|fixture-backed/i);
  }
  for (const source of [copySource, pageSource, sectionsSource]) {
    assert.doesNotMatch(source, /Phase 1|warehouse|fixture-backed/i);
  }
  // The counted breakdown of the archive is not a figure here, and the page does not send a
  // reader to the record list to find one.
  assert.doesNotMatch(sectionsSource, /href="\/explore"|href="\/records"/);
  assert.doesNotMatch(sectionsSource, /Mosaic credits|ATMOSPHERE_ATTRIBUTION|mosaic-credits/);
});

test('data user-facing copy avoids em dashes', () => {
  for (const value of allCopy) {
    assert.doesNotMatch(value, /—/);
  }
  assert.doesNotMatch(copySource, /—/);
});

test('the reading rules are not numbered: they hold at once', () => {
  assert.doesNotMatch(sectionsSource, /DATA_READING_RULES\.map\([\s\S]{0,400}index \+ 1/);
});

test('the indicator fixture captions the figures print verbatim keep the same voice', () => {
  const bundle = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE;
  const series = [
    bundle.wealthComparison,
    bundle.wealthTrend,
    bundle.imprisonmentComparison,
    bundle.cookHomeownership,
    bundle.hmdaDenialRates,
    bundle.federalDrugSentences,
    bundle.costBurdenComparison,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  for (const entry of series) {
    const strings = [
      entry.title,
      entry.caption,
      entry.geographyLabel,
      'referencePeriod' in entry ? entry.referencePeriod : '',
      'ratioLabel' in entry ? (entry.ratioLabel ?? '') : '',
    ];
    for (const value of strings) {
      assert.doesNotMatch(value, /—|–/, `${entry.id}: dashes belong to the voice rule`);
      assert.doesNotMatch(
        value,
        /Phase 1|warehouse|fixture-backed/i,
        `${entry.id}: internal vocabulary`,
      );
    }
  }
});
