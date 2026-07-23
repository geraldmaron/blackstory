/**
 * Unit coverage for homepage About, How-this-works, and data-pulse composition.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  NationalPopulationTimelineRow,
  NationalPopulationTimelineSnapshot,
} from '@repo/domain/statistics/public-data-summaries';
import { HomeAbout } from './HomeAbout';
import { HomeDataPulse } from './HomeDataPulse';
import { HomeHowThisWorks } from './HomeHowThisWorks';
import { HomeStorySections } from './HomeStorySections';

void React;

describe('HomeAbout', () => {
  it('renders product thesis, numbered pillars, CTAs, and orient hand-off', () => {
    function OrientStub() {
      return <p>Orient stub</p>;
    }

    const html = renderToStaticMarkup(
      <HomeAbout
        topStates={[{ postalCode: 'DC', name: 'District of Columbia', count: 94 }]}
        OrientControl={OrientStub}
      />,
    );
    assert.match(html, /History, pinned to(?: <em>)?place(?:<\/em>)?\./);
    assert.match(html, /ds-home-about__intro/);
    assert.match(html, /ds-home-about__pillar-index/);
    assert.match(html, /Presence/);
    assert.match(html, /Evidence/);
    assert.match(html, /Dignity/);
    assert.match(html, /Start with a place/);
    assert.match(html, /href="\/explore"/);
    assert.match(html, /href="\/about"/);
    assert.match(html, /href="\/methodology"/);
    assert.match(html, /Orient stub/);
    assert.match(html, /href="https:\/\/geralddagher\.com"/);
    assert.match(html, /Built by/);
    assert.match(html, /Gerald Dagher/);
    assert.match(html, /gd-mark-light\.png/);
    assert.match(html, /gd-mark-dark\.png/);
  });
});

describe('HomeHowThisWorks', () => {
  it('reuses the compact research pipeline sketch with three trust points', () => {
    const html = renderToStaticMarkup(<HomeHowThisWorks />);
    assert.match(html, /How this works/);
    assert.match(html, /Evidence before assertion/);
    assert.match(html, /ds-section ds-home-how/);
    assert.doesNotMatch(html, /ds-band/);
    assert.match(html, /ds-home-how__compose/);
    assert.match(html, /ds-pipeline-sketch--compact/);
    assert.match(html, /Research pipeline: intake to publish gate/);
    assert.match(html, /viewBox="0 0 720 268"/);
    assert.match(html, /Local server/);
    assert.match(html, /Publish gate/);
    assert.match(html, /Every record is documented/);
    assert.match(html, /Contradictions stay visible/);
    assert.match(html, /Dignity is a rule, not a tone/);
    assert.match(html, /href="\/methodology"/);
    assert.match(html, /Read the methodology/);
    assert.doesNotMatch(html, /viewBox="0 0 720 824"/);
    assert.doesNotMatch(html, /never write the public projection/);
  });
});

describe('HomeStorySections', () => {
  it('composes About and How-this-works with OrientControl override', () => {
    function OrientStub() {
      return <p>Orient stub</p>;
    }

    const html = renderToStaticMarkup(
      <HomeStorySections
        featured={[]}
        topStates={[]}
        recordCount={12}
        stateCount={4}
        OrientControl={OrientStub}
      />,
    );
    assert.match(html, /History, pinned to/);
    assert.match(html, /Orient stub/);
    assert.match(html, /Evidence before assertion/);
    assert.match(html, /ds-pipeline-sketch--compact/);
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
    assert.match(html, /not available here yet/);
  });

  it('renders census charts when a timeline snapshot is provided', () => {
    const row = (
      decade: NationalPopulationTimelineRow['decade'],
      year: number,
      totalPopulation: number,
      blackPopulation: number,
    ): NationalPopulationTimelineRow => ({
      decade,
      year,
      totalPopulation,
      blackPopulation,
      freeBlackPopulation: null,
      enslavedBlackPopulation: null,
      blackShareOfTotalPct: (blackPopulation / totalPopulation) * 100,
      raceCategoryLabel: 'Black or African American alone',
      nationalSource: 'census-county-sum',
      sourceId: 'us-census-decennial-2020-pl',
      sourceUrl: 'https://www.census.gov/',
      opensDefinitionBoundary: decade === '2000',
      southernUndercountCaveat: false,
      hasFreeEnslavedSplit: false,
    });

    const timeline: NationalPopulationTimelineSnapshot = {
      rows: [
        row('2000', 2000, 281_421_906, 34_658_190),
        row('2010', 2010, 308_745_538, 38_929_319),
        row('2020', 2020, 331_449_281, 41_104_200),
      ],
      changes: [
        {
          fromDecade: '2010',
          toDecade: '2020',
          growth: {
            startObservationId: 'us_2010_black',
            endObservationId: 'us_2020_black',
            absoluteChange: 2_174_881,
            percentChange: 5.6,
            significanceResult: {
              method: 'insufficient-margin-of-error-data',
              distinguishable: null,
            },
          },
          sharePointChange: -0.2,
          crossesDefinitionBoundary: false,
        },
      ],
      sources: [
        {
          sourceId: 'us-census-decennial-2020-pl',
          sourceUrl: 'https://www.census.gov/',
          label: 'Census Bureau',
        },
      ],
      generatedAt: '2026-07-19T00:00:00.000Z',
      contentHash: 'a'.repeat(64),
    };

    const html = renderToStaticMarkup(
      <HomeDataPulse recordCount={104} stateCount={24} timeline={timeline} />,
    );
    assert.match(html, /Black population by decade/);
    assert.match(html, /Share of the U\.S\. that is Black/);
    assert.match(html, /decade-to-decade change/i);
    assert.doesNotMatch(html, /not available in this environment/);
  });
});
