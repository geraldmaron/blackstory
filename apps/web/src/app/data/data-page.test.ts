/**
 * `/data` wiring: the ledger room owns census, Lives, and indicator figures.
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
  DATA_SOURCE_LIBRARY_HANDOFF,
} from './data-copy';
import { DATA_PAGE_INDICATOR_FIXTURE_BUNDLE } from '@repo/domain/statistics/data-page-series';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'DataSections.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'data-copy.ts'), 'utf8');
const loaderSource = readFileSync(join(here, 'load-data-page-model.ts'), 'utf8');

const allCopy = [
  DATA_PAGE_DESCRIPTION,
  DATA_INTRO.kicker,
  DATA_INTRO.lede,
  ...DATA_READING_RULES.flatMap((rule) => [rule.kicker, rule.body]),
  ...DATA_READING_LINKS.map((link) => link.label),
  DATA_SOURCE_LIBRARY_HANDOFF.label,
  ...Object.values(DATA_SECTION_COPY).flatMap((section) => [
    section.kicker,
    section.title,
    section.lede,
  ]),
  ...DATA_PAGE_SECTIONS.map((section) => section.label),
];

test('data index is the ledger room, not a redirect into a merged hub', () => {
  assert.match(pageSource, /loadDataPageModel/);
  assert.doesNotMatch(pageSource, /loadLivesAreaBundle/);
  assert.match(pageSource, /<DataSections/);
  assert.doesNotMatch(pageSource, /how-it-works/);
  assert.doesNotMatch(pageSource, /SectionFocus/);
  assert.match(loaderSource, /export async function loadDataPageModel/);
});

test('lives is an immersive room; Data Act II is a compact door into it', () => {
  const livesIndex = readFileSync(join(here, '../lives/page.tsx'), 'utf8');
  const livesRegion = readFileSync(join(here, '../lives/[region]/page.tsx'), 'utf8');
  const livesExplorer = readFileSync(join(here, '../lives/explorer/page.tsx'), 'utf8');
  assert.match(livesIndex, /LivesMilestoneExperience/);
  assert.doesNotMatch(livesIndex, /permanentRedirect/);
  assert.match(livesRegion, /permanentRedirect/);
  assert.match(livesExplorer, /LivesTimeline/);
  assert.match(sectionsSource, /Open Lives/);
  assert.doesNotMatch(sectionsSource, /LivesAreaNav/);
});

test('legacy \\?s=lives on /data rewrites to the hash deep link', () => {
  assert.match(pageSource, /firstValue\(raw\.s\)/);
  assert.match(pageSource, /buildLivesHref/);
});

test('data sections keep census and indicator chart wiring', () => {
  assert.match(sectionsSource, /PopulationDecadeSpine/);
  assert.match(sectionsSource, /PopulationByDecadeChart/);
  assert.match(sectionsSource, /BlackPopulationShareChart/);
  assert.match(sectionsSource, /GapMagnitudeSight/);
  assert.match(sectionsSource, /RacePairComparisonChart/);
  assert.match(sectionsSource, /GroupedBarIndicatorChart/);
  assert.match(sectionsSource, /StatePopulationShiftChart/);
  assert.match(sectionsSource, /TrendLineChart/);
  assert.match(sectionsSource, /href="\/lives"/);
  assert.match(sectionsSource, /id="counted"/);
  assert.match(sectionsSource, /id="lives"/);
  assert.match(sectionsSource, /id="gaps"/);
  assert.doesNotMatch(sectionsSource, /UtilityCard|ds-data-edition/);
});

test('data page keeps section anchors for the section rail', () => {
  for (const section of DATA_PAGE_SECTIONS) {
    assert.match(sectionsSource, new RegExp(`id="${section.id}"`));
    assert.ok(section.icon, `${section.id} carries a section glyph`);
  }
  assert.match(sectionsSource, /DataPageNav sections=\{DATA_PAGE_SECTIONS\}/);
  assert.match(sectionsSource, /DestinationIcon/);
  assert.match(sectionsSource, /ds-kicker-glyph/);
});

test('reading rules carry orientation glyphs', () => {
  for (const rule of DATA_READING_RULES) {
    assert.ok(rule.icon, `${rule.kicker} carries a rule glyph`);
  }
  assert.match(sectionsSource, /rule\.icon/);
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

test('data reading section links to the source library room', () => {
  assert.equal(DATA_SOURCE_LIBRARY_HANDOFF.href, '/sources');
  assert.match(sectionsSource, /DATA_SOURCE_LIBRARY_HANDOFF/);
  assert.match(sectionsSource, /ds-data-reading__handoff/);
  assert.equal(DATA_SOURCE_LIBRARY_HANDOFF.label, 'Where these figures come from');
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
