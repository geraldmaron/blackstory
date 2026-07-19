/**
 * Unit coverage for homepage About + data-pulse composition helpers and copy contracts.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeAbout } from './HomeAbout';
import { HomeDataPulse } from './HomeDataPulse';

void React;

describe('HomeAbout', () => {
  it('renders product thesis, pillars, and primary CTAs', () => {
    function OrientStub() {
      return <p>Orient stub</p>;
    }

    const html = renderToStaticMarkup(
      <HomeAbout
        topStates={[{ postalCode: 'DC', name: 'District of Columbia', count: 94 }]}
        OrientControl={OrientStub}
      />,
    );
    assert.match(html, /History, pinned to place/);
    assert.match(html, /Presence/);
    assert.match(html, /Evidence/);
    assert.match(html, /Dignity/);
    assert.match(html, /href="\/explore"/);
    assert.match(html, /href="\/about"/);
    assert.match(html, /Orient stub/);
  });
});

describe('HomeDataPulse', () => {
  it('renders archive strip and data hand-off when census rows are absent', () => {
    const html = renderToStaticMarkup(
      <HomeDataPulse recordCount={104} stateCount={24} eraSpan="1820s–1970s" />,
    );
    assert.match(html, /The numbers underneath the pins/);
    assert.match(html, /104/);
    assert.match(html, /Records pinned/);
    assert.match(html, /href="\/data"/);
    assert.match(html, /not available in this environment/);
  });

  it('renders census charts when decade rows are provided', () => {
    const rows = [
      {
        decade: '2000',
        countyCount: 100,
        totalPopulation: 281_421_906,
        blackPopulation: 34_658_190,
        source: 'Census Bureau',
        sourceUrl: 'https://www.census.gov/',
      },
      {
        decade: '2010',
        countyCount: 100,
        totalPopulation: 308_745_538,
        blackPopulation: 38_929_319,
        source: 'Census Bureau',
        sourceUrl: 'https://www.census.gov/',
      },
      {
        decade: '2020',
        countyCount: 100,
        totalPopulation: 331_449_281,
        blackPopulation: 41_104_200,
        source: 'Census Bureau',
        sourceUrl: 'https://www.census.gov/',
      },
    ] as const;

    const html = renderToStaticMarkup(
      <HomeDataPulse
        recordCount={104}
        stateCount={24}
        populationByDecade={rows}
        populationChanges={[
          {
            fromDecade: '2010',
            toDecade: '2020',
            blackAbsoluteChange: 2_174_881,
            blackPercentChange: 5.6,
            shareFrom: 12.6,
            shareTo: 12.4,
            shareChangePp: -0.2,
            source: 'Census Bureau',
            sourceUrl: 'https://www.census.gov/',
            comparabilityNote: 'Decennial race categories differ across vintages.',
          },
        ]}
      />,
    );
    assert.match(html, /Black population by census decade/);
    assert.match(html, /Black population share by decade/);
    assert.match(html, /Decade-over-decade change/);
    assert.doesNotMatch(html, /not available in this environment/);
  });
});
