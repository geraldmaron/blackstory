/**
 * Map-first national explore page: full U.S. view of every geo-anchored entity in the
 * active release, synchronized accessible results list, shareable URL state, narrative off-ramps,
 * and degraded snapshot mode. Filters use native GET navigation (no-JS safe); the client island
 * adds the interactive MapLibre canvas, cluster drill-down, and viewport URL sync.
 */
import React from 'react';
import { FilterBar } from '@repo/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { SynchronizedResultList } from '../../components/map-experience/SynchronizedResultList';
import { listPublicEntityViews } from '../../lib/public-data/source';
import { ExploreMapExperience } from './ExploreMapExperience';
import { buildExploreViewModel } from './explore-view-model';
import './explore.css';

void React;

export const metadata = {
  title: 'Explore',
  description:
    'Map-first national view of documented Black history — every geo-anchored record in the active release.',
};

type ExplorePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const entities = await listPublicEntityViews();
  const view = buildExploreViewModel(params, entities.data, entities.source);

  return (
    <main className="bb-container bb-page bb-explore-page" id="main">
      <header className="bb-explore-mast">
        <h1 className="bb-explore-mast__title">Map</h1>
        <p className="bb-explore-mast__lede">
          The premier view — click a state or circular pin, filter records, and open map settings
          for presence density, evidence-backed relationship lines, and decade scrubbing.
        </p>
      </header>

      <div className="bb-stack bb-explore-page__body">
        {view.dataSource !== 'live' ? <SeedDataNotice compact /> : null}

        <noscript>
          <div className="bb-explore__noscript">
            <FilterBar
              method="get"
              action="/explore"
              legend="Filter documented records"
              fields={[
                {
                  id: 'explore-kind-njs',
                  name: 'kind',
                  label: 'Kind',
                  type: 'select',
                  defaultValue: view.viewState.filters.kind,
                  options: view.facetOptions.kind,
                },
                {
                  id: 'explore-era-njs',
                  name: 'era',
                  label: 'Era',
                  type: 'select',
                  defaultValue: view.viewState.filters.era,
                  options: view.facetOptions.era,
                },
                {
                  id: 'explore-theme-njs',
                  name: 'theme',
                  label: 'Theme',
                  type: 'select',
                  defaultValue: view.viewState.filters.theme,
                  options: view.facetOptions.theme,
                },
                {
                  id: 'explore-confidence-njs',
                  name: 'confidence',
                  label: 'Confidence',
                  type: 'select',
                  defaultValue: view.viewState.filters.confidence,
                  options: view.facetOptions.confidence,
                },
              ]}
            />
            <p
              className="bb-sans bb-explore__results-count"
              id="explore-results-heading-njs"
            >
              {view.totalMatched} documented record{view.totalMatched === 1 ? '' : 's'} in view
            </p>
            <SynchronizedResultList
              features={view.filteredFeatures}
              labelledBy="explore-results-heading-njs"
            />
          </div>
        </noscript>

        <ExploreMapExperience initial={view} />

        <p className="bb-sans bb-explore__locate-link">
          Looking for history near you?{' '}
          <a className="bb-cta bb-cta--ink" href="/locate">
            Find your jurisdiction
          </a>
          .
        </p>
      </div>
    </main>
  );
}
