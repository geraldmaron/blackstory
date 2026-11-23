/**
 * The place a record belongs to on the place map, for its embed (`RecordMap`): the same place
 * `/explore` counts it in, with the same record count and the same `?place=` address
 * (`docs/ui/patterns-place-map.md`, "Embeds"). Server-side: the count needs the whole catalog, so
 * the embed receives the finished token and never loads the catalog itself.
 *
 * A record is named by its deepest known place (city, else county, else state). The county needs
 * the county geometry; where the server cannot read it the record is named by its state, which is
 * coarser, never sharper.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cache } from 'react';
import { pathIncludes } from '@repo/domain/map/place-groups';
import { loadDoorPinPlate } from './door-catalog';
import type { ExploreMapFeatureCollection } from './build-explore-map-source';
import type { CountyGeometryCollection } from './county-hatch';
import { placeGroupsFor } from './place-map';
import { DEFAULT_EXPLORE_FILTERS } from './filters';
import { buildExploreHref, defaultExploreOverlayState } from './url-state';

export type RecordPlace = {
  readonly key: string;
  readonly name: string;
  /** Records the archive holds in this place, the number `/explore` shows when it is entered. */
  readonly count: number;
  /** `/explore` with this place entered and the record selected inside it. */
  readonly href: string;
};

/** The map view at `place=<key>&selected=<id>`: the place entered, the record found inside it. */
export function recordPlaceHref(placeKey: string, entityId: string): string {
  return buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    place: placeKey,
    selected: entityId,
  });
}

/** A map hand-off (the map view at `selected=…`, filters and all) with the record's place entered. */
export function mapHrefInPlace(mapHref: string, placeKey: string): string {
  const [path = '/archive', query = ''] = mapHref.split('?');
  const params = new URLSearchParams(query);
  params.set('place', placeKey);
  return `${path}?${params}`;
}

/** Pure core of `loadRecordPlace`, so the rule is testable without the catalog. */
export function recordPlaceFor(
  collection: ExploreMapFeatureCollection,
  counties: CountyGeometryCollection | undefined,
  entityId: string,
): RecordPlace | undefined {
  const groups = placeGroupsFor(collection, counties);
  const path = groups.pathById.get(entityId);
  const key = path?.city ?? path?.county ?? path?.state;
  const place = key ? groups.places.get(key) : undefined;
  if (!key || !place) return undefined;
  let count = 0;
  for (const other of groups.pathById.values()) if (pathIncludes(other, key)) count += 1;
  return { key, name: place.name, count, href: recordPlaceHref(key, entityId) };
}

let countiesOnDisk: Promise<CountyGeometryCollection | undefined> | undefined;

function loadCounties(): Promise<CountyGeometryCollection | undefined> {
  countiesOnDisk ??= readFile(join(process.cwd(), 'public/geo/us-counties-20m.geojson'), 'utf8')
    .then((text) => JSON.parse(text) as CountyGeometryCollection)
    .catch(() => undefined);
  return countiesOnDisk;
}

const collections = new WeakMap<object, ExploreMapFeatureCollection>();

/** The record's place token, or nothing when the catalog cannot place it. Never throws. */
export const loadRecordPlace = cache(async (entityId: string): Promise<RecordPlace | undefined> => {
  try {
    const plate = await loadDoorPinPlate();
    let collection = collections.get(plate);
    if (!collection) {
      collection = { type: 'FeatureCollection', features: plate.features };
      collections.set(plate, collection);
    }
    return recordPlaceFor(collection, await loadCounties(), entityId);
  } catch {
    return undefined;
  }
});

/**
 * The county a record's point falls in, by name with its suffix ("Cook County"), for matching a
 * county series to a record (`figure-coverage.ts`). Nothing when the record has no point, sits at
 * state precision, or the county outlines cannot be read. Never throws.
 */
export const loadRecordCounty = cache(async (entityId: string): Promise<string | undefined> => {
  try {
    const plate = await loadDoorPinPlate();
    let collection = collections.get(plate);
    if (!collection) {
      collection = { type: 'FeatureCollection', features: plate.features };
      collections.set(plate, collection);
    }
    const groups = placeGroupsFor(collection, await loadCounties());
    const county = groups.pathById.get(entityId)?.county;
    // A county place is named with its state's postal code ("Cook County, IL").
    return county ? groups.places.get(county)?.name.replace(/, [A-Z]{2}$/, '') : undefined;
  } catch {
    return undefined;
  }
});
