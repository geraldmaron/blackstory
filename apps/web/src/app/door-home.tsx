/**
 * `/` is the Door: the national map uncovered and a column beside it that leads with one real
 * record, shown the way its record page shows it (name, plate with credit, one claim with its
 * source and grade), while the map points at the same record. The walk is the decade histogram:
 * decade by decade it fills the map and brings up one record from that decade.
 *
 * The records are rolled once per request so visits vary without loading MapLibre. Pins with public hrefs are clickable. Browse morphs in place onto the
 * same plate; `/explore` is the same Door already armed (deep link / share / cold load).
 */
import React from 'react';
import { loadDoorPinPlate } from '../lib/map-experience/door-catalog';
import { resolveDoorFocusPinId } from '../lib/map-experience/first-paint-pins';
import { getSharedPublicEntities } from '../lib/map-experience/shared-map-data';
import { loadRecordsCatalog } from '../lib/records/records-catalog';
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
import { DoorChapters } from './door-chapters';
import { loadRecordsIndex, recordsQueryCacheKey } from './records/load-records-index';
import { listPublicStoryListItems } from '../lib/stories/source';
import { buildStoriesFront } from './stories/stories-index';
import { DoorNoscript } from './door-noscript';
import {
  decadeBars,
  decadeCaption,
  doorRecords,
  pickDecadeStops,
  pickDoorOpening,
  type DoorJourneyRecord,
  type DoorRecord,
} from './door-decade-walk';
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

  // One roll per visit: which record the opening leads with and which record each decade shows.
  // A record shown here is never a quiet one (door-decade-walk.ts).
  const roll = Math.random();
  const journey = initialBrowse ? null : await loadDoorJourney(features, entities, pins, roll);
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
        opening={journey?.opening ?? null}
        stops={journey?.stops ?? []}
        bars={journey?.bars ?? []}
        barsCaption={journey?.barsCaption ?? ''}
        initialBrowse={initialBrowse}
      />
      {journey ? <DoorChapters lead={journey.lead} grades={journey.grades} /> : null}
    </main>
  );
}

/**
 * The journey under the opening: the record it leads with, one record per decade for the walk,
 * the register's decade histogram and grades, and the lead story. Every count comes from the
 * same records index `/records` builds, so the Door and the register cannot disagree.
 */
async function loadDoorJourney(
  features: Parameters<typeof doorRecords>[0],
  entities: Parameters<typeof doorRecords>[1],
  pins: {
    readonly features: readonly {
      readonly properties: { readonly entityId: string; readonly href: string };
    }[];
  },
  roll: number,
) {
  const [{ model }, stories] = await Promise.all([
    loadRecordsIndex(recordsQueryCacheKey({})),
    listPublicStoryListItems().catch(() => ({ items: [] as const })),
  ]);
  const records = doorRecords(features, entities);
  // The plate's pins are opaque `pin-N` ids on the client (the catalog stays off `/`); each record
  // rides with its pin id in place of its catalog id, and the pin's own public href.
  const hrefByPin = new Map(
    pins.features.map((pin) => [pin.properties.entityId, pin.properties.href] as const),
  );
  const withPin = ({ entityId, ...record }: DoorRecord): DoorJourneyRecord => {
    const pinId = resolveDoorFocusPinId(entityId, features);
    const href = (pinId ? hrefByPin.get(pinId) : undefined) || record.href;
    return { ...record, href, pinId };
  };
  const opening = pickDoorOpening(records, roll);
  const bars = decadeBars(model.facets.era);
  return {
    opening: opening ? withPin(opening) : null,
    stops: pickDecadeStops(records, roll).map(withPin),
    bars,
    barsCaption: decadeCaption(bars),
    lead: stories.items.length > 0 ? buildStoriesFront(stories.items).lead : undefined,
    grades: model.facets.evidence,
  };
}
