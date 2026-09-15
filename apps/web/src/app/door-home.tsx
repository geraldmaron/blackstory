/**
 * `/` is the Door Immersive Journey: scroll chapters zoom the national pin field.
 *
 * Chapter order, rotating facts, and the evidence spotlight are rolled once per request
 * (same pickers as Explore StoryMode) so visits vary without loading MapLibre. Pins with
 * public hrefs are clickable. Browse morphs in place onto the same plate (filters / rail);
 * `/explore` is the same Door already armed (deep link / share / cold load).
 */
import React from 'react';
import { FilterBar } from '@repo/ui';
import { SynchronizedResultList } from '../components/map-experience/SynchronizedResultList';
import { loadDoorPinPlate } from '../lib/map-experience/door-catalog';
import { resolveDoorFocusPinId } from '../lib/map-experience/first-paint-pins';
import { KIND_FAMILY_ENTRIES, kindFamilyFor } from '../lib/map-experience/kind-encoding';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { pickStoryChapters } from '../lib/story/pick-story-chapters';
import { pickStoryRecord } from '../lib/story/pick-story-record';
import { buildAtlasShell } from './explore/explore-view-model';
import { DoorImmersive, type DoorOpenLedgerRow } from './door-immersive';
import './door-home.css';
import './explore/explore.css';

void React;

/** Rows in the `<noscript>` fallback list when cold-loading browse. Crawlable index: `/records`. */
const NOSCRIPT_ROW_CAP = 20;

/** Kind-family census for the opening masthead, stable order from KIND_FAMILY_ENTRIES. */
function buildOpenLedger(
  features: ReadonlyArray<{
    readonly properties: { readonly kind: string; readonly kindFamily?: string };
  }>,
): DoorOpenLedgerRow[] {
  const counts = new Map<string, number>();
  for (const feature of features) {
    const family =
      feature.properties.kindFamily && feature.properties.kindFamily.length > 0
        ? feature.properties.kindFamily
        : kindFamilyFor(feature.properties.kind);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return KIND_FAMILY_ENTRIES.flatMap(([family, entry]) => {
    const count = counts.get(family) ?? 0;
    return count > 0 ? [{ family, label: entry.label, count }] : [];
  });
}

export type DoorHomeProps = {
  /** Deep-link / share filters (`?state=DC`, etc.). Empty on the journey `/`. */
  readonly params?: Record<string, string | string[] | undefined>;
  /** Cold `/explore`: render already in browse posture (same shell as morph-from-home). */
  readonly initialBrowse?: boolean;
};

export async function DoorHome({ params = {}, initialBrowse = false }: DoorHomeProps = {}) {
  const { pins, features, densityLevels } = await loadDoorPinPlate();
  const { data: entities, source: dataSource } = await getSharedPublicEntities();
  const { shell, noscriptFeatures } = buildAtlasShell(params, entities, dataSource);
  const placeCount = pins.features.length.toLocaleString('en-US');
  const openLedger = buildOpenLedger(features);

  const orderRoll = Math.random();
  const recordRoll = Math.random();
  const { chapters, factByChapterId } = pickStoryChapters(orderRoll);
  const spotlight = pickStoryRecord(features, recordRoll);
  const spotlightFeature = spotlight
    ? features.find((feature) => feature.properties.entityId === spotlight.entityId)
    : undefined;
  const spotlightLngLat = spotlightFeature
    ? ([
        spotlightFeature.geometry.coordinates[0],
        spotlightFeature.geometry.coordinates[1],
      ] as const)
    : null;
  const spotlightPinId = resolveDoorFocusPinId(spotlight?.entityId ?? null, features);

  const noscriptView = initialBrowse ? { ...shell, filteredFeatures: noscriptFeatures } : null;

  return (
    <main id="main" className="ds-door">
      {/* The plate is the only map on `/` (repo-18ma2): without JavaScript there is no map at
          all, so say so once and point at the index that needs none. Cold browse keeps a
          filterable list so deep links stay useful without JS. */}
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
              features={noscriptView.filteredFeatures.slice(0, NOSCRIPT_ROW_CAP)}
              labelledBy="explore-results-heading-njs"
            />
            {noscriptView.filteredFeatures.length > NOSCRIPT_ROW_CAP ? (
              <p className="ds-sans ds-explore__results-count">
                Showing the first {NOSCRIPT_ROW_CAP} of {noscriptView.filteredFeatures.length}.
                Enable JavaScript for the full map and records list, or browse every record at{' '}
                <a href="/records">/records</a>.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="ds-door__noscript">
            The map on this page needs JavaScript. <a href="/records">Browse the records</a>{' '}
            instead.
          </p>
        )}
      </noscript>
      <DoorImmersive
        pins={pins}
        densityLevels={densityLevels}
        browseShell={shell}
        chapters={chapters}
        factByChapterId={factByChapterId}
        spotlight={spotlight}
        spotlightLngLat={spotlightLngLat}
        spotlightPinId={spotlightPinId}
        placeCount={placeCount}
        openLedger={openLedger}
        initialBrowse={initialBrowse}
      />
    </main>
  );
}
