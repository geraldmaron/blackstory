/**
 * `/` is the Door: the national map uncovered, a headline column, the visit's spotlight record
 * as a callout on its pin, and a guided walk whose chapters fly the same plate.
 *
 * Chapter order, rotating facts, and the spotlight are rolled once per request so visits vary
 * without loading MapLibre. Pins with public hrefs are clickable. Browse morphs in place onto the
 * same plate; `/explore` is the same Door already armed (deep link / share / cold load).
 */
import React from 'react';
import { loadDoorPinPlate } from '../lib/map-experience/door-catalog';
import { resolveDoorFocusPinId } from '../lib/map-experience/first-paint-pins';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { loadRecordsCatalog } from '../lib/records/records-catalog';
import { pickStoryChapters } from '../lib/story/pick-story-chapters';
import { pickStoryRecord } from '../lib/story/pick-story-record';
import { redirect } from 'next/navigation';
import { buildExploreHref, parseExploreSearchParams } from '../lib/map-experience/url-state';
import { resolveStoryCollectionSource } from '../lib/stories/source';
import {
  NO_COLLECTION,
  collectionDescriptorWithoutRead,
  parseCollectionToken,
  resolveStoryCollection,
  storyCollectionSlug,
  type CollectionDescriptor,
} from '../lib/discovery/story-collection';
import { buildAtlasShell } from './explore/explore-view-model';
import { DoorImmersive } from './door-immersive';
import { DoorNoscript } from './door-noscript';
import './door-home.css';
import './explore/explore.css';

void React;

/** Bound both fallback markup and the client-boundary payload; the full index is at /records. */
const NOSCRIPT_ROW_CAP = 20;

export type DoorHomeProps = {
  /** Deep-link / share filters (`?state=DC`, etc.). Empty on the journey `/`. */
  readonly params?: Record<string, string | string[] | undefined>;
  /** Cold `/explore`: render already in browse posture (same shell as morph-from-home). */
  readonly initialBrowse?: boolean;
};

export async function DoorHome({ params = {}, initialBrowse = false }: DoorHomeProps = {}) {
  const [
    { pins, features, densityLevels },
    { data: entities, source: dataSource },
    { data: collectionCatalog },
  ] = await Promise.all([loadDoorPinPlate(), getSharedPublicEntities(), loadRecordsCatalog()]);

  // A named story collection reads the story cache; the unfiltered map never does, so an
  // unavailable story source cannot take the plain map down. Sentinels need no read.
  const viewState = parseExploreSearchParams(params);
  const token = parseCollectionToken(viewState.collection);
  const storySlug = storyCollectionSlug(token);
  const storySource =
    storySlug === undefined ? undefined : await resolveStoryCollectionSource(storySlug);
  const collection: CollectionDescriptor =
    storySource !== undefined
      ? resolveStoryCollection(
          storySource,
          new Set(
            (collectionCatalog as readonly { readonly id: string }[]).map((entry) => entry.id),
          ),
        )
      : (collectionDescriptorWithoutRead(token) ?? NO_COLLECTION);
  // A well-formed story the release does not have redirects TEMPORARILY (307) to the finite
  // `missing` sentinel, keeping every other narrowing. It never falls through to the bare map.
  if (collection.state === 'unknown') {
    redirect(buildExploreHref({ ...viewState, collection: 'missing' }));
  }

  const { shell, noscriptFeatures } = buildAtlasShell(
    params,
    entities,
    dataSource,
    features,
    collectionCatalog,
    collection,
  );

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
        initialBrowse={initialBrowse}
      />
    </main>
  );
}
