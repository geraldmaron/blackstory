/**
 * `/data` wiring: the ledger now lives in `/apparatus#data`. This route 308s there; chart
 * sections and copy stay covered here so the apparatus composition cannot lose them.
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
const apparatusSource = readFileSync(join(here, '../apparatus/page.tsx'), 'utf8');
const loaderSource = readFileSync(join(here, 'load-data-page-model.ts'), 'utf8');

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

test('data index 308s into the apparatus Data section', () => {
  assert.match(pageSource, /permanentRedirect\('\/apparatus\?s=data'\)/);
});

test('lives index and region pages 308 into the apparatus Lives figures', () => {
  const livesIndex = readFileSync(join(here, '../lives/page.tsx'), 'utf8');
  const livesRegion = readFileSync(join(here, '../lives/[region]/page.tsx'), 'utf8');
  assert.match(livesIndex, /permanentRedirect\('\/apparatus\?s=lives'\)/);
  assert.match(livesRegion, /permanentRedirect\(buildLivesHref/);
});

test('apparatus inlines DataSections through the shared loader', () => {
  assert.match(apparatusSource, /loadDataPageModel/);
  assert.match(apparatusSource, /loadLivesAreaBundle/);
  assert.match(apparatusSource, /<DataSections/);
  assert.match(loaderSource, /export async function loadDataPageModel/);
});

test('data sections keep census and indicator chart wiring', () => {
  assert.match(sectionsSource, /PopulationByDecadeChart/);
  assert.match(sectionsSource, /BlackPopulationShareChart/);
  assert.match(sectionsSource, /RacePairComparisonChart/);
  assert.match(sectionsSource, /GroupedBarIndicatorChart/);
  assert.match(sectionsSource, /StatePopulationShiftChart/);
  assert.match(sectionsSource, /TrendLineChart/);
  assert.match(sectionsSource, /LivesClassSharesChart|LivesTimeline/);
  assert.match(sectionsSource, /id="lives"/);
  assert.doesNotMatch(sectionsSource, /UtilityCard|ds-data-edition/);
});

test('data page keeps section anchors for the section rail', () => {
  for (const section of DATA_PAGE_SECTIONS) {
    assert.match(sectionsSource, new RegExp(`id="${section.id}"`));
  }
  assert.match(sectionsSource, /DataPageNav sections=\{DATA_PAGE_SECTIONS\}/);
});

test('the headline band links into the figures it summarizes', () => {
  for (const anchor of [
    '#population-count',
    '#wealth-gap',
    '#housing-ownership',
    '#justice-imprisonment',
  ]) {
    assert.match(loaderSource, new RegExp(anchor));
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
    bundle.wealthRatioLongArc,
    bundle.imprisonmentComparison,
    bundle.cookHomeownership,
    bundle.nationalHomeownershipLongArc,
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
