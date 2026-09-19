/**
 * Owns the complete no-JavaScript fallback in one SSR boundary. Nested client links and
 * controls must resolve together; streamed placeholders inside noscript are inert text
 * in a scripting-enabled browser and cannot be patched by React's stream runtime.
 */
'use client';

import React from 'react';
import { FilterBar } from '@repo/ui';
import { SynchronizedResultList } from '../components/map-experience/SynchronizedResultList';
import type { ExploreMapFeature } from '../lib/map-experience/build-explore-map-source';
import type { AtlasShellModel } from './explore/explore-view-model-wire';

void React;

type DoorNoscriptProps = {
  readonly view:
    (AtlasShellModel & { readonly filteredFeatures: readonly ExploreMapFeature[] }) | null;
};

export function DoorNoscript({ view: noscriptView }: DoorNoscriptProps) {
  return (
    <noscript>
      {noscriptView ? (
        <div className="ds-explore__noscript ds-container ds-page">
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
                defaultValue: noscriptView.viewState.filters.kind,
                options: noscriptView.facetOptions.kind,
              },
              {
                id: 'explore-tone-njs',
                name: 'tone',
                label: 'Tone',
                type: 'select',
                defaultValue: noscriptView.viewState.filters.tone,
                options: noscriptView.facetOptions.tone,
              },
              {
                id: 'explore-era-njs',
                name: 'era',
                label: 'Era',
                type: 'select',
                defaultValue: noscriptView.viewState.filters.era,
                options: noscriptView.facetOptions.era,
              },
              {
                id: 'explore-theme-njs',
                name: 'theme',
                label: 'Theme',
                type: 'select',
                defaultValue: noscriptView.viewState.filters.theme,
                options: noscriptView.facetOptions.theme,
              },
              {
                id: 'explore-status-njs',
                name: 'status',
                label: 'Status',
                type: 'select',
                defaultValue: noscriptView.viewState.filters.status,
                options: noscriptView.facetOptions.status,
              },
              {
                id: 'explore-confidence-njs',
                name: 'confidence',
                label: 'Confidence',
                type: 'select',
                defaultValue: noscriptView.viewState.filters.confidence,
                options: noscriptView.facetOptions.confidence,
              },
              {
                id: 'explore-state-njs',
                name: 'state',
                label: 'Where',
                type: 'select',
                defaultValue: noscriptView.viewState.state ?? 'all',
                options: noscriptView.facetOptions.state,
              },
            ]}
          />
          <p className="ds-sans ds-explore__results-count" id="explore-results-heading-njs">
            {noscriptView.totalMatched} documented record
            {noscriptView.totalMatched === 1 ? '' : 's'} matching filters · oldest first
          </p>
          <SynchronizedResultList
            features={noscriptView.filteredFeatures}
            labelledBy="explore-results-heading-njs"
          />
          {noscriptView.totalMatched > noscriptView.filteredFeatures.length ? (
            <p className="ds-sans ds-explore__results-count">
              Showing the first {noscriptView.filteredFeatures.length} of{' '}
              {noscriptView.totalMatched}. Enable JavaScript for the full map and records list, or
              browse every record at <a href="/records">/records</a>.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="ds-door__noscript">
          The map on this page needs JavaScript. <a href="/records">Browse the records</a> instead.
        </p>
      )}
    </noscript>
  );
}
