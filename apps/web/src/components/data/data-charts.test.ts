/**
 * SSR markup smoke tests for `/data` page SVG charts — key labels present, no fabricated
 * zeros when input aggregates are empty.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type {
  HateCrimeYearSummary,
  NationalPopulationTimelineRow,
  OpportunityAtlasCoverageSummary,
} from '@repo/firebase';
import { HateCrimeCompositionChart } from './HateCrimeCompositionChart';
import { HateCrimeYearSeriesChart } from './HateCrimeYearSeriesChart';
import {
  compactOutcomeFieldLabel,
  OpportunityAtlasCoverageChart,
} from './OpportunityAtlasCoverageChart';
import { PopulationByDecadeChart } from './PopulationByDecadeChart';
import { StatePopulationShiftChart } from './StatePopulationShiftChart';

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

test('PopulationByDecadeChart renders the 1790–2020 span, the 2000 boundary, and a source', () => {
  const html = renderToStaticMarkup(
    createElement(PopulationByDecadeChart, { rows: SAMPLE_TIMELINE, sources: SAMPLE_SOURCES }),
  );
  assert.match(html, /1790/);
  assert.match(html, /2020/);
  assert.match(html, /Black population by census decade/);
  assert.match(html, /Black alone/); // 2000 methodology-boundary marker
  assert.match(html, /59,527/); // free count in the accessible table
  assert.match(html, /U\.S\. Census Bureau/);
});

test('PopulationByDecadeChart keeps enslaved, free, and post-1860 total as distinct series', () => {
  const html = renderToStaticMarkup(
    createElement(PopulationByDecadeChart, { rows: SAMPLE_TIMELINE, sources: SAMPLE_SOURCES }),
  );
  // Legend must not conflate enslaved with Black total under one swatch.
  assert.doesNotMatch(html, /Enslaved \/ Black total/);
  assert.match(html, /Enslaved \(1790–1860\)/);
  assert.match(html, /Free \(1790–1860\)/);
  assert.match(html, /Black population \(1870–2020\)/);
  // Copper (viz-2) is reserved for the enslaved segment; post-1860 totals use ink (viz-1).
  assert.match(html, /fill="var\(--ds-viz-2\)"/);
  assert.match(html, /fill="var\(--ds-viz-4\)"/);
  assert.match(html, /fill="var\(--ds-viz-1\)"/);
  assert.doesNotMatch(html, /fillOpacity/);
});

test('PopulationByDecadeChart returns nothing when rows are empty', () => {
  const html = renderToStaticMarkup(
    createElement(PopulationByDecadeChart, { rows: [], sources: [] }),
  );
  assert.equal(html, '');
  assert.doesNotMatch(html, />0</);
});

test('HateCrimeCompositionChart labels both composition series and participation', () => {
  const summary: HateCrimeYearSummary = {
    year: '2024',
    incidents: 1000,
    antiBlackIncidents: 620,
    reportingCountyYears: 800,
    nationalParticipatingAgenciesPct: 87.4,
    source: 'FBI Crime Data Explorer',
    sourceUrl: 'https://ucr.fbi.gov/hate-crime',
  };
  const html = renderToStaticMarkup(createElement(HateCrimeCompositionChart, { summary }));
  assert.match(html, /Anti-Black or African American bias/);
  assert.match(html, /Other reported bias categories/);
  assert.match(html, /87\.4%/);
  assert.match(html, /620/);
  assert.match(html, /380/);
});

test('HateCrimeCompositionChart returns nothing when incidents are zero', () => {
  const summary: HateCrimeYearSummary = {
    year: '2024',
    incidents: 0,
    antiBlackIncidents: 0,
    reportingCountyYears: 0,
    source: 'FBI Crime Data Explorer',
    sourceUrl: 'https://ucr.fbi.gov/hate-crime',
  };
  const html = renderToStaticMarkup(createElement(HateCrimeCompositionChart, { summary }));
  assert.equal(html, '');
  assert.doesNotMatch(html, />0</);
});

test('HateCrimeYearSeriesChart renders per-year share and participation labels', () => {
  const summaries: readonly HateCrimeYearSummary[] = [
    {
      year: '2020',
      incidents: 800,
      antiBlackIncidents: 480,
      reportingCountyYears: 700,
      nationalParticipatingAgenciesPct: 85,
      source: 'FBI Crime Data Explorer',
      sourceUrl: 'https://ucr.fbi.gov/hate-crime',
    },
    {
      year: '2024',
      incidents: 1000,
      antiBlackIncidents: 620,
      reportingCountyYears: 800,
      nationalParticipatingAgenciesPct: 87.4,
      source: 'FBI Crime Data Explorer',
      sourceUrl: 'https://ucr.fbi.gov/hate-crime',
    },
  ];
  const html = renderToStaticMarkup(createElement(HateCrimeYearSeriesChart, { summaries }));
  assert.match(html, /Reporting metrics by year/);
  assert.match(html, /Anti-Black share of reported incidents/);
  assert.match(html, /Agencies participating nationally/);
  assert.match(html, /2020/);
  assert.match(html, /2024/);
});

test('StatePopulationShiftChart labels Puerto Rico instead of State 72', () => {
  const html = renderToStaticMarkup(
    createElement(StatePopulationShiftChart, {
      fromDecade: '2010',
      toDecade: '2020',
      changes: [
        {
          stateFips: '72',
          blackAbsoluteChange: -12_000,
          shareChangePp: -0.3,
          blackPopulationTo: 900_000,
        },
      ],
      stateNameByFips: { '72': 'Puerto Rico' },
    }),
  );
  assert.match(html, /Puerto Rico/);
  assert.doesNotMatch(html, /State 72/);
});

test('OpportunityAtlasCoverageChart renders outcome coverage and histogram bins', () => {
  const coverage: OpportunityAtlasCoverageSummary = {
    tractCount: 3,
    outcomeFieldCoverage: [
      {
        field: 'kfrBlackP25',
        label: 'Household income rank (Black children, parents p25)',
        tractCount: 3,
      },
      {
        field: 'kfrWhiteP25',
        label: 'Household income rank (white children, parents p25)',
        tractCount: 1,
      },
    ],
    kfrBlackP25Histogram: [
      { id: '0-20', label: '0–20th', minInclusive: 0, maxExclusive: 0.2, tractCount: 1 },
      {
        id: '80-100',
        label: '80–100th',
        minInclusive: 0.8,
        maxExclusive: 1.0000001,
        tractCount: 2,
      },
    ],
    source: 'Opportunity Insights',
    sourceUrl: 'https://opportunityinsights.org/data/',
    license: 'Opportunity Insights data-use terms — attribution required',
  };
  const html = renderToStaticMarkup(createElement(OpportunityAtlasCoverageChart, { coverage }));
  assert.match(html, /Outcome field coverage/);
  assert.match(html, /kfrBlackP25 tract distribution/);
  assert.match(html, /0–20th/);
  assert.match(html, /Opportunity Insights/);
  // Horizontal bars: compact axis labels + full names in the accessible table.
  assert.match(html, /Income \(Black, p25\)/);
  assert.match(html, /Household income rank \(Black children, parents p25\)/);
  assert.match(html, /text-anchor="end"/);
});

test('compactOutcomeFieldLabel shortens long Opportunity Atlas field names', () => {
  assert.equal(
    compactOutcomeFieldLabel('Household income rank (Black children, parents p25)'),
    'Income (Black, p25)',
  );
  assert.equal(
    compactOutcomeFieldLabel('Incarceration rate (pooled, parents p25)'),
    'Jail (pooled, p25)',
  );
});
