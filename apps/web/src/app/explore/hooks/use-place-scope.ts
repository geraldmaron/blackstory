/**
 * The place the map and list are scoped to (`?place=`, `docs/ui/patterns-place-map.md`).
 *
 * A place token tap on the plate selects it (the stage's `placeSelect`); the echo chip clears it.
 * While a place is selected, the map and the list both show exactly that place's records, so the
 * list is the keyboard and screen-reader path through what the map shows.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { breakdownInWords, precisionBandFor } from '@repo/domain/map/place-groups';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import type { CountyGeometryCollection } from '../../../lib/map-experience/county-hatch';
import { placeGroupsFor, placeMemberIds } from '../../../lib/map-experience/place-map';
import {
  fetchCountyPolygons,
  loadedCountyPolygons,
} from '../../../components/map-stage/geo-source-loaders';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';

export type PlaceScope = {
  readonly key: string;
  readonly name: string;
  readonly ids: ReadonlySet<string>;
};

export function usePlaceScope(
  stage: MapStageHandle,
  allFeatures: readonly ExploreMapFeature[],
  initialPlace: string | undefined,
) {
  const [placeKey, setPlaceKey] = useState<string | undefined>(initialPlace);
  const [counties, setCounties] = useState<CountyGeometryCollection | undefined>(() =>
    loadedCountyPolygons(),
  );

  useEffect(() => stage.subscribe('placeSelect', setPlaceKey), [stage]);

  // County membership needs the county geometry; the stage usually has it by county zoom, but a
  // cold `?place=county-…` link arrives before the camera gets there.
  useEffect(() => {
    if (counties || !placeKey?.startsWith('county-')) return;
    let live = true;
    fetchCountyPolygons()
      .then((loaded) => {
        if (live) setCounties(loaded);
      })
      .catch(() => {
        // The list stays unscoped; the chip still names the request and clears it.
      });
    return () => {
      live = false;
    };
  }, [counties, placeKey]);

  const all = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: allFeatures }),
    [allFeatures],
  );
  const scope = useMemo((): PlaceScope | undefined => {
    if (!placeKey) return undefined;
    const place = placeGroupsFor(all, counties).places.get(placeKey);
    if (!place) return undefined;
    return { key: placeKey, name: place.name, ids: placeMemberIds(all, placeKey, counties) };
  }, [all, counties, placeKey]);

  return { placeKey, setPlaceKey, scope };
}

/** "180 sit at exact sites, 110 are placed within a city, and 22 are known only by county". */
export function scopedMixInWords(features: readonly ExploreMapFeature[]): string {
  const breakdown = { site: 0, area: 0, county: 0, state: 0 };
  for (const feature of features) breakdown[precisionBandFor(feature.properties.precision)] += 1;
  return breakdownInWords(breakdown);
}

/** The member extent of the scoped records, `[[west, south], [east, north]]`, for framing. */
export function scopedBounds(
  features: readonly ExploreMapFeature[],
): readonly [readonly [number, number], readonly [number, number]] | undefined {
  if (features.length === 0) return undefined;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}
