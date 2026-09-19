/**
 * `/` is the Door Immersive Journey: scroll chapters zoom the national pin field.
 *
 * Chapter order, rotating facts, and the evidence spotlight are rolled once per request
 * (same pickers as Explore StoryMode) so visits vary without loading MapLibre. Pins with
 * public hrefs are clickable. Browse morphs in place onto the same plate (filters / rail);
 * `/explore` is the same Door already armed (deep link / share / cold load).
 */
import React from 'react';
import { loadDoorPinPlate } from '../lib/map-experience/door-catalog';
import { resolveDoorFocusPinId } from '../lib/map-experience/first-paint-pins';
import { KIND_FAMILY_ENTRIES, kindFamilyFor } from '../lib/map-experience/kind-encoding';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { pickStoryChapters } from '../lib/story/pick-story-chapters';
import { pickStoryRecord } from '../lib/story/pick-story-record';
import { buildAtlasShell } from './explore/explore-view-model';
import { DoorImmersive, type DoorOpenLedgerRow } from './door-immersive';
import { DoorNoscript } from './door-noscript';
import './door-home.css';
import './explore/explore.css';

void React;

/** Bound both fallback markup and the client-boundary payload; the full index is at /records. */
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

  const noscriptView = initialBrowse
    ? { ...shell, filteredFeatures: noscriptFeatures.slice(0, NOSCRIPT_ROW_CAP) }
    : null;

  return (
    <main id="main" className="ds-door">
      {/* The plate is the only map on `/`: without JavaScript there is no map at
          all, so say so once and point at the index that needs none. Cold browse keeps a
          filterable list so deep links stay useful without JS. */}
      <DoorNoscript view={noscriptView} />
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
