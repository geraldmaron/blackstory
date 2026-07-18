/**
 * SSR markup smoke tests for `/data` page SVG charts — key labels present, no fabricated
 * zeros when input aggregates are empty.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { HateCrimeYearSummary, NationalPopulationByDecade } from '@repo/firebase';
import { HateCrimeCompositionChart } from './HateCrimeCompositionChart';
import { PopulationByDecadeChart } from './PopulationByDecadeChart';

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
