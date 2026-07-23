/**
 * Unit coverage for homepage scroll beats (edition orchestrator, place entry,
 * featured carousel shell, data band, methodology, atlas preview).
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
import { HomeAtlasRewind } from './HomeAtlasRewind';
import { HomeDataPulse } from './HomeDataPulse';
import { HomeEdition } from './HomeEdition';
import { HomeFeaturedRecord } from './HomeFeaturedRecord';
import { HomeHowThisWorks } from './HomeHowThisWorks';
import { eraFactFor, evidenceFactFor, evidenceTierFor } from './home-entity-facts';

void React;

const SAMPLE_FEATURED = [
  {
    id: 'ent_dunbar_school_001',
    kind: 'school',
    jurisdictionLabel: 'Washington, D.C.',
    displayName: 'Dunbar High School',
    summary: 'A landmark school with records tied to Washington, D.C.',
    eraBuckets: ['1920', '1930'],
    locationPrecision: 'campus' as const,
    geoAnchor: { lat: 38.9098, lng: -77.0143 },
    claims: [{ confidenceLevel: 'high' as const }],
  },
  {
    id: 'ent_15th_st_church_001',
    kind: 'institution',
    jurisdictionLabel: 'Washington, D.C.',
    displayName: '15th Street Presbyterian Church',
    summary: 'Institution records anchored to downtown Washington.',
    era: '1800s',
    locationPrecision: 'neighborhood' as const,
    geoAnchor: { lat: 38.9126, lng: -77.0366 },
    claims: [{ confidenceLevel: 'medium' as const }, { confidenceLevel: 'medium' as const }],
  },
] as const;

describe('HomeAbout beat 01', () => {
  it('renders edition header, place controls stub, and entry facts', () => {
    function OrientStub() {
      return <p>Orient stub</p>;
    }

    const html = renderToStaticMarkup(
      <HomeAbout
        topStates={[{ postalCode: 'DC', name: 'District of Columbia', count: 94 }]}
        OrientControl={OrientStub}
      />,
    );
    assert.match(html, /id="beat-a"/);
    assert.match(html, /Your place/);
    assert.match(html, /Enter through geography/);
    assert.match(html, /How entry works/);
    assert.match(html, /Pin/);
    assert.match(html, /Browse/);
    assert.match(html, /Source/);
    assert.match(html, /ds-edition-fact-icon--entry/);
    assert.match(html, /Orient stub/);
    assert.doesNotMatch(html, /History, pinned to/);
    assert.doesNotMatch(html, /ds-home-about__pillar/);
  });
});

describe('HomeHowThisWorks beat 04', () => {
  it('renders pipeline sketch, publish rules, dignity line, and methodology CTA', () => {
    const html = renderToStaticMarkup(<HomeHowThisWorks />);
    assert.match(html, /id="beat-d"/);
    assert.match(html, /Evidence before assertion/);
    assert.match(html, /How records reach the map/);
    assert.match(html, /ds-pipeline-sketch--compact/);
    assert.match(html, /Every record is documented/);
    assert.match(html, /Contradictions stay visible/);
    assert.match(html, /Dignity is a rule, not a tone/);
    assert.match(html, /ds-home-edition__dignity-line/);
    assert.match(html, /href="\/methodology"/);
    assert.match(html, /ds-cta--copper/);
    assert.doesNotMatch(html, /ds-band/);
  });
});

describe('HomeDataPulse beat 03', () => {
  it('renders archive strip and data hand-off when census rows are absent', () => {
    const html = renderToStaticMarkup(
      <HomeDataPulse recordCount={104} stateCount={24} eraSpan="1820s–1970s" />,
    );
    assert.match(html, /What the numbers show/);
    assert.match(html, /104/);
    assert.match(html, /Records pinned/);
    assert.match(html, /1820s to 1970s/);
    assert.match(html, /href="\/data"/);
    assert.match(html, /not available here yet/);
    assert.match(html, /ds-home-edition__beat--deep/);
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
      changes: [],
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
    assert.doesNotMatch(html, /decade-to-decade change/i);
  });
});

describe('HomeAtlasRewind beat 05', () => {
  it('renders paused timeline preview and atlas CTA', () => {
    const html = renderToStaticMarkup(<HomeAtlasRewind />);
    assert.match(html, /id="beat-e"/);
    assert.match(html, /Atlas rewind/);
    assert.match(html, /Scrub time on the map/);
    assert.match(html, /href="\/explore"/);
    assert.match(html, /Open the full atlas/);
    assert.match(html, /1790/);
    assert.match(html, /Today/);
  });
});

describe('HomeFeaturedRecord beat 02', () => {
  it('renders full-set browse controls with ordered/random toggle', () => {
    const html = renderToStaticMarkup(<HomeFeaturedRecord featured={SAMPLE_FEATURED} />);
    assert.match(html, /id="beat-b"/);
    assert.match(html, /aria-label="Featured records"/);
    assert.match(html, /ds-record-browse/);
    assert.match(html, /Browse mode/);
    assert.match(html, /1 \/ 2/);
    assert.match(html, /Dunbar High School/);
    assert.match(html, /Also in this release/);
    assert.match(html, /ds-record-anatomy/);
    assert.match(html, /ds-edition-fact-icon--kind-muted/);
    assert.match(html, /ds-edition-fact-icon--evidence-high/);
    assert.match(html, /ds-edition-fact-icon--where/);
    assert.match(html, /ds-edition-fact-icon--era/);
    assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=/);
    assert.match(html, /aria-label="Open Washington, D\.C\. in maps"/);
    assert.match(html, /ds-record-anatomy__place-link/);
  });

  it('starts at initialIndex when provided', () => {
    const html = renderToStaticMarkup(
      <HomeFeaturedRecord featured={SAMPLE_FEATURED} initialIndex={1} />,
    );
    assert.match(html, /ds-home-edition__record-name">15th Street Presbyterian Church/);
    assert.match(html, /2 \/ 2/);
    assert.match(html, /ds-record-browse__dot" aria-label="Record 2" aria-current="true"/);
  });
});

describe('HomeEdition orchestrator', () => {
  it('composes all five beats with OrientControl override', () => {
    function OrientStub() {
      return <p>Orient stub</p>;
    }

    const html = renderToStaticMarkup(
      <HomeEdition
        featured={SAMPLE_FEATURED}
        topStates={[]}
        recordCount={12}
        stateCount={4}
        OrientControl={OrientStub}
      />,
    );
    assert.match(html, /id="beat-a"/);
    assert.match(html, /id="beat-b"/);
    assert.match(html, /id="beat-c"/);
    assert.match(html, /id="beat-d"/);
    assert.match(html, /id="beat-e"/);
    assert.match(html, /Orient stub/);
    assert.match(html, /aria-label="Featured records"/);
    assert.match(html, /ds-record-browse/);
    assert.match(html, /Browse mode/);
    assert.match(html, /Dunbar High School/);
    assert.match(html, /Also in this release/);
    assert.doesNotMatch(html, /ds-story-rail/);
  });
});

describe('home-entity-facts', () => {
  it('formats era and evidence strings without em dashes', () => {
    assert.equal(
      eraFactFor({ eraBuckets: ['1930', '1940'], era: '1930s–1940s' }),
      '1930s to 1940s',
    );
    assert.match(evidenceFactFor([{ confidenceLevel: 'high' }]), /Grade A · 1 source/);
    assert.equal(evidenceTierFor([{ confidenceLevel: 'high' }]), 'high');
  });
});
