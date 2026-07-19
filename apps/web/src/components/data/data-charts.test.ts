/**
 * SSR markup smoke tests for `/data` page SVG charts — key labels present, no fabricated
 * zeros when input aggregates are empty.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { HateCrimeYearSummary, NationalPopulationByDecade, OpportunityAtlasCoverageSummary } from '@repo/firebase';
import { HateCrimeCompositionChart } from './HateCrimeCompositionChart';
import { HateCrimeYearSeriesChart } from './HateCrimeYearSeriesChart';
import { OpportunityAtlasCoverageChart } from './OpportunityAtlasCoverageChart';
import { PopulationByDecadeChart } from './PopulationByDecadeChart';
import { StatePopulationShiftChart } from './StatePopulationShiftChart';

const SAMPLE_POPULATION: readonly NationalPopulationByDecade[] = [
  {
    decade: '2000',
    countyCount: 3141,
    totalPopulation: 281421906,
    blackPopulation: 34658190,
    source: 'U.S. Census Bureau, Summary File 1',
    sourceUrl: 'https://www.census.gov/data/datasets/2000/dec/summary-file-1.html',
  },
  {
    decade: '2010',
    countyCount: 3143,
    totalPopulation: 308745538,
    blackPopulation: 38929259,
    source: 'U.S. Census Bureau, Summary File 1',
    sourceUrl: 'https://www.census.gov/data/datasets/2010/dec/summary-file-1.html',
  },
  {
    decade: '2020',
    countyCount: 3143,
    totalPopulation: 331449281,
    blackPopulation: 41104607,
    source: 'U.S. Census Bureau, Decennial Census P.L. 94-171',
    sourceUrl: 'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
  },
];

test('PopulationByDecadeChart renders decade labels and share annotations', () => {
  const html = renderToStaticMarkup(createElement(PopulationByDecadeChart, { rows: SAMPLE_POPULATION }));
  assert.match(html, /2000/);
  assert.match(html, /2010/);
  assert.match(html, /2020/);
  assert.match(html, /Black population by census decade/);
  assert.match(html, /12\.3%/);
  assert.match(html, /U\.S\. Census Bureau/);
});

test('PopulationByDecadeChart returns nothing when rows are empty', () => {
  const html = renderToStaticMarkup(createElement(PopulationByDecadeChart, { rows: [] }));
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
      { field: 'kfrBlackP25', label: 'Household income rank (Black children, parents p25)', tractCount: 3 },
      { field: 'kfrWhiteP25', label: 'Household income rank (white children, parents p25)', tractCount: 1 },
    ],
    kfrBlackP25Histogram: [
      { id: '0-20', label: '0–20th', minInclusive: 0, maxExclusive: 0.2, tractCount: 1 },
      { id: '80-100', label: '80–100th', minInclusive: 0.8, maxExclusive: 1.0000001, tractCount: 2 },
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
});
