/**
 * SSR markup smoke tests for the `/data` plain drawings and the registry figures built on them:
 * key labels present, the table carrying what the drawing shows, and nothing to draw meaning no
 * figure at all, never a fabricated zero.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { formatSharePct } from './chart-utils';
import { PopulationByDecadeChart } from './PopulationByDecadeChart';
import { RacePairComparisonChart } from './RacePairComparisonChart';
import { GroupedBarIndicatorChart } from './GroupedBarIndicatorChart';
import { StatePopulationShiftChart, stateShiftRows } from './StatePopulationShiftChart';
import { D03 } from './figures/census';
import { pairData, seriesData } from './figures/indicators';
import { FIGURES } from './figures/registry';
import { TrendLineChart } from './TrendLineChart';
import { DATA_PAGE_INDICATOR_FIXTURE_BUNDLE } from '@repo/domain/statistics/data-page-series';

function timelineRow(
  partial: Partial<NationalPopulationTimelineRow> &
    Pick<NationalPopulationTimelineRow, 'decade' | 'year' | 'totalPopulation' | 'blackPopulation'>,
): NationalPopulationTimelineRow {
  return {
    freeBlackPopulation: null,
    enslavedBlackPopulation: null,
    blackShareOfTotalPct: (partial.blackPopulation / partial.totalPopulation) * 100,
    raceCategoryLabel: 'Black',
    nationalSource: 'twps0056',
    sourceId: 'us-census-historical-race-1790-1990',
    sourceUrl: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
    opensDefinitionBoundary: partial.decade === '2000',
    southernUndercountCaveat: partial.decade === '1870',
    hasFreeEnslavedSplit: partial.freeBlackPopulation != null,
    ...partial,
  };
}

const SAMPLE_TIMELINE: readonly NationalPopulationTimelineRow[] = [
  timelineRow({
    decade: '1790',
    year: 1790,
    totalPopulation: 3929214,
    blackPopulation: 757208,
    freeBlackPopulation: 59527,
    enslavedBlackPopulation: 697681,
    raceCategoryLabel: 'Enslaved persons and free colored persons',
  }),
  timelineRow({
    decade: '2000',
    year: 2000,
    totalPopulation: 281421906,
    blackPopulation: 34658190,
    raceCategoryLabel: 'Black or African American alone',
  }),
  timelineRow({
    decade: '2010',
    year: 2010,
    totalPopulation: 308745538,
    blackPopulation: 38929259,
  }),
  timelineRow({
    decade: '2020',
    year: 2020,
    totalPopulation: 331449281,
    blackPopulation: 41104607,
  }),
];

const SAMPLE_SOURCES = [
  {
    label: 'U.S. Census Bureau, Working Paper 56',
    url: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
  },
] as const;

const numbers = (table: { readonly rows: readonly (readonly { readonly text: string }[])[] }) =>
  table.rows.map((row) => row.map((cell) => cell.text).join(' | ')).join('\n');

test('the population drawing shows the 1790 to 2020 span and the 2000 boundary; D-03 carries the table and source', () => {
  const html = renderToStaticMarkup(
    createElement(PopulationByDecadeChart, { rows: SAMPLE_TIMELINE }),
  );
  assert.match(html, /1790/);
  assert.match(html, /2020/);
  assert.match(html, /Black alone/); // 2000 definition-boundary marker
  const figure = D03.fromRows({ rows: SAMPLE_TIMELINE, sources: SAMPLE_SOURCES });
  assert.equal(figure.title, 'Black population at each census, 1790 to 2020');
  assert.match(numbers(figure.table), /59,527/); // free count in the table
  assert.match(figure.sources[0]!.label, /U\.S\. Census Bureau/);
  assert.equal(figure.headline, 'From 757,208 Black people in 1790 to 41.1 million in 2020');
});

test('PopulationByDecadeChart keeps enslaved, free, and post-1860 total as distinct series', () => {
  const html = renderToStaticMarkup(
    createElement(PopulationByDecadeChart, { rows: SAMPLE_TIMELINE }),
  );
  // The key never conflates enslaved with the Black total under one swatch.
  assert.doesNotMatch(html, /Enslaved \/ Black total/);
  assert.match(html, /Enslaved, to \d{4}</);
  assert.match(html, />Free</);
  // Enslaved is the mid tone, free is hatched, and the total from 1870 is ink. The enslaved tone is
  // drawn once per split decade and never continues past emancipation.
  const split = SAMPLE_TIMELINE.filter((row) => row.enslavedBlackPopulation !== null).length;
  const totals = SAMPLE_TIMELINE.length - split;
  assert.equal((html.match(/class="ds-fig-bar" data-tone="mid"/g) ?? []).length, split);
  assert.equal(
    (html.match(/class="ds-fig-bar" data-tone="lo" data-hatched="true"/g) ?? []).length,
    split,
  );
  assert.equal((html.match(/class="ds-fig-bar" data-tone="hi"/g) ?? []).length, totals);
  // Copper is not a series color.
  assert.doesNotMatch(html, /--ds-viz-2|accent/);
});

test('a census with no free and enslaved split says "no data" in Numbers, never a zero or a dash', () => {
  const table = numbers(D03.fromRows({ rows: SAMPLE_TIMELINE, sources: SAMPLE_SOURCES }).table);
  // 2000, 2010, and 2020 rows carry no free/enslaved split (post-1860 total only).
  assert.match(table, /2000 \| 34,658,190 \| no data \| no data/);
  assert.doesNotMatch(table, /—/);
});

test('a figure with no rows is no figure', async () => {
  assert.equal(
    seriesData({ ...DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.hmdaDenialRates, series: [] }),
    undefined,
  );
  assert.equal(seriesData(undefined), undefined);
  const empty = { ...DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthComparison };
  assert.equal(
    pairData(
      {
        ...empty,
        primary: { ...empty.primary, value: 0 },
        comparison: { ...empty.comparison, value: 0 },
      },
      'pair',
    ),
    undefined,
  );
  // The unit drawing needs a stated multiple; a difference in points is not one.
  assert.equal(
    pairData(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.costBurdenComparison, 'ratio'),
    undefined,
  );
});

test('formatSharePct returns N/A instead of an em dash when total population is zero', () => {
  assert.equal(formatSharePct(0, 0), 'N/A');
  assert.doesNotMatch(formatSharePct(0, 0), /—/);
});

test('StatePopulationShiftChart labels Puerto Rico instead of State 72', () => {
  const html = renderToStaticMarkup(
    createElement(StatePopulationShiftChart, {
      fromDecade: '2010',
      toDecade: '2020',
      rows: stateShiftRows(
        [
          {
            stateFips: '72',
            blackAbsoluteChange: -12_000,
            shareChangePp: -0.3,
            blackPopulationTo: 900_000,
          },
        ],
        { '72': 'Puerto Rico' },
      ),
    }),
  );
  assert.match(html, /Puerto Rico/);
  assert.doesNotMatch(html, /State 72/);
});

test('the wealth pair draws both values, and its figure links the chapter behind the number', () => {
  const series = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthComparison;
  const html = renderToStaticMarkup(createElement(RacePairComparisonChart, { series }));
  assert.match(html, /\$44,900/);
  assert.match(html, /\$285,000/);
  const figure = FIGURES['D-07'].fromRows(pairData(series, 'pair')!);
  assert.match(figure.title, /Median family net worth/);
  assert.equal(figure.chapterHref, '/stories/the-gap-that-never-closed');
  assert.equal(figure.limits, series.caption);
});

test('GroupedBarIndicatorChart renders NHGIS homeownership decades', () => {
  const series = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.cookHomeownership;
  const html = renderToStaticMarkup(createElement(GroupedBarIndicatorChart, { series }));
  assert.match(html, /Homeownership by householder race/);
  assert.match(html, /1990/);
  assert.match(html, /2010/);
  assert.match(html, /37\.1%/);
  assert.match(html, /Black householder/);
});

test('TrendLineChart renders the DKKS wealth ratio benchmark years back to 1860', () => {
  const series = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthRatioLongArc;
  if (series === undefined) throw new Error('wealthRatioLongArc fixture missing');
  const html = renderToStaticMarkup(createElement(TrendLineChart, { series }));
  assert.match(html, /White-to-Black per-capita wealth ratio/);
  assert.match(html, /1860/);
  assert.match(html, /2019/);
  const table = numbers(FIGURES['D-09'].fromRows(seriesData(series)!).table);
  assert.match(table, /2019 \| 6\.6×/);
  assert.doesNotMatch(table, /1929/); // no white-side estimate that year: point is skipped
});

test('TrendLineChart renders the national homeownership long arc with two named series', () => {
  const series = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.nationalHomeownershipLongArc;
  if (series === undefined) throw new Error('nationalHomeownershipLongArc fixture missing');
  const html = renderToStaticMarkup(createElement(TrendLineChart, { series }));
  assert.match(html, /Homeownership by householder race, United States/);
  assert.match(html, /Black householder/);
  assert.match(html, /White Non-Hispanic householder/);
  assert.match(html, /1900/);
  assert.match(html, /2024/);
  assert.doesNotMatch(html, />2020</); // no standard ACS 1-year release that year
});
